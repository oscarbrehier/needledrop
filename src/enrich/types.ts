import { EnrichTrack } from "../db/enrichment.js";

export interface Enricher {
	source: string;
	intervalMs: number;
	lookup(track: EnrichTrack): Promise<unknown | null>;
	// Optional: lets the runner send up to batchSize tracks per call instead
	// of one, keyed back by isrc. lookup must still work alone (used as the
	// fallback for a single retried track).
	lookupBatch?(tracks: EnrichTrack[]): Promise<Map<string, unknown | null>>;
	batchSize?: number;
};