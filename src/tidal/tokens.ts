import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tidalTokenPath } from "../config.js";

export type StoredTokens = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
};

export function saveTokens(tokens: StoredTokens) {
	mkdirSync(dirname(tidalTokenPath), { recursive: true });
	writeFileSync(tidalTokenPath, JSON.stringify(tokens));
};

export function loadTokens(): StoredTokens | null {
	if (!existsSync(tidalTokenPath)) return null;
	return JSON.parse(readFileSync(tidalTokenPath, "utf-8"));
};