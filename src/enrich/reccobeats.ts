import { EnrichTrack } from "../db/enrichment.js";
import { Enricher } from "./types.js";

const API_URL = "https://api.reccobeats.com/v1";

export const reccobeats: Enricher = {
	source: "reccobeats",
	intervalMs: 500,
	lookup: lookupReccobeats,
};

type FeaturesResponse = { content?: unknown[] };

export async function lookupReccobeats(track: EnrichTrack): Promise<unknown | null> {

	if (!track.isrc) return null;

	const url = new URL(`${API_URL}/audio-features`);
	url.searchParams.set("ids", track.isrc);

	const res = await fetch(url, {
		headers: {
			Accept: "application/json"
		}
	});

	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`ReccoBeats request failed (${res.status}): ${await res.text()}`);
	};

	const data = (await res.json()) as FeaturesResponse;
	return data.content?.length ? data : null;

};