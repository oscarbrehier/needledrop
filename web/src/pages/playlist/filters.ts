import type { FunnelFilter, ParsedPrompt } from "@contract";

export function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
};

export function removeFilter(filters: ParsedPrompt, key: FunnelFilter): ParsedPrompt {

	switch (key) {
		case "languages": return { ...filters, languages: undefined };
		case "energy": return { ...filters, energyMin: undefined, energyMax: undefined };
		case "moods": return { ...filters, moods: undefined };
	};

};

export function describeFilter(filters: ParsedPrompt, key: FunnelFilter): string {

	switch (key) {
		case "languages": return (filters.languages ?? []).map(capitalize).join(" or ");
		case "energy": return "energy range";
		case "moods": return (filters.moods?.length ?? 0) > 1 ? "moods" : "mood";
	};

};
