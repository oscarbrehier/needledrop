import { getDatabase } from "./client.js";

export type PlaylistRow = {
	tidalId: string;
	name: string;
};

export type TrackRow = {
	tidalId: string;
	isrc: string | null;
	title: string;
	artist: string | null;
	album: string | null;
	durationS: number | null;
	raw: string;
};

export type PlaylistTrackRow = {
	trackId: string;
	position: number;
};

export function upsertPlaylist(playlist: PlaylistRow): void {

	const db = getDatabase();

	db
		.prepare(`
			INSERT INTO playlists (tidal_id, name)
			VALUES (@tidalId, @name)
			ON CONFLICT (tidal_id) DO UPDATE SET name = excluded.name
		`)
		.run(playlist);

};

export function upsertTrack(track: TrackRow): void {

	const db = getDatabase();
	db
		.prepare(`
			INSERT INTO tracks (tidal_id, isrc, title, artist, album, duration_s, raw)
			VALUES (@tidalId, @isrc, @title, @artist, @album, @durationS, @raw)
			ON CONFLICT (tidal_id) DO UPDATE SET
				isrc       = excluded.isrc,
				title      = excluded.title,
				artist     = excluded.artist,
				album      = excluded.album,
				duration_s = excluded.duration_s,
				raw        = excluded.raw
		`)
		.run(track);

};
 
export function replacePlaylistTracks(playlistId: string, rows: PlaylistTrackRow[]): void {

	const db = getDatabase();

	const remove = db.prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?");
	const insert = db.prepare(`
			INSERT INTO playlist_tracks (playlist_id, track_id, position)
			VALUES (@playlistId, @trackId, @position)
		`);

	const replaceAll = db.transaction(() => {
		remove.run(playlistId);
		for (const row of rows) {
			insert.run({ playlistId, trackId: row.trackId, position: row.position });
		};
	});

	replaceAll();

};

// Picks one Tidal track id for a recording, since a playlist item needs an
// id and an ISRC can have several (album, single, compilation...).
export function resolveTidalId(isrc: string): string | null {

	const row = getDatabase()
		.prepare("SELECT tidal_id AS tidalId FROM tracks WHERE isrc = ? LIMIT 1")
		.get(isrc) as { tidalId: string } | undefined;

	return row?.tidalId ?? null;

};

export type ResolvedTrack = { isrc: string; title: string; artist: string | null };

// Accepts either a Tidal track id or an exact (case-insensitive) title, since
// that is what's easy to copy out of the Tidal app.
export function resolveIsrc(input: string): ResolvedTrack {

	const db = getDatabase();

	const byId = db
		.prepare("SELECT isrc, title, artist FROM tracks WHERE tidal_id = ?")
		.get(input) as ResolvedTrack | undefined;

	if (byId) {
		if (!byId.isrc) throw new Error(`Track "${byId.title}" (${input}) has no ISRC, so it was never tagged or embedded.`);
		return byId;
	};

	const matches = db
		.prepare("SELECT DISTINCT isrc, title, artist FROM tracks WHERE title = ? COLLATE NOCASE AND isrc IS NOT NULL")
		.all(input) as ResolvedTrack[];

	if (matches.length === 0) throw new Error(`No track found matching "${input}".`);

	if (matches.length > 1) {
		const names = matches.map((m) => `${m.title} — ${m.artist ?? "unknown"} (${m.isrc})`).join("\n  ");
		throw new Error(`Multiple tracks match "${input}", use the Tidal id instead:\n  ${names}`);
	};

	return matches[0]!;

};