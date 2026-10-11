import { type PlaylistRow, type PlaylistTrackRow, replacePlaylistTracks, type TrackRow, upsertPlaylist, upsertTrack } from "../db/library.js";
import { paginate, type Resource } from "./client.js";

export type SyncSummary = {
	playlists: number;
	tracks: number;
	uniqueIsrcs: number;
	skipped: number;
};

export async function syncLibrary(options: { playlist?: string }): Promise<SyncSummary> {

	const first = "/userCollectionPlaylists/me/relationships/items?include=items";
	const wanted = options.playlist?.toLowerCase();
	const playlists: PlaylistRow[] = [];

	for await (const page of paginate(first)) {
		for (const item of page.included ?? []) {

			if (item.type !== "playlists") continue;

			const name = String(item.attributes?.name ?? "");
			if (wanted && name.toLowerCase() !== wanted) continue;
			playlists.push({ tidalId: item.id, name });

		};
	};

	if (wanted && playlists.length === 0) {
		throw new Error(`No playlist named "${options.playlist}" in your Tidal library.`);
	};

	const summary = {
		playlists: 0,
		skipped: 0,
	};

	const isrcs = new Set<string>();
	const trackIds = new Set<string>();

	for (const playlist of playlists) {

		upsertPlaylist(playlist);
		summary.playlists++;

		const rows: PlaylistTrackRow[] = [];
		let position = 0;

		const first = `/playlists/${playlist.tidalId}/relationships/items?include=items,items.artists`;

		for await (const page of paginate(first)) {

			const byKey = new Map(
				(page.included ?? []).map((item) => [`${item.type}:${item.id}`, item])
			);

			for (const ref of page.data ?? []) {

				const track = ref.type === "tracks" ? byKey.get(`tracks:${ref.id}`) : undefined;
				if (!track) {
					summary.skipped++;
					continue;
				};

				const row = toTrackRow(track, byKey);
				upsertTrack(row);
				rows.push({ trackId: row.tidalId, position: position++ });

				trackIds.add(row.tidalId);
				if (row.isrc) isrcs.add(row.isrc);

			};

		};

		replacePlaylistTracks(playlist.tidalId, rows);

	};

	return {
		...summary,
		tracks: trackIds.size,
		uniqueIsrcs: isrcs.size
	};

};

function parseDuration(value: unknown): number | null {

	const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(String(value ?? ""));
	if (!match) return null;
	const [, h = "0", m = "0", s = "0"] = match;

	return Math.round(Number(h) * 3600 + Number(m) * 60 + Number(s));

};

function toTrackRow(track: Resource, included: Map<string, Resource>): TrackRow {

	const artists: string[] = [];
	for (const ref of track.relationships?.artists?.data ?? []) {
		const name = included.get(`artists:${ref.id}`)?.attributes?.name;
		if (name) artists.push(String(name));
	};

	const isrc = track.attributes?.isrc;

	return {
		tidalId: track.id,
		isrc: isrc ? String(isrc) : null,
		title: String(track.attributes?.title ?? ""),
		artist: artists.length ? artists.join(", ") : null,
		album: null,
		durationS: parseDuration(track.attributes?.duration),
		raw: JSON.stringify(track)
	};

};