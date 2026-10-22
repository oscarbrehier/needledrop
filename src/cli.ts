import { Command } from "commander";
import process from "node:process";
import { migrate } from "./db/migrate.js";
import { login } from "./tidal/auth.js";
import { getAuthStatus } from "./tidal/user.js";
import { syncLibrary } from "./tidal/sync.js";
import { getEnricher, listEnrichers } from "./enrich/index.js";
import { runEnricher } from "./enrich/runner.js";
import { coverage } from "./db/enrichment.js";
import { selectRecordingsToTag } from "./db/tags.js";
import { buildTrackInput } from "./tag/input.js";
import { buildMessages } from "./tag/prompt.js";
import { runTagging, selectCandidates } from "./tag/run.js";
import { findNearest } from "./db/embeddings.js";
import { resolveIsrc } from "./db/library.js";
import { embedAll } from "./embed/run.js";

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
	.command("coverage")
	.description("Show how many tracks each enrichment source has found")
	.action(() => {

		const rows = listEnrichers().map((enricher) => {
			const c = coverage(enricher.source);
			const share = c.total ? Math.round((c.found / c.total) * 100) : 0;
			return { source: enricher.source, ...c, "found %": share };
		});

		console.table(rows);

	});

program
	.command("tag")
	.description("Generate structured tags and a short description for each recording with the LLM")
	.option("--playlist <name>", "Only tag recordings from this playlist")
	.option("--limit <n>", "Only tag this many recordings")
	.option("--dry-run", "Print what would be sent to the model, without calling it")
	.option("--retag", "Also re-tag recordings whose stored prompt version is out of date")
	.action(async (opts: { playlist?: string; limit?: string; dryRun?: boolean; retag?: boolean }) => {

		const limit = opts.limit ? Number.parseInt(opts.limit, 10) : undefined;

		if (opts.dryRun) {

			const rows = selectRecordingsToTag({ playlist: opts.playlist });
			const { toTag, skipped } = selectCandidates(rows, { limit, retag: opts.retag });
			const inputs = toTag.map(buildTrackInput);

			console.error(`${inputs.length} recordings to tag, ${skipped} already up to date`);
			console.log(JSON.stringify(inputs, null, 2));
			console.log(JSON.stringify(buildMessages(inputs.slice(0, 20)), null, 2));
			return;

		}

		const summary = await runTagging({ playlist: opts.playlist, limit, retag: opts.retag });
		console.log(`${summary.tagged} tagged, ${summary.failed} failed, ${summary.skipped} skipped`);

	});

program
	.command("embed")
	.description("Compute a vector for each tagged recording")
	.action(async () => {
		const summary = await embedAll();
		console.log(`${summary.embedded} embedded, ${summary.skipped} already up to date`);
	});

program
	.command("similar")
	.argument("<track>", "Title or Tidal id of the track to find neighbours for")
	.description("Print the ten tracks nearest to a given track")
	.action((track: string) => {

		const target = resolveIsrc(track);
		const neighbours = findNearest(target.isrc, 10);

		console.log(`Nearest to ${target.title} — ${target.artist ?? "unknown"}:`);
		console.table(neighbours.map((n) => ({
			title: n.title,
			artist: n.artist ?? "unknown",
			distance: n.distance.toFixed(4),
		})));

	});

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