import z from "zod";
import { MOODS, type Mood } from "./moods.js";

const MOOD_NAMES = Object.keys(MOODS) as [Mood, ...Mood[]];

export const TrackTags = z.object({
	languages: z.array(z.string().regex(/^[a-z]+$/)).min(1).max(3),
	moods: z.array(z.enum(MOOD_NAMES)).min(1).max(3),
	energy: z.number().int().min(1).max(5),
	themes: z.array(z.string()).max(3),
	description: z.string().min(10).max(200),
	confidence: z.enum(["low", "medium", "high"]),
});

export const TaggedTrack = TrackTags.extend({ isrc: z.string() });
export const BatchAnswer = z.object({ results: z.array(TaggedTrack) });