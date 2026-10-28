import z from "zod";
import { MOODS, type Mood } from "../tag/moods.js";

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

export const ParsedFilters = z.object({
	languages: z.array(z.string()).optional(),
	energyMin: Energy.optional(),
	energyMax: Energy.optional(),
	moods: z.object(z.enum(MOOD_NAMES)).optional(),
	semantic: z.string(),
	size: z.number().int().min(1).max(100)
});

export const TrackResult = z.object({
	isrc: z.string(),
	tidalId: z.string(),
	title: z.string(),
	artist: z.string().nullable(),
	moods: z.array(z.enum(MOODS)),
	energy: Energy,
	languages: z.array(z.string()),
	description: z.string(),
	confidence: Confidence,
	distance: z.number(),
	score: z.number(),
	durationS: z.number().int().nullable()
});

export const FunnelStats = z.object({
	libraryTotal: z.number().int(),
	steps: z.array(z.object({
		label: z.string(),
		count: z.number().int()
	})),
	relaxed: z.array(z.object({
		filter: z.string(),
		from: z.number(),
		to: z.number()
	})),
	dropped: z.object({
		duplicates: z.number().int(),
		artistCap: z.number().int(),
		lowConfidence: z.number().int()
	}),
	selected: z.number().int(),
	requested: z.number().int()
});

export const PreviewResponse = z.object({
	tracks: z.array(TrackResult),
	stats: FunnelStats
});

export const SaveRequest = z.object({
	name: z.string().trim().min(1).max(100),
	prompt: z.string(),
	trackIds: z.array(z.string()).min(1)
});

export const SaveResponse = z.object({
	playlistId: z.string(),
	url: z.url()
});

export const ErrorResponse = z.object({
	error: z.string(),
	code: z.string().optional()
});

export type LibraryStats = z.infer<typeof LibraryStats>;
export type ParseRequest = z.infer<typeof ParseRequest>;
export type ParsedFilters = z.infer<typeof ParsedFilters>;
export type TrackResult = z.infer<typeof TrackResult>;
export type FunnelStats = z.infer<typeof FunnelStats>;
export type PreviewResponse = z.infer<typeof PreviewResponse>;
export type SaveRequest = z.infer<typeof SaveRequest>;
export type SaveResponse = z.infer<typeof SaveResponse>;
export type ErrorResponse = z.infer<typeof ErrorResponse>;