import { createHash } from "node:crypto";
import process from "node:process";
import { getEmbeddingHashes, saveEmbedding, selectTaggedRecordings } from "../db/embeddings.js";
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
		return { isrc: r.isrc, text, textHash: hash(text) };
	});

	const pending = candidates.filter((c) => existingHashes.get(c.isrc) !== c.textHash);
	const skipped = candidates.length - pending.length;

	const batches = chunk(pending, BATCH_SIZE);

	for (const [i, batch] of batches.entries()) {

		process.stderr.write(`\rEmbedding batch ${i + 1}/${batches.length}`.padEnd(40));

		const vectors = await embed(batch.map((c) => c.text));
		batch.forEach((c, j) => saveEmbedding(c.isrc, vectors[j]!, MODEL, c.textHash));

	};

	if (batches.length) process.stderr.write("\n");
	return { embedded: pending.length, skipped };

};
