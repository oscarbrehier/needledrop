import { requireEnv } from "../config.js";
import { EnrichTrack } from "../db/enrichment.js";
import { Enricher } from "./types.js";

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

	if (!res.ok) {
		return null;
	};

	const data = await res.json();
	return data.error ? null : data;

};

async function lookupLastfm(track: EnrichTrack): Promise<unknown | null> {

};