import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { type Tags } from "./schema.js";

export type LabelRow = {
	isrc: string;
	title: string;
	artist: string;
	language: string;
	moods: string;
	energy: string;
};

export type Check = {
	row: LabelRow;
	wiki: boolean;
	languagesPass: boolean;
	energyExact: boolean;
	energyWithinOne: boolean;
	moodsPass: boolean;
	pass: boolean;
	handLanguages: string[];
	handMoods: string[];
	handEnergy: number;
	modelLanguages?: string[];
	modelMoods?: string[];
	modelEnergy?: number;
};

export type Summary = {
	total: number;
	languages: number;
	energyExact: number;
	energyWithinOne: number;
	moods: number;
	pass: number;
};

export function loadLabels(path: string): LabelRow[] {
	return parse(readFileSync(path, "utf-8"), { columns: true, skip_empty_lines: true }) as LabelRow[];
};

export function loadIsrcList(path: string): Set<string> {
	const rows = parse(readFileSync(path, "utf-8"), { columns: true, skip_empty_lines: true }) as { isrc: string }[];
	return new Set(rows.map((r) => r.isrc));
};

function splitField(value: string): string[] {
	return (value ?? "").split("|").map((v) => v.trim().toLowerCase()).filter(Boolean);
};

function sameSet(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	const set = new Set(a);
	return b.every((v) => set.has(v));
};

export function scoreTrack(row: LabelRow, tags: Tags | null, wiki: boolean): Check {

	const handLanguages = splitField(row.language);
	const handMoods = splitField(row.moods);
	const handEnergy = Number(row.energy);

	if (!tags) {
		return {
			row,
			wiki,
			languagesPass: false,
			energyExact: false,
			energyWithinOne: false,
			moodsPass: false,
			pass: false,
			handLanguages,
			handMoods,
			handEnergy,
		};
	};

	const languagesPass = sameSet(handLanguages, tags.languages);
	const energyExact = handEnergy === tags.energy;
	const energyWithinOne = Math.abs(handEnergy - tags.energy) <= 1;
	const moodsPass = handMoods.some((m) => (tags.moods as string[]).includes(m));

	return {
		row,
		wiki,
		languagesPass,
		energyExact,
		energyWithinOne,
		moodsPass,
		pass: languagesPass && energyWithinOne && moodsPass,
		handLanguages,
		handMoods,
		handEnergy,
		modelLanguages: tags.languages,
		modelMoods: tags.moods,
		modelEnergy: tags.energy,
	};

};

export function summarize(checks: Check[]): Summary {
	return {
		total: checks.length,
		languages: checks.filter((c) => c.languagesPass).length,
		energyExact: checks.filter((c) => c.energyExact).length,
		energyWithinOne: checks.filter((c) => c.energyWithinOne).length,
		moods: checks.filter((c) => c.moodsPass).length,
		pass: checks.filter((c) => c.pass).length,
	};
};

export function printSummary(label: string, summary: Summary): void {
	console.log(`${label}: ${summary.pass}/${summary.total} passing ` +
		`(languages ${summary.languages}/${summary.total}, ` +
		`energy±1 ${summary.energyWithinOne}/${summary.total}, ` +
		`moods ${summary.moods}/${summary.total})`);
};
