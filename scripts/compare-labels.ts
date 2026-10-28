import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { hasLastfmWiki } from "../src/db/tags";
import { type Check, loadIsrcList, loadLabels, printSummary, scoreTrack, summarize } from "../src/tag/evaluate";
import { type Tags } from "../src/tag/schema";

const args = process.argv.slice(2);
const showHoldout = args.includes("--show-holdout");
const runPath = args.find((a) => !a.startsWith("--"));

if (!runPath) {
	console.error("Usage: tsx scripts/compare-labels.ts <run-file.json> [--show-holdout]");
	process.exit(1);
};

type Run = { promptVersion: string; model: string; tags: Record<string, Tags> };
const run = JSON.parse(readFileSync(runPath, "utf-8")) as Run;

const labels = loadLabels("tests/fixtures/labels.csv");
const holdoutIsrcs = loadIsrcList("tests/fixtures/holdout.csv");

const checks: Check[] = labels.map((row) =>
	scoreTrack(row, run.tags[row.isrc] ?? null, hasLastfmWiki(row.isrc)));

const tuning = checks.filter((c) => !holdoutIsrcs.has(c.row.isrc));
const holdout = checks.filter((c) => holdoutIsrcs.has(c.row.isrc));

console.log(`${run.promptVersion} / ${run.model}`);
printSummary("Tuning", summarize(tuning));

// The holdout is only looked at once tuning is done, so it stays out of
// routine output unless asked for.
if (showHoldout) {
	printSummary("Holdout", summarize(holdout));
	printSummary("Overall", summarize(checks));
};

function csvField(value: string): string {
	return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};

const scope = showHoldout ? checks : tuning;
const disagreements = scope.filter((c) => !c.pass);

const header = ["isrc", "title", "artist", "set", "hand_language", "hand_moods", "hand_energy",
	"model_language", "model_moods", "model_energy", "verdict"];

const lines = [header.join(",")];

for (const c of disagreements) {
	lines.push([
		c.row.isrc,
		c.row.title,
		c.row.artist,
		holdoutIsrcs.has(c.row.isrc) ? "holdout" : "tuning",
		c.handLanguages.join("|"),
		c.handMoods.join("|"),
		String(c.handEnergy),
		c.modelLanguages?.join("|") ?? "(not tagged)",
		c.modelMoods?.join("|") ?? "",
		c.modelEnergy !== undefined ? String(c.modelEnergy) : "",
		"",
	].map(csvField).join(","));
};

writeFileSync("tests/fixtures/disagreements.csv", lines.join("\n") + "\n");
console.log(`\nWrote ${disagreements.length} disagreements to tests/fixtures/disagreements.csv`);
