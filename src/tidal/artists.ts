// Some Tidal artist names are themselves malformed duplicates, e.g. a single
// artist entity named "Areski & Brigitte Fontaine & Brigitte Fontaine &
// Areski". Only collapse a name when its "&"-separated parts actually repeat,
// so ordinary "&"-named acts (Simon & Garfunkel, Kool & The Gang...) are
// never touched.
export function dedupeArtistName(rawName: string): string {

	const name = rawName.trim();
	const tokens = name.split("&").map((t) => t.trim()).filter(Boolean);
	if (tokens.length <= 1) return name;

	const seen = new Set<string>();
	const deduped: string[] = [];

	for (const token of tokens) {
		const key = token.toLowerCase();
		if (!seen.has(key)) {
			seen.add(key);
			deduped.push(token);
		};
	};

	return deduped.length === tokens.length ? name : deduped.join(" & ");

};

// Dedupes both within each name (see above) and across names, in case the
// same artist is credited twice under separate relationship entries.
export function buildArtistField(names: string[]): string | null {

	const seen = new Set<string>();
	const result: string[] = [];

	for (const raw of names) {

		const cleaned = dedupeArtistName(raw);
		const key = cleaned.toLowerCase();

		if (seen.has(key)) continue;
		seen.add(key);
		result.push(cleaned);

	};

	return result.length ? result.join(", ") : null;

};
