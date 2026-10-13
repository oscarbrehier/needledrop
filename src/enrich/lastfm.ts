import { requireEnv } from "../config.js";
import { type EnrichTrack } from "../db/enrichment.js";
import { cleanTitle, primaryArtist } from "./clean.js";
import { type Enricher } from "./types.js";

const API_URL = "https://ws.audioscrobbler.com/2.0/";

export const lastfm: Enricher = {
	source: "lastfm",
	intervalMs: 250,
	lookup: lookupLastfm
};

async function callLastfm(method: string, params: Record<string, string>): Promise<unknown | null> {

	const url = new URL(API_URL);
	url.search = new URLSearchParams({
		method,
		...params,
		api_key: requireEnv("LASTFM_API_KEY"),
		format: "json",
	}).toString();

	const res = await fetch(url);
	const data = (await res.json().catch(() => null)) as { error?: number; message?: string };

	if (data?.error === 6) return null; 

	if (!res.ok || !data || data.error) {
		throw new Error(`Last.fm ${method} failed (${res.status}): ${data?.message ?? "no response body"}`);
	};

	return data.error ? null : data;

};

function hasTags(response: unknown): boolean {
	const tags = (response as { toptags?: { tag?: unknown[] } } | null)?.toptags?.tag;
	return Array.isArray(tags) && tags.length > 0;
}

export async function lookupLastfm(track: EnrichTrack): Promise<unknown | null> {

	if (!track.artist) return null;

	const artist = primaryArtist(track.artist);

	const info = await callLastfm("track.getinfo", {
		artist: artist,
		track: cleanTitle(track.title),
		autocorrect: "1"
	}) as { track?: { toptags?: unknown } } | null;

	const artistTags = await callLastfm("artist.gettoptags", { artist: artist, autocorrect: "1" });

	if (!info && !hasTags(artistTags)) return null;

	return {
		track: info?.track,
		artist: artistTags
	};

};