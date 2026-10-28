import { type Tags } from "../tag/schema.js";

const ENERGY_WORDS: Record<number, string> = {
	1: "still",
	2: "quiet",
	3: "mid-tempo",
	4: "upbeat",
	5: "intense",
};

// Title and artist stay out on purpose (per the roadmap) so the vector
// captures mood and sound, not identity, and two covers of the same song
// don't end up artificially close just because they share a title.
export function buildEmbeddingText(tags: Tags): string {

	const energyWord = ENERGY_WORDS[tags.energy] ?? "mid-tempo";
	const moods = tags.moods.join(", ");

	const languageNote = tags.languages.includes("instrumental")
		? "Instrumental."
		: tags.languages.includes("unknown") || tags.languages.length === 0
			? ""
			: `Sung in ${tags.languages.join(" and ")}.`;

	const themeNote = tags.themes.length ? `About ${tags.themes.join(", ")}.` : "";

	return [`An ${energyWord}, ${moods} track.`, themeNote, languageNote, tags.description]
		.filter(Boolean)
		.join(" ");

};
