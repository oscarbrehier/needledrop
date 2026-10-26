import { getDatabase } from "../db/client.js";
import { getVectors } from "../db/embeddings.js";
import { embed } from "../embed/embedder.js";
import { type ParsedPrompt } from "./parse.js";

export type Candidate = {
	isrc: string;
	title: string;
	artist: string | null;
	moods: string[];
	energy: number;
	confidence: "low" | "medium" | "high";
	distance: number;
};

type Row = {
	isrc: string;
	title: string;
	artist: string | null;
	moodsJson: string;
	energy: number;
	confidence: "low" | "medium" | "high";
};

type Filters = {
	languages?: string[];
	moods?: string[];
	energyMin?: number;
	energyMax?: number;
};

function selectCandidateRows(filters: Filters): Row[] {

	const params: (string | number)[] = [];

	let query = `
		SELECT
			t.isrc, t.title, t.artist,
			json_extract(tg.payload, '$.moods') AS moodsJson,
			json_extract(tg.payload, '$.energy') AS energy,
			json_extract(tg.payload, '$.confidence') AS confidence
		FROM tags tg
		JOIN tracks t ON t.isrc = tg.isrc
		WHERE 1 = 1
	`;

	if (filters.languages?.length) {
		query += ` AND EXISTS (
			SELECT 1 FROM json_each(tg.payload, '$.languages')
			WHERE value IN (${filters.languages.map(() => "?").join(",")})
		)`;
		params.push(...filters.languages);
	};

	if (filters.moods?.length) {
		query += ` AND EXISTS (
			SELECT 1 FROM json_each(tg.payload, '$.moods')
			WHERE value IN (${filters.moods.map(() => "?").join(",")})
		)`;
		params.push(...filters.moods);
	};

	if (filters.energyMin !== undefined) {
		query += " AND json_extract(tg.payload, '$.energy') >= ?";
		params.push(filters.energyMin);
	};

	if (filters.energyMax !== undefined) {
		query += " AND json_extract(tg.payload, '$.energy') <= ?";
		params.push(filters.energyMax);
	};

	// A guessed mood or energy should never be the reason a low-confidence
	// track gets selected, so these two filters exclude it outright.
	if (filters.moods?.length || filters.energyMin !== undefined || filters.energyMax !== undefined) {
		query += " AND json_extract(tg.payload, '$.confidence') != 'low'";
	};

	query += " GROUP BY t.isrc";

	return getDatabase().prepare(query).all(...params) as Row[];

};

function dot(a: Float32Array, b: Float32Array): number {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
	return sum;
};

export type SearchResult = { candidates: Candidate[]; relaxedEnergy: boolean };

export async function searchCandidates(parsed: ParsedPrompt): Promise<SearchResult> {

	let rows = selectCandidateRows(parsed);
	let relaxedEnergy = false;

	if (rows.length < parsed.size && (parsed.energyMin !== undefined || parsed.energyMax !== undefined)) {
		rows = selectCandidateRows({ languages: parsed.languages, moods: parsed.moods });
		relaxedEnergy = true;
	};

	const [queryVector] = await embed([parsed.semantic]);
	const vectors = getVectors(rows.map((r) => r.isrc));

	const candidates: Candidate[] = rows
		.filter((row) => vectors.has(row.isrc))
		.map((row) => ({
			isrc: row.isrc,
			title: row.title,
			artist: row.artist,
			moods: JSON.parse(row.moodsJson) as string[],
			energy: row.energy,
			confidence: row.confidence,
			distance: 1 - dot(queryVector!, vectors.get(row.isrc)!),
		}));

	// Low confidence never outranks a real match, regardless of similarity.
	candidates.sort((a, b) => {
		if ((a.confidence === "low") !== (b.confidence === "low")) return a.confidence === "low" ? 1 : -1;
		return a.distance - b.distance;
	});

	return { candidates, relaxedEnergy };

};
