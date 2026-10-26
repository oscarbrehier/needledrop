import { primaryArtist } from "../enrich/clean.js";
import { type Candidate } from "./query.js";

export type ResultRow = Candidate & { lowConfidence: boolean };

// cleanTitle (enrich/clean.ts) only strips a trailing bracket or dash suffix
// when it matches a fixed noise-word list (remaster, live, feat...), because
// that list is tuned for matching external APIs. A "(Berlin)"/"(Paris)" edit
// isn't noise there, but for spotting duplicate recordings in a generated
// playlist any trailing bracket or " - " suffix is a version marker, so this
// strips them unconditionally instead of reusing cleanTitle.
function normalizeForDedupe(title: string): string {

	let result = title;
	let previous: string;

	do {
		previous = result;
		result = result
			.replace(/\s*[([][^)\]]*[)\]]\s*$/, "")
			.replace(/\s+-\s+[^-]*$/, "")
			.trim();
	} while (result !== previous);

	return (result || title).toLowerCase();

};

// Candidates arrive one row per ISRC already (tags are per-recording) and
// pre-sorted by rank, so this just dedupes near-same recordings, caps artist
// repeats, and cuts to size.
export function buildPlaylist(candidates: Candidate[], size: number): ResultRow[] {

	const perArtist = new Map<string, number>();
	const seenTracks = new Set<string>();
	const result: ResultRow[] = [];

	for (const candidate of candidates) {

		// Candidates are already sorted best-first, so the first one seen for a
		// key is the better-ranked one.
		const dedupeKey = `${normalizeForDedupe(candidate.title)}::${primaryArtist(candidate.artist ?? "unknown").toLowerCase()}`;
		if (seenTracks.has(dedupeKey)) continue;

		// Split on "," so a featuring credit counts against each named artist,
		// not against the exact credit string (which would let "X" and "X feat. Y"
		// each get their own two slots).
		const artists = (candidate.artist ?? "unknown").split(",").map((a) => a.trim().toLowerCase());
		if (artists.some((a) => (perArtist.get(a) ?? 0) >= 2)) continue;

		seenTracks.add(dedupeKey);
		for (const a of artists) perArtist.set(a, (perArtist.get(a) ?? 0) + 1);
		result.push({ ...candidate, lowConfidence: candidate.confidence === "low" });

		if (result.length >= size) break;

	};

	return result;

};
