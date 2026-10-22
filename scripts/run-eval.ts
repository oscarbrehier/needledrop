import { writeFileSync } from "node:fs";
import process from "node:process";
import { hasLastfmWiki, selectRecordingsToTag } from "../src/db/tags";
import { loadIsrcList, loadLabels, printSummary, scoreTrack, summarize } from "../src/tag/evaluate";
import { tagAll } from "../src/tag/run";

// Tags the labelled tracks under a given prompt version and model, without
// touching the tags table, and snapshots the answers so they can be re-scored
// later or compared against another run without re-calling the model.
const [promptVersion, model] = process.argv.slice(2);

if (!promptVersion || !model) {
	console.error("Usage: tsx --env-file=.env scripts/run-eval.ts <promptVersion> <model>");
	process.exit(1);
};

const labels = loadLabels("tests/fixtures/labels.csv");
const holdoutIsrcs = loadIsrcList("tests/fixtures/holdout.csv");

const rows = selectRecordingsToTag({ playlist: "needledrop labels" });
const byIsrc = new Map(rows.map((r) => [r.isrc, r]));

const candidates = labels
	.map((label) => byIsrc.get(label.isrc))
	.filter((row): row is NonNullable<typeof row> => row !== undefined);

console.error(`Tagging ${candidates.length} tracks with ${model} (prompt ${promptVersion}, not saved to the tags table)`);

const results = await tagAll(candidates, { model, promptVersion });

const outPath = `tests/runs/${promptVersion}-${model}.json`;
writeFileSync(outPath, JSON.stringify({
	promptVersion,
	model,
	temperature: 0,
	taggedAt: new Date().toISOString(),
	tags: Object.fromEntries(results),
}, null, 2));

console.log(`Wrote ${results.size} results to ${outPath}`);

const checks = labels.map((row) => scoreTrack(row, results.get(row.isrc) ?? null, hasLastfmWiki(row.isrc)));
const tuning = checks.filter((c) => !holdoutIsrcs.has(c.row.isrc));

printSummary(`${promptVersion} / ${model} — tuning`, summarize(tuning));
