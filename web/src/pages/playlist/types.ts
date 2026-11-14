// Mirrors src/server/contract.ts until web/ imports those types directly.

export type Confidence = "low" | "medium" | "high";

export type LibraryStats = {
	total: number;
	tagged: number;
	embedded: number;
	lowConfidence: number;
};

export type ParseRequest = { prompt: string; size: number };

export type ParsedPrompt = {
	languages?: string[];
	energyMin?: number;
	energyMax?: number;
	moods?: string[];
	semantic: string;
	size: number;
};

export type TrackResult = {
	isrc: string;
	tidalId: string;
	title: string;
	artist: string | null;
	moods: string[];
	energy: number;
	languages: string[];
	description: string;
	confidence: Confidence;
	distance: number;
	score: number;
	durationS: number | null;
};

export type FunnelFilter = "languages" | "energy" | "moods";

export type FunnelStats = {
	libraryTotal: number;
	steps: { label: string; count: number; filters: FunnelFilter[] }[];
	relaxed: string[];
	dropped: number | null;
	selected: number;
	requested: number;
};

export type PreviewResponse = { tracks: TrackResult[]; stats: FunnelStats };

export type SaveRequest = {
	name?: string;
	prompt: string;
	filters: ParsedPrompt;
	isrcs: string[];
};

export type SaveResponse = {
	tidalId: string;
	name: string;
	trackCount: number;
	url: string;
};
