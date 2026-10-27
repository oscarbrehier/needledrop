import z from "zod";
import { TrackTags } from "../tag/schema.js";
import { getDatabase } from "./client.js";

type Tags = z.infer<typeof TrackTags>;

export type RecordingRow = {
	isrc: string;
	title: string;
	artist: string | null;
	tags: Tags | null;
};

export function listRecordings(): RecordingRow[] {

	const rows = getDatabase()
		.prepare(`
			SELECT t.isrc, MIN(t.title) AS title, MIN(t.artist) AS artist, g.payload AS tags
			FROM tracks t
			LEFT JOIN tags g ON g.isrc = t.isrc
			WHERE t.isrc IS NOT NULL
			GROUP BY t.isrc
			ORDER BY artist, title
		`)
		.all() as { isrc: string; title: string; artist: string | null; tags: string | null }[];

	return rows.map((row) => ({ ...row, tags: row.tags ? JSON.parse(row.tags) : null }));

};