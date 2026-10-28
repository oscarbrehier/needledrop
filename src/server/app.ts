import { Hono } from "hono";
import { listRecordings } from "../db/browse.js";
import { serve } from "@hono/node-server";
import { HttpError, readBody } from "./errors.js";
import { ZodError } from "zod";
import { ParseRequest } from "./contract.js";

export const app = new Hono();

app.get("/api/tracks", (c) => c.json(listRecordings()));

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
};