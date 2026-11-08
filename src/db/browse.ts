import z from "zod";
import { TrackTags } from "../tag/schema.js";
import { getDatabase } from "./client.js";
import { LibraryStats, TrackResult } from "../server/contract.js";
import { ResultRow } from "../search/builder.js";
import { Mood } from "../tag/moods.js";

type Tags = z.infer<typeof TrackTags>;

export type OverrideField = "languages" | "moods" | "energy";

export type RecordingRow = {
	isrc: string;
	title: string;
	artist: string | null;
	tags: Tags | null;
	overridden: OverrideField[];
};

type RawRow = {
	isrc: string;
	title: string;
	artist: string | null;
	tags: string | null;
	overrideLanguages: string | null;
	overrideMoods: string | null;
	overrideEnergy: number | null;
};

export type TrackDetails = {
	tidalId: string;
	languages: string;
	description: string;
	durationS: number | null;
};

export function listRecordings(): RecordingRow[] {

	const rows = getDatabase()
		.prepare(`
			SELECT
				t.isrc,
				MIN(t.title)  AS title,
				MIN(t.artist) AS artist,
				g.payload     AS tags,
				o.languages   AS overrideLanguages,
				o.moods       AS overrideMoods,
				o.energy      AS overrideEnergy
			FROM tracks t
			LEFT JOIN tags g          ON g.isrc = t.isrc
			LEFT JOIN tag_overrides o ON o.isrc = t.isrc
			WHERE t.isrc IS NOT NULL
			GROUP BY t.isrc
			ORDER BY artist, title
		`)
		.all() as RawRow[];

	return rows.map(toRecordingRow);

};

function toRecordingRow(row: RawRow): RecordingRow {

	const base = { isrc: row.isrc, title: row.title, artist: row.artist };

	if (!row.tags) return { ...base, tags: null, overridden: [] };

	const tags: Tags = JSON.parse(row.tags);
	const overridden: OverrideField[] = [];

	if (row.overrideLanguages !== null) {
		tags.languages = JSON.parse(row.overrideLanguages);
		overridden.push("languages");
	};

	if (row.overrideMoods !== null) {
		tags.moods = JSON.parse(row.overrideMoods);
		overridden.push("moods");
	};

	if (row.overrideEnergy !== null) {
		tags.energy = row.overrideEnergy;
		overridden.push("energy");
	};

	return { ...base, tags, overridden };

};

export function libraryStats(): LibraryStats {

	const stats = getDatabase()
		.prepare(`
			SELECT
				(SELECT COUNT(DISTINCT isrc) FROM tracks WHERE isrc IS NOT NULL)                AS total,
				(SELECT COUNT(*) FROM tags)                                                     AS tagged,
				(SELECT COUNT(*) FROM embeddings)                                        AS embedded,
				(SELECT COUNT(*) FROM tags WHERE json_extract(payload, '$.confidence') = 'low') AS lowConfidence
			`)
		.get();

	return LibraryStats.parse(stats);

};

export function trackDetails(isrcs: string[]): Map<string, TrackDetails> {

	if (isrcs.length === 0) return new Map();

	const rows = getDatabase()
		.prepare(`
			SELECT
				t.isrc,
				MIN(t.tidal_id)   AS tidalId,
				MIN(t.duration_s) AS durationS,
				json_extract(g.payload, '$.description') AS description,
				COALESCE(o.languages, json_extract(g.payload, '$.languages')) AS languagesJson
			FROM tracks t
			JOIN tags g               ON g.isrc = t.isrc
			LEFT JOIN tag_overrides o ON o.isrc = t.isrc
			WHERE t.isrc IN (${isrcs.map(() => "?").join(",")})
			GROUP BY t.isrc
		`)
		.all(...isrcs) as { isrc: string; tidalId: string; durationS: number | null; description: string; languagesJson: string; }[];

	return new Map(rows.map((r) => [r.isrc, {
		tidalId: r.tidalId,
		durationS: r.durationS,
		description: r.description,
		languages: JSON.parse(r.languagesJson)
	}]));

};

export function toTrackResult(rows: ResultRow[], details: Map<string, TrackDetails>): TrackResult[] {

	return rows.map((r) => {

		const d = details.get(r.isrc);
		if (!d) throw new Error(`No details found for ${r.isrc}`);

		return {
			isrc: r.isrc,
			tidalId: d.tidalId,
			title: r.title,
			artist: r.artist,
			moods: r.moods as Mood[],
			energy: r.energy,
			languages: d.languages,
			description: d.description,
			confidence: r.confidence,
			distance: r.distance,
			score: r.score,
			durationS: d.durationS,
		};

	});

};