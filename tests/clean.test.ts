import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTitle, primaryArtist } from "../src/enrich/clean.js";

test("cleanTitle strips noise in a trailing bracket", () => {
	assert.equal(cleanTitle("Heroes (Remastered 2017)"), "Heroes");
	assert.equal(cleanTitle("Heroes [Bonus Track]"), "Heroes");
	assert.equal(cleanTitle("Heroes (feat. Someone)"), "Heroes");
});

test("cleanTitle strips a noisy dash suffix", () => {
	assert.equal(cleanTitle("Heroes - 2017 Remaster"), "Heroes");
	assert.equal(cleanTitle("Heroes - Radio Edit"), "Heroes");
});

test("cleanTitle strips an unbracketed featuring credit", () => {
	assert.equal(cleanTitle("Heroes feat. Someone"), "Heroes");
	assert.equal(cleanTitle("Heroes ft. Someone Else"), "Heroes");
});

test("cleanTitle keeps suffixes that are not noise", () => {
	assert.equal(cleanTitle("Heroes (Berlin)"), "Heroes (Berlin)");
	assert.equal(cleanTitle("Heroes - Part 2"), "Heroes - Part 2");
});

test("cleanTitle repeats until nothing more comes off", () => {
	assert.equal(cleanTitle("Heroes - Live at Wembley (Remastered)"), "Heroes");
});

test("cleanTitle only looks at suffixes, not noise words inside the title", () => {
	assert.equal(cleanTitle("Live Forever"), "Live Forever");
});

test("cleanTitle returns the original title when cleaning would empty it", () => {
	assert.equal(cleanTitle("(Live)"), "(Live)");
});

test("primaryArtist takes the first comma-separated credit", () => {
	assert.equal(primaryArtist("Artist A, Artist B"), "Artist A");
	assert.equal(primaryArtist("  Artist A  "), "Artist A");
});

test("primaryArtist does not split on ampersands", () => {
	assert.equal(primaryArtist("Simon & Garfunkel"), "Simon & Garfunkel");
});
