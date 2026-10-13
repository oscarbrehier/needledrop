import { EnrichTrack } from "../db/enrichment.js";
import { primaryArtist } from "./clean.js";
import { Enricher } from "./types.js";

const API_URL = "https://musicbrainz.org/ws/2";
const USER_AGENT = "needledrop/0.1.0 ( https://github.com/oscarbrehier/needledrop )"

export const musicbrainz: Enricher = {
	source: "musicbrainz",
	intervalMs: 2200,
	lookup: lookupMusicbrainz
};

async function callMusicbrainz(path: string): Promise<unknown | null> {

	const res = await fetch(API_URL + path, {
		method: "GET",
		headers: {
			"User-Agent": USER_AGENT,
			Accept: "application/json"
		}
	});

	if (res.status === 404) return null;

	if (!res.ok) {
		const hint = res.status === 503 ? " (rate limited, will retry on the next run)" : "";
		throw new Error(`MusicBrainz request failed (${res.status})${hint}: ${await res.text()}`);
	};

	return res.json();

};

type IsrcResponse = { recordings?: { id: string }[] };

export async function lookupMusicbrainz(track: EnrichTrack): Promise<unknown | null> {

	if (!track.isrc) return null;

	const isrc = (await callMusicbrainz(`/isrc/${track.isrc}?fmt=json`)) as IsrcResponse | null;
	const recordingId = isrc?.recordings?.[0]?.id;
	if (!recordingId) return null;

	const recording = await callMusicbrainz(
		`/recording/${recordingId}?inc=genres+tags+artist-credits&fmt=json`,
	);

	return { isrc, recording };

};