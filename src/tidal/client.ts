import PQueue from "p-queue";
import { getAccessToken } from "./auth.js";
import { sleep } from "../utils/sleep.js";

const BASE_URL = "https://openapi.tidal.com/v2";

const queue = new PQueue({ concurrency: 1, interval: 500, intervalCap: 1 });
const MAX_RETRIES = 5;

export type ResourceRef = { id: string; type: string };

export type Resource = {
	id: string;
	type: string;
	attributes?: Record<string, unknown>;
	relationships?: Record<string, { data?: ResourceRef[] }>;
};

export type Page = {
	data: ResourceRef[];
	included?: Resource[];
	links?: { next?: string };
};

function resolveUrl(endpoint: string): string {
	if (endpoint.startsWith("http")) return endpoint;
	return BASE_URL + endpoint;
};

export async function* paginate(firstUrl: string): AsyncGenerator<Page> {

	let url: string | undefined = firstUrl;

	while (url) {
		const page: Page = await request<Page>(url);
		yield page;
		url = page.links?.next;
	};

};

async function send<T>(url: string): Promise<T> {

	for (let attempt = 0; ; attempt++) {

		const accessToken = await getAccessToken();

		const res = await fetch(url, {
			headers: {
				"Authorization": `Bearer ${accessToken}`,
				"Accept": "application/vnd.api+json"
			}
		});

		if (res.status == 429 && attempt < MAX_RETRIES) {

			const seconds = Number(res.headers.get("Retry-After")) || 2 ** attempt;
			await sleep(seconds * 1000);
			continue;

		};

		if (!res.ok) {
			const error = await res.text();
			throw new Error(`Tidal request failed (${res.status}) for ${url}: ${error}`);
		};

		const data = await res.json();
		return data as T;

	};

};

export async function request<T>(endpoint: string): Promise<T> {
	return queue.add(() => send<T>(resolveUrl(endpoint)));
};