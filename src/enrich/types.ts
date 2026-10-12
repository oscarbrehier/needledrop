import { EnrichTrack } from "../db/enrichment.js";

export interface Enricher {
	source: string;
	intervalMs: number;
	lookup(track: EnrichTrack): Promise<unknown | null>;
};