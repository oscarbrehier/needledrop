import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { databasePath } from "../config.js";

let db: Database.Database | undefined;

export function getDatabase(): Database.Database {

	if (!db) {
		mkdirSync(dirname(databasePath), { recursive: true });

		db = new Database(databasePath);
		db.pragma("journal_mode = WAL");
		db.pragma("foreign_keys = ON");
	};

	return db;

};