import process from "node:process";
import { type RecordingToTag, saveTags, selectRecordingsToTag } from "../db/tags.js";
import { sleep } from "../utils/sleep.js";
import { buildTrackInput, type TrackInput } from "./input.js";
import { MODEL, tagBatch } from "./mistral.js";
import { PROMPT_VERSION, buildMessages } from "./prompt.js";
import { TaggedTrack, type Tags } from "./schema.js";

const BATCH_SIZE = 20;
const TOKEN_BUDGET_PER_MINUTE = 20_000;
const WINDOW_MS = 60_000;
const MIN_INTERVAL_MS = 1000;

export type TagSummary = { tagged: number; failed: number; skipped: number };

export function selectCandidates(
	rows: RecordingToTag[],
	options: { limit?: number; retag?: boolean },
): { toTag: RecordingToTag[]; skipped: number } {

	const toTag: RecordingToTag[] = [];
	let skipped = 0;

	for (const row of rows) {

		const needsTag = options.retag
			? row.taggedPromptVersion === null || row.taggedPromptVersion !== PROMPT_VERSION
			: row.taggedPromptVersion === null;

		if (!needsTag) {
			skipped++;
			continue;
		};

		toTag.push(row);
		if (options.limit && toTag.length >= options.limit) break;

	};

	return { toTag, skipped };

};

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
};

// Rough token estimate (input chars / 4, plus a per-track allowance for the
// structured JSON answer). 1 request/sec alone would blow through the
// 20,000-tokens/minute cap on a 20-track batch, so pacing is token-aware, not
// just rate-aware.
function estimateTokens(tracks: TrackInput[], promptVersion?: string): number {
	return Math.ceil(JSON.stringify(buildMessages(tracks, promptVersion)).length / 4) + tracks.length * 90;
};

type Usage = { at: number; tokens: number };

async function pace(usage: Usage[], estimated: number): Promise<void> {

	const now = Date.now();
	while (usage[0] && now - usage[0].at > WINDOW_MS) usage.shift();

	const used = usage.reduce((sum, u) => sum + u.tokens, 0);
	const oldest = usage[0];
	const last = usage.at(-1);

	const waitForBudget = oldest && used + estimated > TOKEN_BUDGET_PER_MINUTE
		? WINDOW_MS - (now - oldest.at)
		: 0;
	const waitForRate = last ? MIN_INTERVAL_MS - (now - last.at) : 0;

	const wait = Math.max(waitForBudget, waitForRate, 0);
	if (wait > 0) await sleep(wait);

};

function indexByIsrc(raw: unknown): Map<string, unknown> {

	const byIsrc = new Map<string, unknown>();
	const results = (raw as { results?: unknown[] } | null)?.results;

	if (Array.isArray(results)) {
		for (const item of results) {
			const isrc = (item as { isrc?: unknown } | null)?.isrc;
			if (typeof isrc === "string") byIsrc.set(isrc, item);
		};
	};

	return byIsrc;

};

async function call(
	usage: Usage[],
	tracks: TrackInput[],
	options: { model?: string; promptVersion?: string },
): Promise<Map<string, unknown>> {

	const estimated = estimateTokens(tracks, options.promptVersion);
	await pace(usage, estimated);

	const raw = await tagBatch(tracks, options);
	usage.push({ at: Date.now(), tokens: estimated });

	return indexByIsrc(raw);

};

function validate(candidate: unknown): Tags | undefined {

	if (candidate === undefined) return undefined;

	const parsed = TaggedTrack.safeParse(candidate);
	if (!parsed.success) return undefined;

	const { isrc: _isrc, ...tags } = parsed.data;
	return tags;

};

// Sends every row through the model in batches of BATCH_SIZE, retrying a row
// once on its own if it is missing from the answer or fails validation.
// Returns only the rows that ended up with valid tags; a row missing from the
// result failed twice and should be treated as failed by the caller.
export async function tagAll(
	rows: RecordingToTag[],
	options: { model?: string; promptVersion?: string } = {},
): Promise<Map<string, Tags>> {

	const results = new Map<string, Tags>();
	const usage: Usage[] = [];
	const batches = chunk(rows, BATCH_SIZE);

	for (const [i, batch] of batches.entries()) {

		process.stderr.write(`\rTagging batch ${i + 1}/${batches.length}`.padEnd(40));

		const inputs = batch.map(buildTrackInput);
		const byIsrc = await call(usage, inputs, options);

		const retry: RecordingToTag[] = [];
		for (const row of batch) {
			const tags = validate(byIsrc.get(row.isrc));
			if (tags) results.set(row.isrc, tags);
			else retry.push(row);
		};

		for (const row of retry) {
			const single = await call(usage, [buildTrackInput(row)], options);
			const tags = validate(single.get(row.isrc));
			if (tags) results.set(row.isrc, tags);
		};

	};

	if (batches.length) process.stderr.write("\n");
	return results;

};

export async function runTagging(options: {
	playlist?: string;
	limit?: number;
	retag?: boolean;
}): Promise<TagSummary> {

	const rows = selectRecordingsToTag({ playlist: options.playlist });
	const { toTag, skipped } = selectCandidates(rows, options);

	const results = await tagAll(toTag);

	let tagged = 0;
	let failed = 0;

	for (const row of toTag) {

		const tags = results.get(row.isrc);
		if (tags) {
			saveTags(row.isrc, tags, MODEL, PROMPT_VERSION);
			tagged++;
		} else {
			failed++;
		};

	};

	return { tagged, failed, skipped };

};
