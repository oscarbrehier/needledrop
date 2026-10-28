import {
	getPlaylistTracks, listSyncedPlaylists, type PlaylistRow, type PlaylistTrackRow,
	replacePlaylistTracks, type TrackRow, upsertPlaylist, upsertTrack,
} from "../db/library.js";
import { getGeneratedPlaylistIds } from "../db/playlists.js";
import { buildArtistField } from "./artists.js";
import { paginate, type Resource } from "./client.js";

export type SyncSummary = {
	playlists: number;
	unchanged: number;
	tracks: number;
	uniqueIsrcs: number;
	skipped: number;
	missing: string[];
};

export async function syncLibrary(options: { playlist?: string; full?: boolean }): Promise<SyncSummary> {

	const first = "/userCollectionPlaylists/me/relationships/items?include=items";
	const wanted = options.playlist?.toLowerCase();
	const generatedIds = getGeneratedPlaylistIds();
	const playlists: PlaylistRow[] = [];
	const seenIds = new Set<string>();

	for await (const page of paginate(first)) {
		for (const item of page.included ?? []) {

			if (item.type !== "playlists") continue;
			if (generatedIds.has(item.id)) continue;

			seenIds.add(item.id);

			const name = String(item.attributes?.name ?? "");
			if (wanted && name.toLowerCase() !== wanted) continue;

			const lastModifiedAt = item.attributes?.lastModifiedAt;
			playlists.push({ tidalId: item.id, name, lastModifiedAt: lastModifiedAt ? String(lastModifiedAt) : null });

		};
	};

	if (wanted && playlists.length === 0) {
		throw new Error(`No playlist named "${options.playlist}" in your Tidal library.`);
	};

	const previouslySynced = listSyncedPlaylists();

	const summary = {
		playlists: 0,
		unchanged: 0,
		skipped: 0,
		// Only reported on a full-library sync: scoping to one playlist says
		// nothing about whether the others are still in the collection.
		missing: wanted ? [] : [...previouslySynced.values()]
			.filter((p) => !seenIds.has(p.tidalId))
			.map((p) => p.name),
	};

	const isrcs = new Set<string>();
	const trackIds = new Set<string>();

	for (const playlist of playlists) {

		upsertPlaylist(playlist);
		summary.playlists++;

		const previous = previouslySynced.get(playlist.tidalId);
		const unchanged = !options.full && previous !== undefined &&
			previous.lastModifiedAt !== null && previous.lastModifiedAt === playlist.lastModifiedAt;

		if (unchanged) {

			summary.unchanged++;
			for (const { trackId, isrc } of getPlaylistTracks(playlist.tidalId)) {
				trackIds.add(trackId);
				if (isrc) isrcs.add(isrc);
			};
			continue;

		};

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
		// Trim only the ends: some Tidal names use deliberate internal double
		// spaces (e.g. "No  Limit", "J A Y  E L E C T R O N I C A").
		if (name) artists.push(String(name).trim());
	};

	const isrc = track.attributes?.isrc;

	return {
		tidalId: track.id,
		isrc: isrc ? String(isrc) : null,
		title: String(track.attributes?.title ?? ""),
		artist: buildArtistField(artists),
		album: null,
		durationS: parseDuration(track.attributes?.duration),
		raw: JSON.stringify(track)
	};

};