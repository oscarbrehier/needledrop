import { getDatabase } from "./client.js";

export type EnrichTrack = {
	tidalId: string;
	isrc: string | null;
	title: string;
	artist: string | null;
};

export function selectPendingTracks(source: string, limit?: number): EnrichTrack[] {

	const db = getDatabase();

	let query = `
		SELECT t.tidal_id AS tidalId, t.isrc, t.title, t.artist
		FROM tracks t
		WHERE NOT EXISTS (
			SELECT 1 FROM enrichment e
			WHERE e.track_id = t.tidal_id AND e.source = ?
		)
		ORDER BY t.tidal_id
	`;

	const params: (string | number)[] = [source];

	if (limit) {
		query += ` LIMIT ?`;
		params.push(limit);
	};

	return db.prepare(query).all(...params) as EnrichTrack[];

};

export function saveEnrichment(trackId: string, source: string, payload: unknown | null): void {

	const db = getDatabase();
	
	db.prepare(`
		INSERT INTO enrichment (track_id, source, payload)
		VALUES (@trackId, @source, @payload)
		ON CONFLICT (track_id, source) DO UPDATE SET
			payload		= excluded.payload
			fetched_at	= datetime('now')	
	`).run({
		trackId,
		source,
		payload: payload === null ? null : JSON.stringify(payload)
	});

};