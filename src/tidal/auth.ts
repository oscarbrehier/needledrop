import { loadTokens, saveTokens } from "./tokens.js";
import { buildAuthRequest, exchangeCode, refreshTokens, waitForCallback } from "./oauth.js";

export async function login(): Promise<void> {

	const { url, verifier, state } = buildAuthRequest();
	const codePromise = waitForCallback(state);
	console.log(url);
	const code = await codePromise;
	const tokens = await exchangeCode(code, verifier);
	saveTokens(tokens);
	console.log("Logged into Tidal.");

};

export async function getAccessToken(): Promise<string> {

	const tokens = loadTokens();
	if (!tokens) throw new Error("Not logged in.");

	if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;

	const newTokens = await refreshTokens(tokens.refreshToken);
	saveTokens(newTokens);

	return newTokens.accessToken;

};