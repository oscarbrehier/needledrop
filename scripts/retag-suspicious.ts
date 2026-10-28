import { saveTags } from "../src/db/tags";
import { MODEL } from "../src/tag/mistral";
import { tagAll } from "../src/tag/run";
import { findSuspiciousLanguageRecordings } from "../src/tag/suspiciousLanguage";

const PROMPT_VERSION = "v3";

// Captures the current ("old") tags before any writes, since saveTags
// overwrites the row the moment each result comes in.
const suspicious = findSuspiciousLanguageRecordings();
console.error(`Re-tagging ${suspicious.length} suspicious recordings with prompt ${PROMPT_VERSION}, ${MODEL}.`);

const rows = suspicious.map((row) => ({
	isrc: row.isrc,
	title: row.title,
	artist: row.artist,
	lastfm: row.lastfm,
	musicbrainz: row.musicbrainz,
	reccobeats: row.reccobeats,
	taggedPromptVersion: null,
}));

const results = await tagAll(rows, {
	promptVersion: PROMPT_VERSION,
	onResult: (isrc, tags) => saveTags(isrc, tags, MODEL, PROMPT_VERSION),
});

const failed = suspicious.filter((row) => !results.has(row.isrc));
console.log(`\n${results.size} re-tagged, ${failed.length} failed.`);
if (failed.length) {
	console.log("Failed:", failed.map((row) => row.title).join(", "));
};

type Change = { title: string; artist: string | null };
const groups = new Map<string, Change[]>();
let unchanged = 0;

for (const row of suspicious) {

	const newTags = results.get(row.isrc);
	if (!newTags) continue;

	const oldLanguages = [...row.tags.languages].sort().join(", ");
	const newLanguages = [...newTags.languages].sort().join(", ");

	if (oldLanguages === newLanguages) {
		unchanged++;
		continue;
	};

	const key = `${oldLanguages}  ->  ${newLanguages}`;
	const group = groups.get(key) ?? [];
	group.push({ title: row.title, artist: row.artist });
	groups.set(key, group);

};

console.log(`${unchanged} unchanged.\n`);

for (const [key, tracks] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
	console.log(`${key}  (${tracks.length} tracks)`);
	for (const t of tracks) console.log(`  ${t.title} — ${t.artist ?? "unknown"}`);
	console.log("");
};
