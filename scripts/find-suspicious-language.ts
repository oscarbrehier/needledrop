import { buildTrackInput } from "../src/tag/input";
import { buildMessages } from "../src/tag/prompt";
import { findSuspiciousLanguageRecordings } from "../src/tag/suspiciousLanguage";

// Read-only: prints the list and an estimated re-tag cost, does not call the
// model or touch the tags table.
const BATCH_SIZE = 20;

const suspicious = findSuspiciousLanguageRecordings();

console.log(`${suspicious.length} tagged recordings look suspicious:\n`);

for (const row of suspicious) {
	console.log(`${row.title} — ${row.artist ?? "unknown"} | languages: ${row.tags.languages.join(", ")}`);
};

const inputs = suspicious.map((row) => buildTrackInput({
	isrc: row.isrc,
	title: row.title,
	artist: row.artist,
	lastfm: row.lastfm,
	musicbrainz: row.musicbrainz,
	reccobeats: row.reccobeats,
	taggedPromptVersion: null,
}));

let estimatedTokens = 0;
for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
	const batch = inputs.slice(i, i + BATCH_SIZE);
	estimatedTokens += Math.ceil(JSON.stringify(buildMessages(batch, "v3")).length / 4) + batch.length * 90;
};

// mistral-small-2603: ~$0.15 / million input tokens, ~$0.60 / million output
// tokens (figure found via web search, not confirmed against Mistral's own
// pricing page, which wasn't reachable). Most of this estimate is input
// tokens (the evidence payload repeats every batch), so this treats the
// whole estimate as input-priced, which is already the more conservative
// (higher) of the two rates for a rough bound.
const estimatedCostUsd = (estimatedTokens / 1_000_000) * 0.60;

console.log(`\nEstimated tokens: ~${estimatedTokens.toLocaleString()}`);
console.log(`Estimated cost: ~$${estimatedCostUsd.toFixed(3)} (rough, unconfirmed pricing)`);
