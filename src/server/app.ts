import { Hono } from "hono";
import { libraryStats, listRecordings } from "../db/browse.js";
import { serve } from "@hono/node-server";
import { HttpError, readBody } from "./errors.js";
import { ZodError } from "zod";
import { ParseRequest } from "./contract.js";
import { ParsedPrompt, parsePrompt } from "../search/parse.js";
import { buildPreview } from "./preview.js";
import { embed } from "../embed/embedder.js";

export const app = new Hono();

app.get("/api/tracks", (c) => c.json(listRecordings()));
app.get("/api/library/stats", (c) => c.json(libraryStats()))
app.post("/api/playlists/parse", async (c) => {

	const body = await readBody(c, ParseRequest);
	const parsed = await parsePrompt(body.prompt);
	
	return c.json({
		...parsed,
		size: body.size
	});

});

app.post("/api/playlists/preview", async (c) => {
	const filters = await readBody(c, ParsedPrompt);
	return c.json(await buildPreview(filters));
});

app.onError((err, c) => {

	if (err instanceof HttpError) {
		return c.json({ error: err.message }, err.status);
	};

	if (err instanceof ZodError) {
		return c.json({ error: "Invalid request", issues: err.issues }, 400);
	};

	console.error(err);
	return c.json({ error: err.message }, 500);

});

app.notFound((c) => {
	return c.json({ error: "Not found" }, 404);
});

export function startServer(port: number): void {

	serve({ fetch: app.fetch, port });
	console.log(`API running on http://localhost:${port}`);

	embed(["warm up"])
		.then(() => console.log("Embedding model ready"))
		.catch((e) => console.error("Embedding warm-up failed:", e));1

};