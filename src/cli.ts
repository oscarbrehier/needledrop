import { Command, Option } from "commander";
import process from "node:process";
import { createInterface } from "node:readline/promises";
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
import { resolveIsrc, resolveTidalId } from "./db/library.js";
import { saveGeneratedPlaylist } from "./db/playlists.js";
import { embedAll } from "./embed/run.js";
import { parsePrompt } from "./search/parse.js";
import { searchCandidates } from "./search/query.js";
import { buildPlaylist } from "./search/builder.js";
import { addItems, buildPlaylistDescription, createPlaylist, defaultPlaylistName } from "./tidal/playlists.js";
import { exportOverrides, getOverride, importOverrides, saveOverride } from "./db/tagOverrides.js";
import { TagOverrideInput } from "./tag/schema.js";

async function confirm(message: string): Promise<boolean> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const answer = await rl.question(`${message} [y/N] `);
	rl.close();
	return answer.trim().toLowerCase() === "y";
};

const program = new Command();

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
	.option("--full", "Re-fetch every playlist's tracks, even ones that look unchanged")
	.action(async (opts: { playlist?: string; full?: boolean }) => {
		const summary = await syncLibrary(opts);
		console.log(
			`Synced ${summary.playlists} playlists (${summary.unchanged} unchanged), ${summary.tracks} tracks, ` +
			`${summary.uniqueIsrcs} unique ISRCs, ${summary.skipped} skipped`
		);
		if (summary.missing.length) {
			console.log(
				`No longer in your Tidal collection (kept in the database): ${summary.missing.join(", ")}`
			);
		};
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
	.option("--all", "Required alongside --retag to re-tag across the whole library, not just one playlist")
	.action(async (opts: { playlist?: string; limit?: string; dryRun?: boolean; retag?: boolean; all?: boolean }) => {

		const limit = opts.limit ? Number.parseInt(opts.limit, 10) : undefined;

		if (opts.retag && !opts.playlist && !opts.all) {
			throw new Error(
				"--retag would re-tag across your whole library. Pass --playlist <name> to scope it, " +
				"or --all to confirm you want the whole library."
			);
		};

		if (opts.dryRun) {

			const rows = selectRecordingsToTag({ playlist: opts.playlist });
			const { toTag, skipped } = selectCandidates(rows, { limit, retag: opts.retag });
			const inputs = toTag.map(buildTrackInput);

			console.error(`${inputs.length} recordings to tag, ${skipped} already up to date`);
			console.log(JSON.stringify(inputs, null, 2));
			console.log(JSON.stringify(buildMessages(inputs.slice(0, 20)), null, 2));
			return;

		}

		if (opts.retag) {

			const rows = selectRecordingsToTag({ playlist: opts.playlist });
			const { toTag } = selectCandidates(rows, { limit, retag: true });

			if (toTag.length === 0) {
				console.log("Nothing to re-tag.");
				return;
			};

			console.error(`This will re-tag ${toTag.length} recordings.`);
			if (!await confirm("Proceed?")) {
				console.log("Aborted.");
				return;
			};

		};

		const summary = await runTagging({ playlist: opts.playlist, limit, retag: opts.retag });
		console.log(`${summary.tagged} tagged, ${summary.failed} failed, ${summary.skipped} skipped`);

	});

program
	.command("override")
	.argument("[isrc]", "ISRC of the recording to correct")
	.description("Record a manual correction on top of the model's tags (search applies it, tag/--retag never writes it)")
	.option("--languages <list>", "Comma-separated languages, e.g. english,french")
	.option("--moods <list>", "Comma-separated moods from the fixed list")
	.option("--energy <n>", "Energy from 1 to 5")
	.option("--note <text>", "Why you're overriding this")
	.addOption(new Option("--export [path]", "Write all overrides to a tracked CSV instead of setting one").preset("overrides.csv"))
	.addOption(new Option("--import [path]", "Restore overrides from a CSV written by --export").preset("overrides.csv"))
	.action((isrc: string | undefined, opts: {
		languages?: string; moods?: string; energy?: string; note?: string;
		export?: string; import?: string;
	}) => {

		if (opts.export) {
			const count = exportOverrides(opts.export);
			console.log(`Wrote ${count} overrides to ${opts.export}`);
			return;
		};

		if (opts.import) {
			const count = importOverrides(opts.import);
			console.log(`Imported ${count} overrides from ${opts.import}`);
			return;
		};

		if (!isrc) throw new Error("Pass an ISRC, or --export / --import.");
		if (!opts.languages && !opts.moods && !opts.energy) {
			throw new Error("Pass at least one of --languages, --moods or --energy.");
		};

		const input = TagOverrideInput.parse({
			languages: opts.languages?.split(",").map((s) => s.trim().toLowerCase()),
			moods: opts.moods?.split(",").map((s) => s.trim().toLowerCase()),
			energy: opts.energy ? Number.parseInt(opts.energy, 10) : undefined,
			note: opts.note,
		});

		saveOverride(isrc, input);
		console.log(`Override saved for ${isrc}: ${JSON.stringify(getOverride(isrc))}`);

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
	.option("--size <n>", "Override how many tracks to return")
	.option("--explain", "Print the parsed filters")
	.option("--save", "Create the playlist in Tidal (preview only, unless passed)")
	.option("--name <text>", "Name for the saved playlist (default: derived from the prompt)")
	.action(async (prompt: string, opts: { size?: string; explain?: boolean; save?: boolean; name?: string }) => {

		const parsed = await parsePrompt(prompt);
		if (opts.size) parsed.size = Number.parseInt(opts.size, 10);

		if (opts.explain) console.error(`Filters: ${JSON.stringify(parsed)}`);

		const { candidates, relaxedEnergy, hardFilteredCount } = await searchCandidates(parsed);
		if (relaxedEnergy) console.error("Too few matches in that energy range, so it was relaxed.");

		if (candidates.length < parsed.size) {
			const hasEnergyFilter = !relaxedEnergy && (parsed.energyMin !== undefined || parsed.energyMax !== undefined);
			console.error(
				`Only ${candidates.length} of the requested ${parsed.size} tracks matched well enough; ` +
				`${hardFilteredCount} tracks matched the language${hasEnergyFilter ? " and energy" : ""} filter alone.`
			);
		};

		const rows = buildPlaylist(candidates, parsed.size);

		console.table(rows.map((row, i) => ({
			"#": i + 1,
			title: row.title,
			artist: row.artist ?? "unknown",
			moods: row.moods.join(", "),
			distance: row.distance.toFixed(4),
			score: row.score.toFixed(4),
			flag: row.lowConfidence ? "low confidence" : "",
		})));

		if (!opts.save) return;

		const trackIds = rows
			.map((row) => resolveTidalId(row.isrc))
			.filter((id): id is string => id !== null);

		if (trackIds.length === 0) throw new Error("Nothing to save: none of the matched tracks resolved to a Tidal id.");

		const name = opts.name ?? defaultPlaylistName(prompt);
		const tidalId = await createPlaylist(name, buildPlaylistDescription(prompt));

		await addItems(tidalId, trackIds);

		saveGeneratedPlaylist({
			tidalId,
			prompt,
			filters: parsed,
			trackIds: rows.map((row) => row.isrc),
		});

		console.log(`Saved "${name}" to Tidal (${tidalId}), ${trackIds.length} tracks.`);

	});

try {
	await program.parseAsync();
} catch (err) {

	console.log(err instanceof Error ? err.message : err);
	process.exitCode = 1;

};