import { Command } from "commander";
import process from "node:process";
import { migrate } from "./db/migrate.js";
import { login } from "./tidal/auth.js";
import { getAuthStatus } from "./tidal/user.js";
import { paginate } from "./tidal/client.js";
import { syncLibrary } from "./tidal/sync.js";
import { lookupLastfm } from "./enrich/lastfm.js";
import { getEnricher } from "./enrich/index.js";
import { runEnricher } from "./enrich/runner.js";
import { lookupMusicbrainz } from "./enrich/musicbrainz.js";

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
	.option("--playlist <name>", "Sync only the playlist with this name")
	.action(async (opts: { playlist?: string }) => {
		const summary = await syncLibrary(opts);
		console.log(
			`Synced ${summary.playlists} playlists, ${summary.tracks} tracks, ` +
			`${summary.uniqueIsrcs} unique ISRCs, ${summary.skipped} skipped`
		);
	});

program
	.command("enrich")
	.description("Fetch tags, genres and audio features for each track from Last.fm, MusicBrainz and ReccoBeats")
	.requiredOption("--source <name>", "Which source to query, for example lastfm")
	.option("--limit <n>", "Only process this many pending tracks")
	.action(async (opts: { source: string; limit?: string }) => {

		const enricher = getEnricher(opts.source);
		const limit = opts.limit ? Number.parseInt(opts.limit, 10) : undefined;

		const summary = await runEnricher(enricher, { limit });
		console.log(`${enricher.source}: ${summary.found} found, ${summary.notFound} not found, ${summary.failed} failed`);

	});

program
	.command("tag")
	.description("Generate structured tags and a short description for each recording with the LLM")
	.action(async () => {

		const tags = await lookupLastfm({
			title: "Walk this Way (feat. Aerosmith)",
			artist: "Run-DMC, Aerosmith",
			tidalId: "1",
			isrc: null
		});

		console.log(tags);

	});

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