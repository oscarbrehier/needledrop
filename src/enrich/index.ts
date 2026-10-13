import { lastfm } from "./lastfm.js";
import { musicbrainz } from "./musicbrainz.js";
import { type Enricher } from "./types.js";

const enrichers: Enricher[] = [lastfm, musicbrainz];

export function getEnricher(name: string): Enricher {

	const enricher = enrichers.find((e) => e.source === name);
	if (!enricher) {

		const known = enrichers.map((e) => e.source).join(", ");
		throw new Error(`Unknown source: ${name}. Available: ${known}`);

	};

	return enricher;

};