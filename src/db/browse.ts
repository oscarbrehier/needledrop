import z from "zod";
import { TrackTags } from "../tag/schema.js";
import { getDatabase } from "./client.js";

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
}

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