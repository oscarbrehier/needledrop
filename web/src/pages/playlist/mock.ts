import type { GenerationProgress, GenerationRequest, PlaylistTrack } from "./types";

const MOCK_TRACKS: PlaylistTrack[] = [
	{ isrc: "M1", title: "La Bohème", artist: "Charles Aznavour", durationS: 248, moods: ["nostalgic", "melancholic"], energy: 2, confidence: "high", distance: 0.18 },
	{ isrc: "M2", title: "Les Feuilles mortes", artist: "Yves Montand", durationS: 196, moods: ["melancholic", "calm"], energy: 1, confidence: "high", distance: 0.21 },
	{ isrc: "M3", title: "Ne me quitte pas", artist: "Jacques Brel", durationS: 233, moods: ["melancholic"], energy: 2, confidence: "medium", distance: 0.24 },
	{ isrc: "M4", title: "La Javanaise", artist: "Serge Gainsbourg", durationS: 152, moods: ["romantic", "playful"], energy: 2, confidence: "low", distance: 0.29 },
	{ isrc: "M5", title: "Comme d'habitude", artist: "Claude François", durationS: 291, moods: ["melancholic", "nostalgic"], energy: 3, confidence: "high", distance: 0.31 },
];

function wait(ms: number, signal: AbortSignal): Promise<void> {

	return new Promise((resolve, reject) => {

		const timer = setTimeout(resolve, ms);

		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				reject(new DOMException("Aborted", "AbortError"));
			},
			{ once: true },
		);

	});

};

export async function mockGenerate(
	request: GenerationRequest,
	onProgress: (progress: GenerationProgress) => void,
	signal: AbortSignal,
): Promise<void> {

	const start = performance.now();

	onProgress({ stage: "reading" });
	await wait(1200, signal);

	const parsed = {
		filters: { language: "french", energyMax: 2 },
		semantic: request.prompt,
		size: request.size,
	};

	onProgress({ stage: "building", parsed });
	await wait(1500, signal);

	const tracks = MOCK_TRACKS.slice(0, request.size);
	onProgress({
		stage: "done",
		parsed,
		result: {
			tracks,
			relaxed: tracks.length < request.size ? ["energy"] : [],
			elapsedMs: performance.now() - start,
		},
	});

};