import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync } from "node:fs";
import { TagOverrideInput } from "../tag/schema.js";
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

function rowToOverride(row: OverrideRow): TagOverride {
	return {
		isrc: row.isrc,
		languages: row.languages ? JSON.parse(row.languages) : null,
		moods: row.moods ? JSON.parse(row.moods) : null,
		energy: row.energy,
		note: row.note,
		createdAt: row.createdAt,
	};
};

export function getOverride(isrc: string): TagOverride | null {

	const row = getDatabase()
		.prepare("SELECT isrc, languages, moods, energy, note, created_at AS createdAt FROM tag_overrides WHERE isrc = ?")
		.get(isrc) as OverrideRow | undefined;

	return row ? rowToOverride(row) : null;

};

export function listOverrides(): TagOverride[] {

	const rows = getDatabase()
		.prepare("SELECT isrc, languages, moods, energy, note, created_at AS createdAt FROM tag_overrides ORDER BY isrc")
		.all() as OverrideRow[];

	return rows.map(rowToOverride);

};

function csvField(value: string): string {
	return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};

// The overrides table lives in the gitignored database, so this is how a
// human correction gets into git: exported to a tracked CSV, and restored
// from it onto a fresh database (e.g. after a re-sync from scratch).
export function exportOverrides(path: string): number {

	const overrides = listOverrides();
	const header = ["isrc", "languages", "moods", "energy", "note"];

	const lines = [header.join(",")].concat(
		overrides.map((o) => [
			o.isrc,
			o.languages?.join("|") ?? "",
			o.moods?.join("|") ?? "",
			o.energy !== null ? String(o.energy) : "",
			o.note ?? "",
		].map(csvField).join(","))
	);

	writeFileSync(path, lines.join("\n") + "\n");
	return overrides.length;

};

export function importOverrides(path: string): number {

	const rows = parse(readFileSync(path, "utf-8"), { columns: true, skip_empty_lines: true }) as
		{ isrc: string; languages: string; moods: string; energy: string; note: string }[];

	for (const row of rows) {

		const input = TagOverrideInput.parse({
			languages: row.languages ? row.languages.split("|") : undefined,
			moods: row.moods ? row.moods.split("|") : undefined,
			energy: row.energy ? Number.parseInt(row.energy, 10) : undefined,
			note: row.note || undefined,
		});

		saveOverride(row.isrc, input);

	};

	return rows.length;

};
