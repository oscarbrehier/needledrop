import { type Confidence } from "../library/page";

export type GenerationRequest = { prompt: string; size: number };

export type ParsedPrompt = {
	filters: { language?: string; energyMin?: number; energyMax?: number };
	semantic: string;
	size: number;
};

export type PlaylistTrack = {
	isrc: string;
	title: string;
	artist: string | null;
	durationS: number | null;
	moods: string[];
	energy: number | null;
	confidence: Confidence | null;
	distance: number;
};

export type GenerationResult = {
	tracks: PlaylistTrack[];
	relaxed: string[];
	elapsedMs: number;
};

export type GenerationProgress =
	| { stage: "reading" }
	| { stage: "building"; parsed: ParsedPrompt }
	| { stage: "done"; parsed: ParsedPrompt; result: GenerationResult };