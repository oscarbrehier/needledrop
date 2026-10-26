import { type ParsedPrompt } from "../search/parse.js";
import { getDatabase } from "./client.js";

export type GeneratedPlaylist = {
	tidalId: string;
	prompt: string;
	filters: ParsedPrompt;
	trackIds: string[];
};

export function saveGeneratedPlaylist(playlist: GeneratedPlaylist): void {

	getDatabase()
		.prepare(`
			INSERT INTO generated_playlists (tidal_id, prompt, filters, track_ids)
			VALUES (@tidalId, @prompt, @filters, @trackIds)
			ON CONFLICT (tidal_id) DO NOTHING
		`)
		.run({
			tidalId: playlist.tidalId,
			prompt: playlist.prompt,
			filters: JSON.stringify(playlist.filters),
			trackIds: JSON.stringify(playlist.trackIds)
		});

};

// Used by sync to leave needledrop's own playlists out of the library it mirrors.
export function getGeneratedPlaylistIds(): Set<string> {

	const rows = getDatabase()
		.prepare("SELECT tidal_id AS tidalId FROM generated_playlists")
		.all() as { tidalId: string }[];

	return new Set(rows.map((row) => row.tidalId));

};
