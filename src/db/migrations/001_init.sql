CREATE TABLE tracks (
	tidal_id TEXT PRIMARY KEY,
	isrc TEXT,
	title TEXT NOT NULL,
	artist TEXT,
	album TEXT,
	duration_s INTEGER,
	raw TEXT
);

CREATE INDEX tracks_isrc ON tracks (isrc);

CREATE TABLE playlists (
	tidal_id TEXT PRIMARY KEY,
	name TEXT NOT NULL
);

CREATE TABLE playlist_tracks (
	playlist_id TEXT NOT NULL REFERENCES playlists (tidal_id) ON DELETE CASCADE,
	track_id TEXT NOT NULL REFERENCES tracks (tidal_id),
	position INTEGER NOT NULL,
	PRIMARY KEY (playlist_id, position)
);

CREATE TABLE enrichment (
	track_id TEXT NOT NULL REFERENCES tracks (tidal_id),
	source TEXT NOT NULL,
	payload TEXT,
	fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (track_id, source)
);

CREATE TABLE tags (
	isrc TEXT PRIMARY KEY,
	payload TEXT NOT NULL,
	model TEXT NOT NULL,
	prompt_version TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);