import { Hono } from "hono";
import { listRecordings } from "../db/browse.js";
import { serve } from "@hono/node-server";

export const app = new Hono();

app.get("/api/tracks", (c) => c.json(listRecordings()));

export function startServer(port: number): void {
	serve({ fetch: app.fetch, port });
	console.log(`API running on http://localhost:${port}`);
};