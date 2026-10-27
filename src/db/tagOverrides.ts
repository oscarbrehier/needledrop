import { type TagOverrideInput } from "../tag/schema.js";
import { getDatabase } from "./client.js";

export type TagOverride = {
	isrc: string;
	languages: string[] | null;
	moods: string[] | null;
	energy: number | null;
	note: string | null;
	createdAt: string;
};

// Only the `override` command writes here. tag/--retag never touches this
// table, so a human correction survives any future re-tag.
export function saveOverride(isrc: string, input: TagOverrideInput): void {

	getDatabase()
		.prepare(`
			INSERT INTO tag_overrides (isrc, languages, moods, energy, note)
			VALUES (@isrc, @languages, @moods, @energy, @note)
			ON CONFLICT (isrc) DO UPDATE SET
				languages  = excluded.languages,
				moods      = excluded.moods,
				energy     = excluded.energy,
				note       = excluded.note,
				created_at = datetime('now')
		`)
		.run({
			isrc,
			languages: input.languages ? JSON.stringify(input.languages) : null,
			moods: input.moods ? JSON.stringify(input.moods) : null,
			energy: input.energy ?? null,
			note: input.note ?? null,
		});

};

type OverrideRow = { isrc: string; languages: string | null; moods: string | null; energy: number | null; note: string | null; createdAt: string };

export function getOverride(isrc: string): TagOverride | null {

	const row = getDatabase()
		.prepare("SELECT isrc, languages, moods, energy, note, created_at AS createdAt FROM tag_overrides WHERE isrc = ?")
		.get(isrc) as OverrideRow | undefined;

	if (!row) return null;

	return {
		isrc: row.isrc,
		languages: row.languages ? JSON.parse(row.languages) : null,
		moods: row.moods ? JSON.parse(row.moods) : null,
		energy: row.energy,
		note: row.note,
		createdAt: row.createdAt,
	};

};
