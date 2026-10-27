import { getDatabase } from "../src/db/client";
import { buildTrackInput } from "../src/tag/input";
import { buildMessages } from "../src/tag/prompt";
import { type Tags } from "../src/tag/schema";

// Flags recordings tagged with a sung language whose ReccoBeats
// instrumentalness is 0.5 or higher — the pattern behind prompt v3 (nationality
// isn't language). Read-only: prints the list and an estimated re-tag cost,
// does not call the model or touch the tags table.
const INSTRUMENTALNESS_THRESHOLD = 0.5;
const BATCH_SIZE = 20;

type Row = {
	isrc: string;
	title: string;
	artist: string | null;
	payload: string;
	reccobeats: string | null;
	lastfm: string | null;
	musicbrainz: string | null;
};

const rows = getDatabase().prepare(`
	SELECT
		t.isrc, t.title, t.artist, tg.payload,
		rb.payload AS reccobeats, lf.payload AS lastfm, mb.payload AS musicbrainz
	FROM tags tg
	JOIN tracks t ON t.isrc = tg.isrc
	LEFT JOIN enrichment rb ON rb.track_id = t.tidal_id AND rb.source = 'reccobeats'
	LEFT JOIN enrichment lf ON lf.track_id = t.tidal_id AND lf.source = 'lastfm'
	LEFT JOIN enrichment mb ON mb.track_id = t.tidal_id AND mb.source = 'musicbrainz'
	GROUP BY t.isrc
`).all() as Row[];

const suspicious: Row[] = [];

for (const row of rows) {

	const tags = JSON.parse(row.payload) as Tags;
	const sungLanguages = tags.languages.filter((l) => l !== "instrumental" && l !== "unknown");
	if (sungLanguages.length === 0) continue;

	let instrumentalness: number | undefined;

	try {
		const content = (JSON.parse(row.reccobeats ?? "null") as { content?: { instrumentalness?: number }[] } | null)?.content;
		instrumentalness = content?.[0]?.instrumentalness;
	} catch {
		continue;
	};

	if (typeof instrumentalness === "number" && instrumentalness >= INSTRUMENTALNESS_THRESHOLD) {
		suspicious.push(row);
	};

};

console.log(`${suspicious.length} of ${rows.length} tagged recordings look suspicious:\n`);

for (const row of suspicious) {
	const tags = JSON.parse(row.payload) as Tags;
	console.log(`${row.title} — ${row.artist ?? "unknown"} | languages: ${tags.languages.join(", ")}`);
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
