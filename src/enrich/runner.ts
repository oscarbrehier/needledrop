import PQueue from "p-queue";
import { saveEnrichment, selectPendingTracks } from "../db/enrichment.js";
import { type Enricher } from "./types.js";

export async function runEnricher(enricher: Enricher, options: { limit?: number }) {

	const tracks = selectPendingTracks(enricher.source, options.limit);
	const queue = new PQueue({ concurrency: 1, interval: enricher.intervalMs, intervalCap: 1 });

	const summary = {
		found: 0,
		notFound: 0,
		failed: 0
	};

	for (const track of tracks) {

		try {

			const payload = await queue.add(() => enricher.lookup(track));
			saveEnrichment(track.tidalId, enricher.source, payload);

			if (payload === null || payload === undefined) summary.notFound++;
			else summary.found++;

		} catch (err) {
			summary.failed++;
			console.error(`\n${enricher.source} failed for "${track.title}": ${err instanceof Error ? err.message : err}`);
		};

	};

	return summary;

};