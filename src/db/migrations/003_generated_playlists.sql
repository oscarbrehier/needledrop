CREATE TABLE generated_playlists (
	tidal_id TEXT PRIMARY KEY,
	prompt TEXT NOT NULL,
	filters TEXT NOT NULL,
	track_ids TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
