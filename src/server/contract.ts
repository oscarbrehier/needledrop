import z from "zod";
import { MOODS, type Mood } from "../tag/moods.js";
import { ParsedPrompt } from "../search/parse.js";

export { ParsedPrompt };
export type { OverrideField, RecordingRow as Recording } from "../db/browse.js";
export type { Mood };

const MOOD_NAMES = Object.keys(MOODS) as [Mood, ...Mood[]];
const Confidence = z.enum(["low", "medium", "high"]);
const Energy = z.number().int().min(1).max(5);

export const LibraryStats = z.object({
	total: z.number().int(),
	tagged: z.number().int(),
	embedded: z.number().int(),
	lowConfidence: z.number().int()
});

export const ParseRequest = z.object({
	prompt: z.string().trim().min(1).max(500),
	size: z.number().int().min(1).max(100).default(25)
});

export const TrackResult = z.object({
	isrc: z.string(),
	tidalId: z.string(),
	title: z.string(),
	artist: z.string().nullable(),
	moods: z.array(z.enum(MOOD_NAMES)),
	energy: Energy,
	languages: z.array(z.string()),
	description: z.string(),
	confidence: Confidence,
	distance: z.number(),
	score: z.number(),
	durationS: z.number().int().nullable()
});

export const FunnelFilter = z.enum(["languages", "energy", "moods"]);

export const FunnelStats = z.object({
	libraryTotal: z.number().int(),
	steps: z.array(z.object({
		label: z.string(),
		count: z.number().int(),
		filters: z.array(FunnelFilter)
	})),
	relaxed: z.array(z.string()),
	dropped: z.number().int().nullable(),
	selected: z.number().int(),
	requested: z.number().int()
});

export const PreviewResponse = z.object({
	tracks: z.array(TrackResult),
	stats: FunnelStats
});

export const SaveRequest = z.object({
	name: z.string().trim().min(1).max(100).optional(),
	prompt: z.string().min(1),
	filters: ParsedPrompt,
	isrcs: z.array(z.string()).min(1)
});

export const SaveResponse = z.object({
	tidalId: z.string(),
	name: z.string(),
	trackCount: z.number().int(),
	url: z.url(),
});

export const ErrorResponse = z.object({
	error: z.string(),
	code: z.string().optional(),
	// Set with code "partial_save": the playlist exists in Tidal with only some tracks.
	tidalId: z.string().optional(),
	playlistName: z.string().optional(),
	added: z.number().int().optional(),
	total: z.number().int().optional()
});

export type Confidence = z.infer<typeof Confidence>;
export type LibraryStats = z.infer<typeof LibraryStats>;
export type ParseRequest = z.infer<typeof ParseRequest>;
export type TrackResult = z.infer<typeof TrackResult>;
export type FunnelFilter = z.infer<typeof FunnelFilter>;
export type FunnelStats = z.infer<typeof FunnelStats>;
export type PreviewResponse = z.infer<typeof PreviewResponse>;
export type SaveRequest = z.infer<typeof SaveRequest>;
export type SaveResponse = z.infer<typeof SaveResponse>;
export type ErrorResponse = z.infer<typeof ErrorResponse>;