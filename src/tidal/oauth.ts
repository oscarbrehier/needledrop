import { createHash, randomBytes } from "node:crypto";
import { requireEnv } from "../config.js";
import { createServer } from "node:http";
import { type StoredTokens } from "./tokens.js";
import z from "zod";

const AUTHORIZE_URL = "https://login.tidal.com/authorize";
const TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token";
const REDIRECT_URI = "http://localhost:8787/callback";
const SCOPES = ["user.read", "collection.read", "playlists.read", "playlists.write"];

const TokenResponse = z.object({
	access_token: z.string(),
	refresh_token: z.string().optional(),
	expires_in: z.number()
});

export function buildAuthRequest() {

	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	const state = randomBytes(16).toString("base64url");

	const url = new URL(AUTHORIZE_URL);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", requireEnv("TIDAL_CLIENT_ID"))
	url.searchParams.set("redirect_uri", REDIRECT_URI);
	url.searchParams.set("scope", SCOPES.join(" "));
	url.searchParams.set("code_challenge_method", "S256");
	url.searchParams.set("code_challenge", challenge);
	url.searchParams.set("state", state);

	return { url: url.toString(), verifier, state };

};

export function waitForCallback(expectedState: string): Promise<string> {

	return new Promise<string>((resolve, reject) => {

		const server = createServer((req, res) => {

			const requestUrl = new URL(req.url ?? "/", REDIRECT_URI);

			if (requestUrl.pathname !== "/callback") {
				res.writeHead(404).end();
				return;
			};

			const code = requestUrl.searchParams.get("code");
			const state = requestUrl.searchParams.get("state");
			const error = requestUrl.searchParams.get("error");
			const detail = requestUrl.searchParams.get("error_description");

			let failure: string | null = null;
			if (error) {
				failure = `Tidal refused the login: ${detail ?? error}`;
			} else if (state != expectedState) {
				failure = "The response does not belong to this login attempt (state mismatch). Run auth again.";
			} else if (!code) {
				failure = "Tidal's response did not include an authorization code.";
			};

			res
				.writeHead(failure ? 400 : 200, { "Content-Type": "text/plain; charset=utf-8" })
				.end(failure ?? "Logged in to Tidal. You can close this tab and return to the terminal.");

			clearTimeout(timer);
			server.close();
			server.closeAllConnections();

			if (code && !failure) resolve(code);
			else reject(new Error(failure ?? "Login failed."));

		});

		server.on("error", (err: NodeJS.ErrnoException) => {

			clearTimeout(timer);
			reject(new Error(
				err.code === "EADDRINUSE"
					? "Port 8787 is already in use. Close the program using it, or an earlier auth run, and try again."
					: `Could not start the login server: ${err.message}`
			));

		});

		const timer = setTimeout(() => {
			server.close();
			server.closeAllConnections();
			reject(new Error("No login was completed within 2 minutes. Run auth again."));
		}, 120_000);

		server.listen(8787);

	});

};

async function requestTokens(params: Record<string, string>, previousRefreshToken?: string): Promise<StoredTokens> {

	const res = await fetch(TOKEN_URL, {
		method: "POST",
		body: new URLSearchParams({ client_id: requireEnv("TIDAL_CLIENT_ID"), ...params }),
	});

	if (!res.ok) {
		throw new Error(`Tidal token request failed (${res.status}): ${await res.text()}`);
	};

	const data = TokenResponse.parse(await res.json());
	const refreshToken = data.refresh_token ?? previousRefreshToken;
	if (!refreshToken) throw new Error("Tidal did not return a refresh token.");

	return {
		accessToken: data.access_token,
		refreshToken,
		expiresAt: Date.now() + data.expires_in * 1000
	};

};

export async function exchangeCode(code: string, verifier: string): Promise<StoredTokens> {
	return requestTokens({
		grant_type: "authorization_code",
		code,
		redirect_uri: REDIRECT_URI,
		code_verifier: verifier,
	});
};

export function refreshTokens(refreshToken: string) {
	return requestTokens({ grant_type: "refresh_token", refresh_token: refreshToken }, refreshToken);
};
