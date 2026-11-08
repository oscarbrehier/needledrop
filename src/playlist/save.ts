import { resolveTidalId } from "../db/library.js";
import { saveGeneratedPlaylist } from "../db/playlists.js";
import { type ParsedPrompt } from "../search/parse.js";
import { AddItemsError, addItems, buildPlaylistDescription, createPlaylist, defaultPlaylistName } from "../tidal/playlists.js";

export type SavePlaylistInput = {
	name?: string;
	prompt: string;
	filters: ParsedPrompt;
	isrcs: string[];
};

export type SavedPlaylist = {
	tidalId: string;
	name: string;
	trackCount: number;
};

export async function savePlaylist({ name, prompt, filters, isrcs }: SavePlaylistInput): Promise<SavedPlaylist> {

	const trackIds = isrcs
		.map((isrc) => resolveTidalId(isrc))
		.filter((id): id is string => id !== null);

	if (trackIds.length === 0) throw new Error("Nothing to save: none of the matched tracks resolved to a Tidal id.");

	const playlistName = name ?? defaultPlaylistName(prompt);
	const tidalId = await createPlaylist(playlistName, buildPlaylistDescription(prompt));

	// Recorded before any items go in, so a playlist left half-filled by a failed
	// addItems is still known as ours and sync won't import it into the library.
	saveGeneratedPlaylist({ tidalId, prompt, filters, trackIds: isrcs });

	try {
		await addItems(tidalId, trackIds);
	} catch (err) {
		if (!(err instanceof AddItemsError)) throw err;
		throw new Error(`Created "${playlistName}" in Tidal (${tidalId}), but only ${err.added} of ${err.total} tracks were added before a request failed: ${err.cause instanceof Error ? err.cause.message : String(err.cause)}`, { cause: err });
	};

	return { tidalId, name: playlistName, trackCount: trackIds.length };

};
