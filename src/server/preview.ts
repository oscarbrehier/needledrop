import { libraryStats, toTrackResult, trackDetails } from "../db/browse.js";
import { buildPlaylist } from "../search/builder.js";
import { ParsedPrompt } from "../search/parse.js";
import { searchCandidates, SearchResult } from "../search/query.js";
import { FunnelStats, PreviewResponse } from "./contract.js";

function describeHardFilters(filters: ParsedPrompt, relaxedEnergy: boolean): string | null {

	const parts: string[] = [];

	if (filters.languages?.length) {
		parts.push(filters.languages.map((l) => l[0]!.toUpperCase() + l.slice(1)).join(" or "));
	}
	if (!relaxedEnergy && filters.energyMin !== undefined) parts.push(`energy ≥ ${filters.energyMin}`);
	if (!relaxedEnergy && filters.energyMax !== undefined) parts.push(`energy ≤ ${filters.energyMax}`);

	return parts.length ? parts.join(" · ") : null;

};

function toFunnelStats(filters: ParsedPrompt, result: SearchResult, selected: number): FunnelStats {

	const steps: FunnelStats["steps"] = [];

	const hardLabel = describeHardFilters(filters, result.relaxedEnergy);
	if (hardLabel) steps.push({ label: hardLabel, count: result.hardFilteredCount });

	if (filters.moods?.length) {
		steps.push({ label: `Mood: ${filters.moods.join(", ")}`, count: result.candidates.length });
	}

	const shortfall = selected < filters.size;

	return {
		libraryTotal: libraryStats().total,
		steps,
		relaxed: result.relaxedEnergy ? ["energy"] : [],
		dropped: shortfall ? result.candidates.length - selected : null,
		selected,
		requested: filters.size,
	};

};

export async function buildPreview(filters: ParsedPrompt): Promise<PreviewResponse> {
	
	const result = await searchCandidates(filters);
	const rows = buildPlaylist(result.candidates, filters.size);
	const tracks = toTrackResult(rows, trackDetails(rows.map((r) => r.isrc)));
	const stats = toFunnelStats(filters, result, rows.length);
	
	return PreviewResponse.parse({ tracks, stats });

};