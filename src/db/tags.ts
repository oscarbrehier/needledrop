import { type Tags } from "../tag/schema.js";
import { getDatabase } from "./client.js";

export type RecordingToTag = {
	isrc: string;
	title: string;
	artist: string | null;
	lastfm: string | null;
	musicbrainz: string | null;
	reccobeats: string | null;
	taggedPromptVersion: string | null;
};

export function selectRecordingsToTag(options: { playlist?: string }): RecordingToTag[] {

	const params: (string | number)[] = [];

	let query = `
		SELECT
			t.isrc,
			t.title,
			t.artist,
			lf.payload AS lastfm,
			mb.payload AS musicbrainz,
			rb.payload AS reccobeats,
			tg.prompt_version AS taggedPromptVersion
		FROM tracks t
		LEFT JOIN enrichment lf ON lf.track_id = t.tidal_id AND lf.source = 'lastfm'
		LEFT JOIN enrichment mb ON mb.track_id = t.tidal_id AND mb.source = 'musicbrainz'
		LEFT JOIN enrichment rb ON rb.track_id = t.tidal_id AND rb.source = 'reccobeats'
		LEFT JOIN tags tg ON tg.isrc = t.isrc
		WHERE t.isrc IS NOT NULL
	`;

	if (options.playlist) {
		query += `
		  AND t.tidal_id IN (
			SELECT pt.track_id
			FROM playlist_tracks pt
			JOIN playlists p ON p.tidal_id = pt.playlist_id
			WHERE p.name = ? COLLATE NOCASE
		  )
		`;
		params.push(options.playlist);
	}

	query += " GROUP BY t.isrc ORDER BY t.isrc";

	return getDatabase().prepare(query).all(...params) as RecordingToTag[];

};

export function saveTags(isrc: string, tags: Tags, model: string, promptVersion: string): void {

	getDatabase()
		.prepare(`
			INSERT INTO tags (isrc, payload, model, prompt_version)
			VALUES (@isrc, @payload, @model, @promptVersion)
			ON CONFLICT (isrc) DO UPDATE SET
				payload        = excluded.payload,
				model          = excluded.model,
				prompt_version = excluded.prompt_version,
				created_at     = datetime('now')
		`)
		.run({ isrc, payload: JSON.stringify(tags), model, promptVersion });

};

export type StoredTag = { tags: Tags; model: string; promptVersion: string };

export function getTag(isrc: string): StoredTag | null {

	const row = getDatabase()
		.prepare("SELECT payload, model, prompt_version AS promptVersion FROM tags WHERE isrc = ?")
		.get(isrc) as { payload: string; model: string; promptVersion: string } | undefined;

	if (!row) return null;

	return { tags: JSON.parse(row.payload) as Tags, model: row.model, promptVersion: row.promptVersion };

};

export function hasLastfmWiki(isrc: string): boolean {

	const row = getDatabase()
		.prepare(`
			SELECT e.payload
			FROM tracks t
			JOIN enrichment e ON e.track_id = t.tidal_id AND e.source = 'lastfm'
			WHERE t.isrc = ? AND e.payload IS NOT NULL
			LIMIT 1
		`)
		.get(isrc) as { payload: string } | undefined;

	if (!row) return false;

	try {
		const data = JSON.parse(row.payload) as { track?: { wiki?: { summary?: string } } };
		return Boolean(data.track?.wiki?.summary);
	} catch {
		return false;
	};

};
