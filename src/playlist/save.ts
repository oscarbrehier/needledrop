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

// The playlist exists in Tidal but holds only some of its tracks. Callers should
// point at that playlist rather than retry, which would create a second one.
export class PartialSaveError extends Error {

	readonly added: number;
	readonly total: number;

	constructor(readonly tidalId: string, readonly playlistName: string, error: AddItemsError) {
		const reason = error.cause instanceof Error ? error.cause.message : String(error.cause);
		super(`Created "${playlistName}" in Tidal (${tidalId}), but only ${error.added} of ${error.total} tracks were added before a request failed: ${reason}`, { cause: error });
		this.name = "PartialSaveError";
		this.added = error.added;
		this.total = error.total;
	};

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
		throw new PartialSaveError(tidalId, playlistName, err);
	};

	return { tidalId, name: playlistName, trackCount: trackIds.length };

};
