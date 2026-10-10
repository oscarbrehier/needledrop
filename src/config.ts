import process from "node:process";
import z from "zod";

const Env = z.object({
	DATABASE_PATH: z.string().min(1).default("data/needledrop.db"),
	TIDAL_CLIENT_ID: z.string().optional(),
	TIDAL_CLIENT_SECRET: z.string().optional(),
	LASTFM_API_KEY: z.string().optional(),
	LLM_API_KEY: z.string().optional(),
});

const env = Env.parse(process.env);

export const databasePath = env.DATABASE_PATH;

export function requireEnv(key: "TIDAL_CLIENT_ID" | "LASTFM_API_KEY"): string {
	const value = env[key];
	if (!value) throw new Error(`${key} is missing, add it to .env`);
	return value;
};