import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as sqliteVec from "sqlite-vec";
import { databasePath } from "../config.js";

let db: Database.Database | undefined;

export function getDatabase(): Database.Database {

	if (!db) {
		mkdirSync(dirname(databasePath), { recursive: true });

		db = new Database(databasePath);
		db.pragma("journal_mode = WAL");
		db.pragma("foreign_keys = ON");
		// Lets a writer wait out another process's lock instead of throwing
		// SQLITE_BUSY immediately, so the three enrichers can run as separate
		// concurrent processes against the same file.
		db.pragma("busy_timeout = 5000");
		sqliteVec.load(db);
	};

	return db;

};