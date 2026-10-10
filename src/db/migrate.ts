import { join } from "node:path";
import { getDatabase } from "./client.js";
import { readdirSync, readFileSync } from "node:fs";

const dir = join(import.meta.dirname, "migrations");

export function migrate(): string[] {

	const db = getDatabase();

	db.exec(`CREATE TABLE IF NOT EXISTS migrations (
		name		TEXT PRIMARY KEY,
		applied_at	TEXT NOT NULL DEFAULT (datetime('now'))
	)`);

	const applied = new Set(
		db.prepare("SELECT name FROM migrations").pluck().all() as string[],
	);

	const pending = readdirSync(dir)
		.filter((file) => file.endsWith(".sql") && !applied.has(file))
		.sort();

	const apply = db.transaction((name: string) => {
		db.exec(readFileSync(join(dir, name), "utf-8"));
		db.prepare("INSERT INTO migrations (name) VALUES (?)").run(name);
	});

	for (const name of pending) apply(name);
	return pending;

};