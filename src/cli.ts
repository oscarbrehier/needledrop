import { Command } from "commander";
import process from "node:process";
import { migrate } from "./db/migrate.js";
import { getAccessToken, getAuthStatus, login } from "./tidal/auth.js";

const program = new Command();

function notImplemented(name: string) {
	return () => {
		throw new Error(`${name}: not implemented`);
	};
};

program
	.name("needledrop")
	.description("Build Tidal playlists from your own library with a text prompt")
	.version("0.1.0");

program
	.command("db:migrate")
	.description("Create or update the local database by applying any new migration files")
	.action(() => {

		const applied = migrate();
		console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Nothing to apply");

	});

const auth = program
	.command("auth")
	.description("Manage the Tidal login");

auth
	.command("login", { isDefault: true })
	.description("Log in to Tidal in the browser and save the token for later commands")
	.action(login);

auth
	.command("status")
	.description("Show which Tidal account is logged in")
	.action(async () => {
		const user = await getAuthStatus();
		console.log(`Logged in to Tidal as ${user.username} (id ${user.id}, country ${user.country})`);
	});

program
	.command("sync")
	.description("Copy your Tidal playlists and their tracks into the local database")
	.action(notImplemented("sync"));

program
	.command("enrich")
	.description("Fetch tags, genres and audio features for each track from Last.fm, MusicBrainz and ReccoBeats")
	.action(notImplemented("enrich"));

program
	.command("tag")
	.description("Generate structured tags and a short description for each recording with the LLM")
	.action(notImplemented("tag"));

program
	.command("embed")
	.description("Compute a vector for each tagged recording")
	.action(notImplemented("sync"));

program
	.command("similar")
	.argument("<track>", "Title or Tidal id of the track to find neighbours for")
	.description("Print the ten tracks nearest to a given track")
	.action(notImplemented("similar"));

program
	.command("make")
	.argument("<prompt>", "What you want to hear, in plain words")
	.description("Build a playlist from your library that matches a text prompt")
	.action(notImplemented("make"));

try {
	await program.parseAsync();
} catch (err) {

	console.log(err instanceof Error ? err.message : err);
	process.exitCode = 1;

};