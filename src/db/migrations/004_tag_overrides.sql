CREATE TABLE tag_overrides (
	isrc TEXT PRIMARY KEY,
	languages TEXT,
	moods TEXT,
	energy INTEGER,
	note TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
