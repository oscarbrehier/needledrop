-- vec0 only supports an integer rowid, not a text key, so this table maps
-- each ISRC to the implicit rowid shared with embeddings_vec.
CREATE TABLE embeddings (
	isrc TEXT PRIMARY KEY,
	model TEXT NOT NULL,
	text_hash TEXT NOT NULL,
	embedded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1024 dimensions to match bge-m3's output.
CREATE VIRTUAL TABLE embeddings_vec USING vec0(
	embedding float[1024]
);
