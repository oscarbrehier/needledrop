import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlaylist } from "../src/search/builder.js";
import { type Candidate } from "../src/search/query.js";

let nextIsrc = 0;

function candidate(title: string, artist: string | null, overrides: Partial<Candidate> = {}): Candidate {
	return {
		isrc: `TEST${nextIsrc++}`,
		title,
		artist,
		moods: [],
		energy: 0.5,
		confidence: "high",
		distance: 0.1,
		score: 0.1,
		...overrides
	};
};

const titles = (rows: { title: string }[]) => rows.map((row) => row.title);

test("dedupe treats trailing brackets and dash suffixes as versions of one track", () => {
	const rows = buildPlaylist([
		candidate("Heroes", "Bowie"),
		candidate("Heroes (Berlin)", "Bowie"),
		candidate("HEROES - Single Version", "Bowie"),
	], 10);
	assert.deepEqual(titles(rows), ["Heroes"]);
});

test("dedupe keeps the first, best-ranked candidate", () => {
	const rows = buildPlaylist([
		candidate("Heroes (Live)", "Bowie", { isrc: "FIRST" }),
		candidate("Heroes", "Bowie", { isrc: "SECOND" }),
	], 10);
	assert.deepEqual(rows.map((row) => row.isrc), ["FIRST"]);
});

test("dedupe keys on the primary artist", () => {
	const rows = buildPlaylist([
		candidate("Heroes", "Bowie"),
		candidate("Heroes", "Bowie, Eno"),
		candidate("Heroes", "Someone Else"),
	], 10);
	assert.deepEqual(rows.map((row) => row.artist), ["Bowie", "Someone Else"]);
});

test("dedupe falls back to the full title when stripping would empty it", () => {
	const rows = buildPlaylist([
		candidate("(Intro)", "Bowie"),
		candidate("(Outro)", "Bowie"),
	], 10);
	assert.deepEqual(titles(rows), ["(Intro)", "(Outro)"]);
});

test("each artist gets at most two tracks", () => {
	const rows = buildPlaylist([
		candidate("One", "Bowie"),
		candidate("Two", "Bowie"),
		candidate("Three", "bowie"),
		candidate("Four", "Eno"),
	], 10);
	assert.deepEqual(titles(rows), ["One", "Two", "Four"]);
});

test("collab credits count against every named artist", () => {
	const rows = buildPlaylist([
		candidate("One", "Bowie"),
		candidate("Two", "Bowie & Eno"),
		candidate("Three", "Eno, Bowie"),
		candidate("Four", "Eno"),
		candidate("Five", "Eno"),
	], 10);
	assert.deepEqual(titles(rows), ["One", "Two", "Four"]);
});

test("tracks without an artist share the unknown slot", () => {
	const rows = buildPlaylist([
		candidate("One", null),
		candidate("Two", null),
		candidate("Three", null),
	], 10);
	assert.deepEqual(titles(rows), ["One", "Two"]);
});

test("the playlist is cut to size and flags low confidence", () => {
	const rows = buildPlaylist([
		candidate("One", "A", { confidence: "low" }),
		candidate("Two", "B"),
		candidate("Three", "C"),
	], 2);
	assert.deepEqual(titles(rows), ["One", "Two"]);
	assert.deepEqual(rows.map((row) => row.lowConfidence), [true, false]);
});
