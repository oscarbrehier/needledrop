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

type HardFilters = {
	languages?: string[];
	energyMin?: number;
	energyMax?: number;
};

// Languages and energy are facts about the track, so they stay hard SQL
// filters. Moods are "feel", handled afterwards as a ranking preference.
function selectCandidateRows(filters: HardFilters): Row[] {

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

	if (filters.energyMin !== undefined) {
		query += " AND json_extract(tg.payload, '$.energy') >= ?";
		params.push(filters.energyMin);
	};

	if (filters.energyMax !== undefined) {
		query += " AND json_extract(tg.payload, '$.energy') <= ?";
		params.push(filters.energyMax);
	};

	// A guessed energy should never be the reason a low-confidence track gets selected.
	if (filters.energyMin !== undefined || filters.energyMax !== undefined) {
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

// How much a mood overlap pulls a track up the ranking. Small relative to the
// usual spread in distance (roughly 0.3-0.6 in practice), so it nudges rather
// than overrides semantic similarity.
const MOOD_BONUS = 0.05;
const MIN_MOOD_MATCHES = 1;

export type SearchResult = {
	candidates: Candidate[];
	relaxedEnergy: boolean;
	hardFilteredCount: number;
};

export async function searchCandidates(parsed: ParsedPrompt): Promise<SearchResult> {

	let rows = selectCandidateRows(parsed);
	let relaxedEnergy = false;

	if (rows.length < parsed.size && (parsed.energyMin !== undefined || parsed.energyMax !== undefined)) {
		rows = selectCandidateRows({ languages: parsed.languages });
		relaxedEnergy = true;
	};

	const hardFilteredCount = rows.length;

	const [queryVector] = await embed([parsed.semantic]);
	const vectors = getVectors(rows.map((r) => r.isrc));

	let candidates: (Candidate & { moodMatches: number })[] = rows
		.filter((row) => vectors.has(row.isrc))
		.map((row) => {

			const moods = JSON.parse(row.moodsJson) as string[];

			// A guessed mood should never be the reason a low-confidence track
			// clears the minimum-match bar, so its overlap counts as zero.
			const moodMatches = (!parsed.moods?.length || row.confidence === "low")
				? 0
				: moods.filter((m) => (parsed.moods as string[]).includes(m)).length;

			return {
				isrc: row.isrc,
				title: row.title,
				artist: row.artist,
				moods,
				energy: row.energy,
				confidence: row.confidence,
				distance: 1 - dot(queryVector!, vectors.get(row.isrc)!),
				moodMatches,
			};

		});

	if (parsed.moods?.length) {
		candidates = candidates.filter((c) => c.moodMatches >= MIN_MOOD_MATCHES);
	};

	candidates.sort((a, b) => {
		if ((a.confidence === "low") !== (b.confidence === "low")) return a.confidence === "low" ? 1 : -1;
		const scoreA = a.distance - a.moodMatches * MOOD_BONUS;
		const scoreB = b.distance - b.moodMatches * MOOD_BONUS;
		return scoreA - scoreB;
	});

	return {
		candidates: candidates.map(({ moodMatches: _moodMatches, ...c }) => c),
		relaxedEnergy,
		hardFilteredCount,
	};

};
