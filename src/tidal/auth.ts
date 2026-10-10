import { loadTokens, saveTokens } from "./tokens.js";
import { buildAuthRequest, exchangeCode, refreshTokens, waitForCallback } from "./oauth.js";
import z from "zod";

const UserResponse = z.object({
	data: z.object({
		id: z.string(),
		attributes: z.object({
			username: z.string(),
			country: z.string(),
		}),
	}),
});

export async function login(): Promise<void> {

	const { url, verifier, state } = buildAuthRequest();
	const codePromise = waitForCallback(state);
	console.log(url);
	const code = await codePromise;
	const tokens = await exchangeCode(code, verifier);
	saveTokens(tokens);
	console.log("Logged into Tidal.");

};

export async function getAuthStatus() {

	const accessToken = await getAccessToken();
	if (!accessToken) {
		throw new Error("Not logged in to Tidal.");
	};

	const res = await fetch("https://openapi.tidal.com/v2/users/me", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/vnd.api+json",
		},
	});

	if (!res.ok) {
		throw new Error(`Could not read the Tidal account (${res.status}): ${await res.text()}`);
	};

	const { data } = UserResponse.parse(await res.json());
	return {
		id: data.id,
		username: data.attributes.username,
		country: data.attributes.country
	};

};

export async function getAccessToken(): Promise<string> {

	const tokens = loadTokens();
	if (!tokens) throw new Error("Not logged in.");

	if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;

	const newTokens = await refreshTokens(tokens.refreshToken);
	saveTokens(newTokens);

	return newTokens.accessToken;

};