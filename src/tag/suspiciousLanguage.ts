import { getDatabase } from "../db/client.js";
import { type Tags } from "./schema.js";

// Recordings tagged with a sung language whose ReccoBeats instrumentalness is
// 0.5 or higher — the pattern prompt v3 targets (nationality isn't language).
const INSTRUMENTALNESS_THRESHOLD = 0.5;

export type SuspiciousRecording = {
	isrc: string;
	title: string;
	artist: string | null;
	tags: Tags;
	lastfm: string | null;
	musicbrainz: string | null;
	reccobeats: string | null;
	instrumentalness: number;
};

type Row = {
	isrc: string;
	title: string;
	artist: string | null;
	payload: string;
	reccobeats: string | null;
	lastfm: string | null;
	musicbrainz: string | null;
};

export function findSuspiciousLanguageRecordings(): SuspiciousRecording[] {

	const rows = getDatabase().prepare(`
		SELECT
			t.isrc, t.title, t.artist, tg.payload,
			rb.payload AS reccobeats, lf.payload AS lastfm, mb.payload AS musicbrainz
		FROM tags tg
		JOIN tracks t ON t.isrc = tg.isrc
		LEFT JOIN enrichment rb ON rb.track_id = t.tidal_id AND rb.source = 'reccobeats'
		LEFT JOIN enrichment lf ON lf.track_id = t.tidal_id AND lf.source = 'lastfm'
		LEFT JOIN enrichment mb ON mb.track_id = t.tidal_id AND mb.source = 'musicbrainz'
		GROUP BY t.isrc
	`).all() as Row[];

	const result: SuspiciousRecording[] = [];

	for (const row of rows) {

		const tags = JSON.parse(row.payload) as Tags;
		const sungLanguages = tags.languages.filter((l) => l !== "instrumental" && l !== "unknown");
		if (sungLanguages.length === 0) continue;

		let instrumentalness: number | undefined;

		try {
			const content = (JSON.parse(row.reccobeats ?? "null") as { content?: { instrumentalness?: number }[] } | null)?.content;
			instrumentalness = content?.[0]?.instrumentalness;
		} catch {
			continue;
		};

		if (typeof instrumentalness === "number" && instrumentalness >= INSTRUMENTALNESS_THRESHOLD) {
			result.push({
				isrc: row.isrc,
				title: row.title,
				artist: row.artist,
				tags,
				lastfm: row.lastfm,
				musicbrainz: row.musicbrainz,
				reccobeats: row.reccobeats,
				instrumentalness,
			});
		};

	};

	return result;

};
