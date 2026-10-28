import { createHash } from "node:crypto";
import { getEmbeddingHashes, saveEmbedding, selectTaggedRecordings } from "../db/embeddings.js";
import { Progress } from "../utils/progress.js";
import { embed } from "./embedder.js";
import { buildEmbeddingText } from "./text.js";

const MODEL = "Xenova/bge-m3";
const BATCH_SIZE = 24;

function hash(text: string): string {
	return createHash("sha1").update(text).digest("hex");
};

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
};

export type EmbedSummary = { embedded: number; skipped: number };

export async function embedAll(): Promise<EmbedSummary> {

	const recordings = selectTaggedRecordings();
	const existingHashes = getEmbeddingHashes();

	const candidates = recordings.map((r) => {
		const text = buildEmbeddingText(r.tags);
		return { isrc: r.isrc, title: r.title, text, textHash: hash(text) };
	});

	const pending = candidates.filter((c) => existingHashes.get(c.isrc) !== c.textHash);
	const skipped = candidates.length - pending.length;

	const progress = new Progress("embed", pending.length);
	const counts = { embedded: 0 };
	let done = 0;

	for (const batch of chunk(pending, BATCH_SIZE)) {

		try {

			const vectors = await embed(batch.map((c) => c.text));

			batch.forEach((c, j) => {
				saveEmbedding(c.isrc, vectors[j]!, MODEL, c.textHash);
				counts.embedded++;
				done++;
				progress.update(done, c.title, counts);
			});

		} catch (err) {

			progress.error(`embed batch failed: ${err instanceof Error ? err.message : err}`);
			done += batch.length;
			progress.update(done, batch.at(-1)?.title ?? "", counts);

		};

	};

	progress.finish();
	return { embedded: counts.embedded, skipped };

};
