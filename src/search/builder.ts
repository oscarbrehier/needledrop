import { type Candidate } from "./query.js";

export type ResultRow = Candidate & { lowConfidence: boolean };

// Candidates arrive one row per ISRC already (tags are per-recording) and
// pre-sorted by rank, so this just caps artist repeats and cuts to size.
export function buildPlaylist(candidates: Candidate[], size: number): ResultRow[] {

	const perArtist = new Map<string, number>();
	const result: ResultRow[] = [];

	for (const candidate of candidates) {

		// Split on "," so a featuring credit counts against each named artist,
		// not against the exact credit string (which would let "X" and "X feat. Y"
		// each get their own two slots).
		const artists = (candidate.artist ?? "unknown").split(",").map((a) => a.trim().toLowerCase());
		if (artists.some((a) => (perArtist.get(a) ?? 0) >= 2)) continue;

		for (const a of artists) perArtist.set(a, (perArtist.get(a) ?? 0) + 1);
		result.push({ ...candidate, lowConfidence: candidate.confidence === "low" });

		if (result.length >= size) break;

	};

	return result;

};
