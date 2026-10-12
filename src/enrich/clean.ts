const NOISE = /\b(remaster(ed)?|feat\.?|ft\.?|featuring|radio edit|single version|album version|mono|stereo|live|deluxe|bonus track)\b/i;

export function cleanTitle(title: string): string {

	let result = title;
	let previous: string;

	do {

		previous = result;
		result = result
			.replace(/\s*[([][^)\]]*[)\]]\s*$/, (group) => (NOISE.test(group) ? "" : group))
			.replace(/\s+-\s+[^-]*$/, (tail) => (NOISE.test(tail) ? "" : tail))
			.replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/i, "")
			.trim();

	} while (result !== previous);

	return result || title;

};

export function primaryArtist(artist: string): string {
	return (artist.split(",")[0] ?? artist).trim();
};