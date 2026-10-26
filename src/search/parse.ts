import z from "zod";
import { requireEnv } from "../config.js";
import { MODEL } from "../tag/mistral.js";
import { MOODS, type Mood } from "../tag/moods.js";
import { sleep } from "../utils/sleep.js";

const MOOD_NAMES = Object.keys(MOODS) as [Mood, ...Mood[]];

export const ParsedPrompt = z.object({
	languages: z.array(z.string().regex(/^[a-z]+$/)).optional(),
	energyMin: z.number().int().min(1).max(5).optional(),
	energyMax: z.number().int().min(1).max(5).optional(),
	moods: z.array(z.enum(MOOD_NAMES)).optional(),
	semantic: z.string().min(1),
	size: z.number().int().min(1).max(100),
});

export type ParsedPrompt = z.infer<typeof ParsedPrompt>;

const API_URL = "https://api.mistral.ai/v1/chat/completions";
const MAX_RETRIES = 5;

const RESPONSE_SCHEMA = z.toJSONSchema(ParsedPrompt) as Record<string, unknown>;
delete RESPONSE_SCHEMA.$schema;

const MOOD_LIST = Object.keys(MOODS).join(", ");

const SYSTEM_PROMPT = `
You turn a request for music into a structured search over a personal library. Its tracks are each tagged
with one or more languages, one to three moods from a fixed list, an energy level from 1 (still) to 5
(intense), and a short description.

Only set languages, energyMin, energyMax or moods when the request clearly implies them. Leave a field out
entirely rather than guessing a value the request doesn't support -- anything that doesn't map to one of
these fields belongs in semantic instead.

languages: lowercase English language names, only when the request names a language or asks for instrumental
music (use "instrumental").

energyMin / energyMax: 1 to 5, only when the request implies a floor or ceiling on intensity (for example
"mellow" implies a low energyMax, "a workout mix" implies a high energyMin).

moods: zero to three moods, chosen only from this fixed list, only when one clearly matches:
${MOOD_LIST}

semantic: a short phrase capturing the feel, setting or subject of the request, for a similarity search
against track descriptions. Always fill this in, including anything not captured by the fields above.

size: how many tracks are wanted. Default to 20 if the request does not say.
`.trim();

function buildMessages(prompt: string) {
	return [
		{ role: "system" as const, content: SYSTEM_PROMPT },
		{ role: "user" as const, content: prompt },
	];
};

export async function parsePrompt(prompt: string): Promise<ParsedPrompt> {

	for (let attempt = 0; ; attempt++) {

		const res = await fetch(API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${requireEnv("MISTRAL_API_KEY")}`,
			},
			body: JSON.stringify({
				model: MODEL,
				temperature: 0,
				messages: buildMessages(prompt),
				response_format: {
					type: "json_schema",
					json_schema: { name: "parsed_prompt", schema: RESPONSE_SCHEMA, strict: true },
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

		const parsed = ParsedPrompt.parse(JSON.parse(content));
		console.error(`Parsed prompt: ${JSON.stringify(parsed)}`);

		return parsed;

	};

};
