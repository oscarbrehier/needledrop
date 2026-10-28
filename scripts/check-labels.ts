import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { MOODS } from "../src/tag/moods";

const rows = parse(readFileSync("tests/fixtures/labels.csv", "utf-8"), {
	columns: true,
	skip_empty_lines: true
}) as Record<string, string>[];

let problems = 0;

for (const row of rows) {

	const where = `${row.title} (${row.isrc})`;

	for (const mood of (row.moods ?? "").split("|")) {
		if (!(mood in MOODS)) {
			console.log(`${where}: unknown mood "${mood}"`);
			problems++;
		};
	};

	const energy = Number(row.energy);
	if (!Number.isInteger(energy) || energy < 1 || energy > 5) {
		console.log(`${where}: energy "${row.energy}" is not in the range of 1 to 5`);
		problems++;
	};

	if (!/^[a-z]+(\|[a-z]+)*$/.test(row.language ?? "")) {
		console.log(`${where}: language "${row.language}" is not lowercase words joined by |`);
		problems++;
	};

};

console.log(`${rows.length} rows checked, ${problems} problems`);