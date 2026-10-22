import { MOODS } from "./moods.js";
import { type TrackInput } from "./input.js";

export const PROMPT_VERSION = "v1";

const MOOD_LINES = Object.entries(MOODS)
	.map(([mood, meaning]) => `- ${mood}: ${meaning}`)
	.join("\n");

// Older prompt versions stay addressable (by name, not just whatever is live)
// so eval runs can re-score a past version instead of only the current one.
type PromptVariant = {
	extraEvidenceNotes: string[];
	moodsIntro: string;
};

const VARIANTS: Record<string, PromptVariant> = {
	v1: {
		extraEvidenceNotes: [],
		moodsIntro: "moods: one to three moods, most important first, chosen only from this list:",
	},
	v2: {
		extraEvidenceNotes: [
			"Audio features describe how a track sounds, not what it is about or how it feels. Do not infer\n" +
			"  mood from tempo or energy alone: a fast or loud track can still be tender, melancholic or defiant\n" +
			"  depending on its lyrics, reputation and era, and a quiet track can still be tense or dark.",
		],
		moodsIntro:
			"moods: one to three moods, most important first, chosen only from this list. Base them on what the\n" +
			"song is actually about and how it feels to someone who knows it, from its lyrics, reputation and\n" +
			"era, not from genre labels or audio-feature vibes alone:",
	},
};

function buildSystemPrompt(version: string): string {

	const variant = VARIANTS[version];
	if (!variant) throw new Error(`Unknown prompt version: ${version}`);

	const evidenceNotes = [
		"The wiki and the recording's genres and tags describe this exact song. Trust them most.",
		"Artist tags describe the artist's whole career. Use them for genre and era, but not for the mood of one song.",
		"Audio features are automatic estimates and can be wrong. Treat them as hints:\n" +
		"  energy and valence run from 0 to 1, tempo is in beats per minute and is sometimes doubled or halved.",
		"An empty list or a missing field means no data, not a negative answer.",
		"Ignore tags that are clearly personal or meaningless, such as \"seen live\" or \"favourites\".",
		...variant.extraEvidenceNotes,
	].map((line) => `- ${line}`).join("\n");

	return `
You label songs from a personal music library so they can be searched by mood, energy and language.

For each track you receive some evidence: title and artist, sometimes a short wiki text, tags for the artist,
genres and tags for the recording, and estimated audio features. Use your own knowledge of the track when you
recognise it, and the evidence when you do not.

## How to weigh the evidence
${evidenceNotes}

## Fields

languages: the languages that are sung, as lowercase English names, for example "english", "french", "spanish".
List several if more than one is sung. Use "instrumental" when there are no vocals that matter, including
tracks with only short vocal samples. Use "unknown" when you cannot tell. Prefer "unknown" to guessing.

${variant.moodsIntro}
${MOOD_LINES}

energy: how intense the track is, compared with all music, not only its own genre.
1 = still or ambient, almost no beat
2 = slow ballad, quiet
3 = mid-tempo, steady
4 = upbeat or danceable
5 = intense, peak-time, full force

themes: up to three short lowercase phrases for what the lyrics are about, such as "heartbreak" or "city life".
Use an empty list for instrumentals or when you do not know.

description: one natural sentence of at most 200 characters describing the sound, mood and subject.
Do not mention the title or the artist. Example: "Slow acoustic rock ballad about the end of a love affair."

confidence: "high" if you know the track or the evidence is clear and consistent, "medium" if you rely mainly
on the genre and audio features, "low" if the evidence is thin or contradictory.

## Output
Return one result for every track you receive, with its isrc copied exactly.
`.trim();

};

export function buildMessages(tracks: TrackInput[], version: string = PROMPT_VERSION) {
	return [
		{ role: "system" as const, content: buildSystemPrompt(version) },
		{ role: "user" as const, content: `Label these tracks:\n${JSON.stringify(tracks, null, 2)}` },
	];
};
