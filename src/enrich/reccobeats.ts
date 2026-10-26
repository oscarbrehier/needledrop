import { EnrichTrack } from "../db/enrichment.js";
import { Enricher } from "./types.js";

const API_URL = "https://api.reccobeats.com/v1";

// Confirmed live (their docs are a JS-rendered page with no schema): 40 ids
// per request succeeds, 41 returns 400, and an id with no match is just
// absent from "content" rather than causing an error.
const BATCH_SIZE = 40;

export const reccobeats: Enricher = {
	source: "reccobeats",
	intervalMs: 500,
	lookup: (track) => lookupReccobeatsBatch([track]).then((results) => results.get(track.isrc ?? "") ?? null),
	lookupBatch: lookupReccobeatsBatch,
	batchSize: BATCH_SIZE,
};

type FeaturesResponse = { content?: { isrc?: string }[] };

export async function lookupReccobeatsBatch(tracks: EnrichTrack[]): Promise<Map<string, unknown | null>> {

	const results = new Map<string, unknown | null>();
	const isrcs = tracks.map((t) => t.isrc).filter((isrc): isrc is string => Boolean(isrc));

	if (isrcs.length === 0) return results;

	const url = new URL(`${API_URL}/audio-features`);
	url.searchParams.set("ids", isrcs.join(","));

	const res = await fetch(url, {
		headers: { Accept: "application/json" }
	});

	if (res.status === 404) return results;
	if (!res.ok) {
		throw new Error(`ReccoBeats request failed (${res.status}): ${await res.text()}`);
	};

	const data = (await res.json()) as FeaturesResponse;
	const byIsrc = new Map<string, { isrc?: string }[]>();

	for (const entry of data.content ?? []) {
		if (!entry.isrc) continue;
		const group = byIsrc.get(entry.isrc) ?? [];
		group.push(entry);
		byIsrc.set(entry.isrc, group);
	};

	for (const isrc of isrcs) {
		const content = byIsrc.get(isrc);
		results.set(isrc, content?.length ? { content } : null);
	};

	return results;

};
