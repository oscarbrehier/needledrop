import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type StoredTokens = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
};

const TOKEN_PATH = "data/tidal-token.json";

export function saveTokens(tokens: StoredTokens) {
	mkdirSync(dirname(TOKEN_PATH), { recursive: true });
	writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
};

export function loadTokens(): StoredTokens | null {
	if (!existsSync(TOKEN_PATH)) return null;
	return JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
};