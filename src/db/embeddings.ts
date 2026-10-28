import { type Tags } from "../tag/schema.js";
import { getDatabase } from "./client.js";

export type RecordingToEmbed = { isrc: string; title: string; tags: Tags };

export function selectTaggedRecordings(): RecordingToEmbed[] {

	const rows = getDatabase()
		.prepare(`
			SELECT
				tg.isrc, t.title, tg.payload,
				ov.languages AS overrideLanguages, ov.moods AS overrideMoods, ov.energy AS overrideEnergy
			FROM tags tg
			JOIN tracks t ON t.isrc = tg.isrc
			LEFT JOIN tag_overrides ov ON ov.isrc = tg.isrc
			GROUP BY tg.isrc
		`)
		.all() as {
			isrc: string; title: string; payload: string;
			overrideLanguages: string | null; overrideMoods: string | null; overrideEnergy: number | null;
		}[];

	// The embedding text is built from the resolved tags, so a manual override
	// (see db/tagOverrides.ts) shifts what gets embedded the same way it shifts
	// what search sees.
	return rows.map((row) => {

		const tags = JSON.parse(row.payload) as Tags;

		return {
			isrc: row.isrc,
			title: row.title,
			tags: {
				...tags,
				languages: row.overrideLanguages ? JSON.parse(row.overrideLanguages) : tags.languages,
				moods: row.overrideMoods ? JSON.parse(row.overrideMoods) : tags.moods,
				energy: row.overrideEnergy ?? tags.energy,
			},
		};

	});

};

export function getEmbeddingHashes(): Map<string, string> {

	const rows = getDatabase()
		.prepare("SELECT isrc, text_hash AS textHash FROM embeddings")
		.all() as { isrc: string; textHash: string }[];

	return new Map(rows.map((row) => [row.isrc, row.textHash]));

};

export function saveEmbedding(isrc: string, vector: Float32Array, model: string, textHash: string): void {

	const db = getDatabase();

	const upsert = db.transaction(() => {

		db.prepare(`
			INSERT INTO embeddings (isrc, model, text_hash)
			VALUES (@isrc, @model, @textHash)
			ON CONFLICT (isrc) DO UPDATE SET
				model       = excluded.model,
				text_hash   = excluded.text_hash,
				embedded_at = datetime('now')
		`).run({ isrc, model, textHash });

		const { rowid } = db.prepare("SELECT rowid FROM embeddings WHERE isrc = ?").get(isrc) as { rowid: number };
		const buffer = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);

		// vec0 rejects a plain JS number as rowid ("Only integers are allowed for primary key values"), so it needs BigInt.
		db.prepare("DELETE FROM embeddings_vec WHERE rowid = ?").run(BigInt(rowid));
		db.prepare("INSERT INTO embeddings_vec (rowid, embedding) VALUES (?, ?)").run(BigInt(rowid), buffer);

	});

	upsert();

};

// For ranking search candidates in plain TypeScript rather than through vec0.
export function getVectors(isrcs: string[]): Map<string, Float32Array> {

	if (isrcs.length === 0) return new Map();

	const db = getDatabase();
	const placeholders = isrcs.map(() => "?").join(",");

	const mapping = db
		.prepare(`SELECT isrc, rowid FROM embeddings WHERE isrc IN (${placeholders})`)
		.all(...isrcs) as { isrc: string; rowid: number }[];

	const vectors = new Map<string, Float32Array>();

	for (const { isrc, rowid } of mapping) {

		const row = db.prepare("SELECT embedding FROM embeddings_vec WHERE rowid = ?").get(BigInt(rowid)) as
			{ embedding: Buffer } | undefined;

		if (row) {
			vectors.set(isrc, new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4));
		};

	};

	return vectors;

};

export type Neighbour = { isrc: string; title: string; artist: string | null; distance: number };

export function findNearest(isrc: string, k: number): Neighbour[] {

	const db = getDatabase();

	const mapping = db.prepare("SELECT isrc, rowid FROM embeddings").all() as { isrc: string; rowid: number }[];
	const target = mapping.find((m) => m.isrc === isrc);
	if (!target) throw new Error(`No embedding stored for ${isrc}. Run "embed" first.`);

	// BigInt again, same reason as in saveEmbedding.
	const vectorRow = db.prepare("SELECT embedding FROM embeddings_vec WHERE rowid = ?").get(BigInt(target.rowid)) as
		{ embedding: Buffer } | undefined;
	if (!vectorRow) throw new Error(`Embedding row for ${isrc} is missing its vector.`);

	// vec0 only supports a plain "MATCH ... ORDER BY distance LIMIT ?" shape, so the
	// isrc join happens afterwards in JS rather than in the same query.
	const rows = db.prepare(`
		SELECT rowid, distance
		FROM embeddings_vec
		WHERE embedding MATCH ?
		ORDER BY distance
		LIMIT ?
	`).all(vectorRow.embedding, k + 1) as { rowid: number; distance: number }[];

	const isrcByRowid = new Map(mapping.map((m) => [m.rowid, m.isrc]));
	const info = db.prepare("SELECT title, artist FROM tracks WHERE isrc = ? GROUP BY isrc");

	return rows
		.filter((row) => row.rowid !== target.rowid)
		.slice(0, k)
		.map((row) => {
			const neighbourIsrc = isrcByRowid.get(row.rowid)!;
			const track = info.get(neighbourIsrc) as { title: string; artist: string | null };
			return { isrc: neighbourIsrc, title: track.title, artist: track.artist, distance: row.distance };
		});

};
