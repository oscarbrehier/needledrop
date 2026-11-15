import type {
	ErrorResponse,
	LibraryStats,
	ParsedPrompt,
	ParseRequest,
	PreviewResponse,
	SaveRequest,
	SaveResponse,
} from "@contract";

// onError adds Zod's issues to validation errors; they are not part of ErrorResponse.
export type ApiErrorBody = ErrorResponse & {
	issues?: { path?: (string | number)[]; message?: string }[];
};

// Thrown for any non-OK response. `body` is the parsed error body, or null when the
// response was not a JSON error (a proxy failure, for example).
export class ApiError extends Error {

	readonly status: number;
	readonly body: ApiErrorBody | null;

	constructor(status: number, body: ApiErrorBody | null, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.body = body;
	};

	get code(): string | undefined {
		return this.body?.code;
	};

};

function isErrorBody(value: unknown): value is ApiErrorBody {
	return typeof value === "object" && value !== null && typeof (value as { error?: unknown }).error === "string";
};

function describeError(body: ApiErrorBody | null, res: Response): string {

	if (!body) return `HTTP ${res.status} ${res.statusText}`.trim();

	const first = body.issues?.[0];
	if (!first?.message) return body.error;

	const path = first.path?.length ? `${first.path.join(".")}: ` : "";
	return `${body.error} (${path}${first.message})`;

};

async function request<T>(path: string, init?: RequestInit): Promise<T> {

	const res = await fetch(path, init);
	const parsed: unknown = await res.json().catch(() => null);

	if (!res.ok) {
		const body = isErrorBody(parsed) ? parsed : null;
		throw new ApiError(res.status, body, describeError(body, res));
	};

	return parsed as T;

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
