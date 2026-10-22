import { RecordingToTag } from "../db/tags.js";

export type TrackInput = {
	isrc: string;
	title: string;
	artist: string;
	wiki?: string;
	artistTags: string[];
	genres: string[];
	tags: string[];
	audio?: Record<string, number>;
};

type Named = { name?: unknown; count?: number };
type LastfmPayload = {
	track?: { wiki?: { summary?: string; }; };
	artist?: { toptags?: { tag?: Named | Named[]; }; };
};
type MusicbrainzPayload = {
	recording?: { genres?: Named[]; tags?: Named[] };
};
type ReccobeatsPayload = {
	content?: Record<string, unknown>[];
};

const AUDIO_FIELDS = ["energy", "valence", "danceability", "acousticness", "instrumentalness", "tempo"] as const;

function parse<T>(json: string | null): T | null {

	if (!json) return null;

	try {
		return JSON.parse(json) as T;
	} catch {
		return null;
	};

};

function asArray<T>(value: T | T[] | undefined): T[] {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
};

function names(list: Named | Named[] | undefined, max: number): string[] {

	const seen = new Set<string>();

	for (const item of asArray(list)) {

		const name = typeof item.name === "string" ? item.name.trim().toLowerCase() : "";

		if (name) seen.add(name);
		if (seen.size === max) break;

	};

	return [...seen];

};

function cleanWiki(summary: string): string {

	const text = summary
		.replace(/<a\b[^>]*>.*?<\/a>\.?/gs, "")
		.replace(/\s+/g, " ")
		.trim();

	if (text.length <= 500) return text;

	return text.slice(0, 500).replace(/\s+\S*$/, "") + "…";

};

export function buildTrackInput(row: RecordingToTag): TrackInput {

	const lastfm = parse<LastfmPayload>(row.lastfm);
	const musicbrainz = parse<MusicbrainzPayload>(row.musicbrainz);
	const reccobeats = parse<ReccobeatsPayload>(row.reccobeats);

	const input: TrackInput = {
		isrc: row.isrc,
		title: row.title,
		artist: row.artist ?? "unknown",
		artistTags: names(lastfm?.artist?.toptags?.tag, 8),
		genres: names(musicbrainz?.recording?.genres, 5),
		tags: names(musicbrainz?.recording?.tags, 8),
	};

	const wiki = lastfm?.track?.wiki?.summary;
	if (wiki) input.wiki = cleanWiki(wiki);

	const features = reccobeats?.content?.[0];
	if (features) {

		const audio: Record<string, number> = {};

		for (const field of AUDIO_FIELDS) {

			const value = features[field];

			if (typeof value === "number") {
				audio[field] = field === "tempo" ? Math.round(value) : Math.round(value * 100) / 100;
			};

		};

		if (Object.keys(audio).length) input.audio = audio;

	};

	return input;

};