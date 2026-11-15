import { test } from "node:test";
import assert from "node:assert/strict";
import { PartialSaveError } from "../src/playlist/save.js";
import { AddItemsError } from "../src/tidal/playlists.js";

test("PartialSaveError says what was created and how far it got", () => {
	const failure = new AddItemsError(40, 57, new Error("Tidal request failed (500)"));
	const error = new PartialSaveError("abc-123", "Rainy evening", failure);

	assert.equal(
		error.message,
		`Created "Rainy evening" in Tidal (abc-123), but only 40 of 57 tracks were added before a request failed: Tidal request failed (500)`
	);
});

test("PartialSaveError carries the fields the UI links with", () => {
	const failure = new AddItemsError(0, 12, new Error("timeout"));
	const error = new PartialSaveError("abc-123", "Rainy evening", failure);

	assert.ok(error instanceof Error);
	assert.equal(error.name, "PartialSaveError");
	assert.equal(error.tidalId, "abc-123");
	assert.equal(error.playlistName, "Rainy evening");
	assert.equal(error.added, 0);
	assert.equal(error.total, 12);
	assert.equal(error.cause, failure);
});

test("PartialSaveError handles a non-Error cause", () => {
	const error = new PartialSaveError("abc-123", "Rainy evening", new AddItemsError(5, 10, "socket hang up"));
	assert.ok(error.message.endsWith("before a request failed: socket hang up"));
});
