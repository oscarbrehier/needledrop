import z from "zod";
import { requireEnv } from "../config.js";
import { sleep } from "../utils/sleep.js";
import { type TrackInput } from "./input.js";
import { buildMessages } from "./prompt.js";
import { BatchAnswer } from "./schema.js";

const API_URL = "https://api.mistral.ai/v1/chat/completions";
export const MODEL = "mistral-small-2603";
const MAX_RETRIES = 5;

// Mistral's json_schema response_format wants a plain JSON Schema object under
// response_format.json_schema.schema (verified against their TS SDK source, since
// their docs pages for this are mostly still TODO stubs).
const RESPONSE_SCHEMA = z.toJSONSchema(BatchAnswer) as Record<string, unknown>;
delete RESPONSE_SCHEMA.$schema;

export async function tagBatch(
	tracks: TrackInput[],
	options: { model?: string; promptVersion?: string } = {},
): Promise<unknown> {

	for (let attempt = 0; ; attempt++) {

		const res = await fetch(API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${requireEnv("MISTRAL_API_KEY")}`,
			},
			body: JSON.stringify({
				model: options.model ?? MODEL,
				temperature: 0,
				messages: buildMessages(tracks, options.promptVersion),
				response_format: {
					type: "json_schema",
					json_schema: {
						name: "batch_answer",
						schema: RESPONSE_SCHEMA,
						strict: true,
					},
				},
			}),
		});

		if (res.status === 429 && attempt < MAX_RETRIES) {
			const seconds = Number(res.headers.get("Retry-After")) || 2 ** attempt;
			await sleep(seconds * 1000);
			continue;
		};

		if (!res.ok) {
			throw new Error(`Mistral request failed (${res.status}): ${await res.text()}`);
		};

		const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
		const content = data.choices?.[0]?.message?.content;
		if (!content) throw new Error("Mistral returned an empty response");

		return JSON.parse(content);

	};

};
