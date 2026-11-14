import type {
	LibraryStats,
	ParsedPrompt,
	ParseRequest,
	PreviewResponse,
	SaveRequest,
	SaveResponse,
} from "./pages/playlist/types";

type ErrorBody = {
	error?: string;
	issues?: { path?: (string | number)[]; message?: string }[];
};

function describeError(body: unknown, res: Response): string {

	const { error, issues } = (body ?? {}) as ErrorBody;

	if (!error) return `HTTP ${res.status} ${res.statusText}`.trim();

	const first = issues?.[0];
	if (!first?.message) return error;

	const path = first.path?.length ? `${first.path.join(".")}: ` : "";
	return `${error} (${path}${first.message})`;

};

async function request<T>(path: string, init?: RequestInit): Promise<T> {

	const res = await fetch(path, init);
	const body: unknown = await res.json().catch(() => null);

	if (!res.ok) throw new Error(describeError(body, res));

	return body as T;

};

function post<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {

	return request<T>(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
		signal,
	});

};

export function getLibraryStats(signal?: AbortSignal): Promise<LibraryStats> {
	return request<LibraryStats>("/api/library/stats", { signal });
};

export function parsePrompt(req: ParseRequest, signal?: AbortSignal): Promise<ParsedPrompt> {
	return post<ParsedPrompt>("/api/playlists/parse", req, signal);
};

export function preview(filters: ParsedPrompt, signal?: AbortSignal): Promise<PreviewResponse> {
	return post<PreviewResponse>("/api/playlists/preview", filters, signal);
};

// No signal: aborting the request would not stop the server from writing to Tidal.
export function savePlaylist(req: SaveRequest): Promise<SaveResponse> {
	return post<SaveResponse>("/api/playlists", req);
};

export function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
};
