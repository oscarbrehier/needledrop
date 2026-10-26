import PQueue from "p-queue";
import { saveEnrichment, selectPendingTracks, type EnrichTrack } from "../db/enrichment.js";
import { Progress } from "../utils/progress.js";
import { type Enricher } from "./types.js";

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
};

export async function runEnricher(enricher: Enricher, options: { limit?: number }) {

	const tracks = selectPendingTracks(enricher.source, options.limit);
	const queue = new PQueue({ concurrency: 1, interval: enricher.intervalMs, intervalCap: 1 });
	const progress = new Progress(enricher.source, tracks.length);

	const summary = {
		found: 0,
		notFound: 0,
		failed: 0
	};

	let done = 0;

	function record(track: EnrichTrack, payload: unknown | null) {

		saveEnrichment(track.tidalId, enricher.source, payload);

		if (payload === null || payload === undefined) summary.notFound++;
		else summary.found++;

		done++;
		progress.update(done, track.title, summary);

	};

	if (enricher.lookupBatch && enricher.batchSize) {

		for (const batch of chunk(tracks, enricher.batchSize)) {

			try {

				const results = await queue.add(() => enricher.lookupBatch!(batch));
				for (const track of batch) record(track, results.get(track.isrc ?? "") ?? null);

			} catch (err) {

				progress.error(`${enricher.source} batch failed: ${err instanceof Error ? err.message : err}`);
				summary.failed += batch.length;
				done += batch.length;
				progress.update(done, batch.at(-1)?.title ?? "", summary);

			};

		};

	} else {

		for (const track of tracks) {

			try {
				record(track, await queue.add(() => enricher.lookup(track)));
			} catch (err) {
				summary.failed++;
				done++;
				progress.error(`${enricher.source} failed for "${track.title}": ${err instanceof Error ? err.message : err}`);
				progress.update(done, track.title, summary);
			};

		};

	};

	progress.finish();
	return summary;

};
