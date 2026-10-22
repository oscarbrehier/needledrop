
## How to use this roadmap

Build nine small steps in order, each ending in a command you can run and a check that proves it works. On your first pass, run every step on one playlist you know well, and only then scale to the whole library. Step 6 decides whether the idea works, so reach it quickly with rough versions of steps 1 to 5.

| #   | Step         | Command you end up with           | Done when                                                            |
| --- | ------------ | --------------------------------- | -------------------------------------------------------------------- |
| 1   | CLI skeleton | `pnpm dev --help`                 | Help lists a stub for every command                                  |
| 2   | Database     | `pnpm dev db:migrate`             | All tables exist, and a second run changes nothing                   |
| 3   | Tidal auth   | `pnpm dev auth`                   | A later command reuses the saved token without a browser             |
| 4   | Sync         | `pnpm dev sync`                   | Track counts for one playlist match the Tidal app                    |
| 5   | Enrich       | `pnpm dev enrich`                 | A coverage report shows the share of tracks each source found        |
| 6   | Tag          | `pnpm dev tag`                    | You accept the tags on at least 40 of 50 tracks you labelled by hand |
| 7   | Embed        | `pnpm dev embed`                  | Nearest neighbours of a track you know make sense                    |
| 8   | Search       | `pnpm dev make "<prompt>"`        | Three different prompts each return a list you would play            |
| 9   | Write back   | `pnpm dev make "<prompt>" --save` | The playlist appears in Tidal in the printed order                   |

Each step below gives the goal, a task checklist, hints for the parts that usually bite, and what to leave out. The code samples show a pattern on a toy case. None of them is a piece of the finished app.

## CLI patterns in TypeScript

A CLI is a program that reads its arguments, does one job, prints, and exits with a status code. `commander` turns the raw argument list into commands, arguments and options, and writes `--help` for you. These five patterns cover everything this project needs.

### 1. Entry point with one command

```ts
// src/cli.ts
import { Command } from "commander";

const program = new Command();

program
  .name("mycli")
  .description("A toy CLI")
  .version("0.1.0");

program
  .command("hello")
  .description("Check that the CLI runs")
  .action(() => {
    console.log("It works");
  });

await program.parseAsync();
```

Run it with `pnpm dev hello`. Everything after `pnpm dev` is passed to your script, so `pnpm dev --help` prints your own help. Use `parseAsync` instead of `parse`, because most of your actions will be async.

### 2. Arguments and options

```ts
program
  .command("greet")
  .argument("<name>", "who to greet")
  .option("-t, --times <n>", "how many times", "1")
  .option("--shout", "use capitals")
  .action((name: string, opts: { times: string; shout?: boolean }) => {
    const times = Number.parseInt(opts.times, 10);
    const text = opts.shout ? name.toUpperCase() : name;
    for (let i = 0; i < times; i++) console.log(`Hello ${text}`);
  });
```

- `<name>` is required and `[name]` is optional.
- Option values arrive as strings, so convert numbers yourself. An option with no value, like `--shout`, is a boolean.
- A flag written `--dry-run` arrives as `opts.dryRun`.

### 3. Keep the action thin

```ts
program
  .command("count")
  .option("--limit <n>", "max rows", "10")
  .action(async (opts: { limit: string }) => {
    const rows = await countThings({ limit: Number(opts.limit) });
    console.table(rows);
  });
```

The action converts flags into a typed object, calls one function, and prints. `countThings` lives in its own module and knows nothing about the terminal. That separation lets you test it, and later call it from a web UI.

### 4. Progress on long loops

```ts
for (const [i, item] of items.entries()) {
  const label = `${i + 1}/${items.length} ${item.name}`.padEnd(60);
  process.stderr.write(`\r${label}`);
  await handle(item);
}
process.stderr.write("\n");
```

`\r` moves the cursor back to the start of the line, so the counter overwrites itself. Write progress and logs to stderr and results to stdout, so results can be piped or saved without the noise.

### 5. Errors and exit codes

```ts
try {
  await program.parseAsync();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
```

Exit code 0 means success and anything else means failure, which is how shells and scripts know a command failed. Throw plain errors inside your modules and catch them once here. Set `process.exitCode` instead of calling `process.exit()`, so pending output is flushed first.

## Foundation: steps 1 to 3

### Step 1: CLI skeleton

The goal is that every command exists as a stub, so the shape of the tool is fixed before any logic.

- [x] Create the program in `cli.ts` with a name, description and version
- [x] Register stubs for `db:migrate`, `auth`, `sync`, `enrich`, `tag`, `embed` and `make`, each printing "not implemented"
- [x] Wrap `parseAsync` in the error handler from pattern 5
- [x] In `config.ts`, read `process.env` through a Zod schema and export the database path

Hints:

- Add `"types": ["node"]` to `compilerOptions` in `tsconfig.json` first. The config from the setup commands leaves it out, and with TypeScript 7 `pnpm typecheck` then reports `process` and every `node:` import as unknown. `pnpm dev` still runs, because `tsx` does not type-check.
- Validate environment variables lazily. If `config.ts` demands every key at import time, `auth` fails because the Last.fm key is missing. Mark keys optional in the schema and check each one in the command that needs it.
- Skip colours, spinners, config files and interactive prompts for now.

### Step 2: Database

The goal is one command that creates every table from numbered SQL files, where running it twice is harmless.

- [x] In `db/client.ts`, open the file with `better-sqlite3`, enable WAL mode and foreign keys, and load `sqlite-vec`
- [x] Write `001_init.sql` with `tracks`, `playlists`, `playlist_tracks`, `enrichment` and `tags`
- [x] Write a migration runner: a `migrations` table records applied file names, and new files run in order inside a transaction
- [x] Wire it to the `db:migrate` command

Hints:

- `better-sqlite3` is synchronous. There is no `await`, and `db.prepare(sql).run(params)` returns immediately.
- Loading the extension takes two lines: `import * as sqliteVec from "sqlite-vec"` and `sqliteVec.load(db)`. Confirm it with `select vec_version()` ([sqlite-vec docs](https://alexgarcia.xyz/sqlite-vec/js.html)).
- Write every insert as an upsert (`INSERT ... ON CONFLICT DO UPDATE`). Re-running a stage then never duplicates rows.
- Store list fields such as moods as JSON text. SQLite's `json_each` can filter on them later.
- Leave the vector table for step 7.

### Step 3: Tidal auth

The goal is that `auth` opens the browser once, and every later command reuses or refreshes the saved token silently. Tidal's playlist endpoints only accept a token from the authorization code flow, so an app-only token is not enough ([TIDAL discussion](https://github.com/orgs/tidal-music/discussions/6)).

- [x] Create an app in the Tidal developer portal, register a localhost redirect URI, and put the client ID in `.env`
- [x] Request the scopes `playlists.read`, `playlists.write` and `collection.read`
- [x] Generate a PKCE verifier and challenge, and build the authorize URL
- [x] Start a one-request `node:http` server on the redirect port to catch the `code`
- [x] Exchange the code for tokens and save them, with their expiry, in a file that git ignores
- [x] Write `getAccessToken()`, which refreshes the token when it is close to expiry
- [x] Add `auth status`, which calls `/users/me` and prints who is logged in

The PKCE pair is the only cryptography involved:

```ts
import { createHash, randomBytes } from "node:crypto";

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
```

The challenge goes in the authorize URL and the verifier goes in the token request.

Hints:

- Decide early between the official SDK and plain `fetch`. [`@tidal-music/api`](https://www.npmjs.com/package/@tidal-music/api) gives typed calls, but its Node setup asks for a `localStorage` shim and a credentials provider you write yourself. Give it a 30-minute trial, and fall back to `fetch` plus types generated from [Tidal's OpenAPI file](https://tidal-music.github.io/tidal-api-reference/tidal-api-oas.json) if it fights you.
- The authorize and token URLs are in the portal's authorization guide. Send a random `state` value too, and compare it in the callback.
- Add the token file to `.gitignore` before the first commit that could include it.

## Data: steps 4 and 5

### Step 4: Sync

The goal is a local database that mirrors your playlists and their tracks. Tidal returns 20 items per page whatever limit you ask for, so a 3,000-track library is at least 150 requests against a strict rate limit ([Mixarr issue #81](https://github.com/aquantumofdonuts/mixarr/issues/81)). Build the request layer before the sync logic.

- [x] Write one `request()` function: it adds the token and the `Accept: application/vnd.api+json` header, waits and retries on HTTP 429, and puts Tidal's error body in the thrown message
- [x] Run every call through a `p-queue` with concurrency 1 and a short interval
- [x] Write a `paginate()` generator that follows `links.next`
- [x] List your playlists from `/userCollectionPlaylists/me/relationships/items`
- [x] For each playlist, page through `/playlists/{id}/relationships/items` with `include=items`
- [x] Upsert playlists, tracks, and `playlist_tracks` with each track's position
- [x] Add `--playlist <name>` to sync a single playlist
- [x] Print a summary: playlists, tracks, unique ISRCs

An async generator hides pagination from the rest of the code:

```ts
async function* paginate<T>(firstUrl: string): AsyncGenerator<T> {
  let url: string | undefined = firstUrl;
  while (url) {
    const page: Page<T> = await request<Page<T>>(url);
    yield* page.items;
    url = page.next;
  }
}

for await (const thing of paginate<Thing>("/things")) {
  // one item at a time, pages fetched as needed
}
```

`Page<T>` here is a toy shape. Tidal's real responses are described in the hints.

Hints:

- Responses follow JSON:API. `data` holds only references (a type and an id), and the full track objects arrive in `included`, so join the two by id.
- Artist names are separate resources. Try `include=items,items.artists`, which works on the collection-tracks endpoint, and fall back to a second pass if the playlist endpoint rejects it.
- Tidal removed the older `/userCollections/{id}/...` paths on 14 September 2026. Tutorials and libraries from before then point at dead URLs, so trust the live reference.
- Check that the playlist listing includes playlists you created, as well as ones you saved.
- The same recording can appear under several Tidal ids (album, single, compilation). Keep one row per Tidal id, and group by ISRC from step 5 onward.
- Some items come back without track data because they left the catalogue. Expect nulls.
- Skip incremental sync, playlist folders and videos for now.

### Step 5: Enrich

The goal is that every track has the raw response from each outside source, stored untouched.

- [x] Define one `Enricher` interface and a generic runner
- [x] In the runner, select tracks with no row for that source, call the enricher through that source's queue, and store the JSON
- [ ] Store "not found" as a row with a null payload, so missing tracks are not retried on every run
- [x] Implement Last.fm first: top tags for the track, falling back to the artist's top tags
- [x] Add MusicBrainz: look up the recording by ISRC and keep its genres and tags
- [x] Add ReccoBeats audio features last
- [ ] Add `--source <name>` and a coverage report

One interface keeps the sources interchangeable:

```ts
interface Enricher {
  source: string;
  lookup(track: { isrc: string | null; title: string; artist: string }): Promise<unknown | null>;
}
```

The runner knows only this interface, so a fourth source later is one new file.

Hints:

- Clean titles before matching by name. Suffixes like "(Remastered 2011)", "- Live" and "feat. X" cause most misses.
- MusicBrainz expects a descriptive User-Agent and roughly one request per second. Check its rate-limiting page for the current rule.
- Check how ReccoBeats identifies tracks before building around it. You may need an extra id lookup.
- Leave the payloads uninterpreted. Deciding what a tag means is step 6's job, and raw data lets you change your mind for free.
- Expect gaps. Obscure tracks will have nothing on Last.fm, and the coverage report tells you how much that matters.

## Meaning: steps 6 and 7

### Step 6: Tag

The goal is that every unique recording gets structured tags and a short description, and that you have measured how good they are. This step decides whether the project works, so it gets a test set.

- [x] Hand-label 50 tracks you know well in a CSV: language, two or three moods, energy from 1 to 5. Do this before writing the prompt.
- [x] Define the tag schema in Zod, with moods limited to a fixed list of 20 to 30 words
- [x] Write the prompt: give title, artist, album, year, BPM, Last.fm tags and audio features, and ask for JSON matching the schema
- [x] Send about 20 tracks per call and validate each result, retrying a failed track on its own
- [x] Store the model name and a `prompt_version` with every row
- [x] Add `--limit <n>` and `--dry-run`
- [x] Write a small script that compares the tags with your hand labels and prints agreement per field

One Zod schema gives you both the runtime check and the TypeScript type:

```ts
import { z } from "zod";

const MOODS = ["calm", "melancholic", "euphoric"] as const; // your list goes here

export const TrackTags = z.object({
  moods: z.array(z.enum(MOODS)).min(1).max(3),
  energy: z.number().int().min(1).max(5),
  confidence: z.enum(["low", "medium", "high"]),
});

export type TrackTags = z.infer<typeof TrackTags>;
```

The remaining fields (themes, language, era, description) are yours to add.

Hints:

- A fixed mood list matters. Free text gives you "sad", "melancholy" and "melancholic" as three different values, and filters stop working.
- Language is the weakest field. Without lyrics the model infers it from the artist and title, so allow "instrumental" and "unknown" and tell the model to prefer them over guessing.
- Ask for a confidence value and read the low ones first. They show where enrichment is too thin.
- Use your provider's structured-output mode if it has one. It removes most JSON parsing failures.
- Tag per ISRC instead of per Tidal id, so duplicates cost nothing.
- If fewer than 40 of the 50 pass, fix the prompt and the enrichment before moving on. Embeddings cannot repair bad tags.

### Step 7: Embed

The goal is that every tagged recording has a vector, and that similar tracks sit near each other.

- [x] Add migration `002` with a `vec0` virtual table holding a track id and a 1,024-dimension vector, the size `bge-m3` produces ([model card](https://huggingface.co/Xenova/bge-m3))
- [x] In `embedder.ts`, load the model once and expose `embed(texts)`
- [x] Build the text to embed from the tags and description, and leave title and artist out
- [x] Embed in batches of 16 to 32, and store each vector with the model name
- [x] Add a `similar <track>` command that prints the ten nearest neighbours

Hints:

- The first run downloads the model, which is large. Load it lazily, so commands that do not embed stay fast.
- Use the same pooling and normalisation for stored texts and for queries. The model card uses `pooling: "cls"` with `normalize: true`.
- Pass vectors to SQLite as a `Float32Array` ([sqlite-vec docs](https://alexgarcia.xyz/sqlite-vec/js.html)).
- Write the embedded text as a natural sentence, such as "Slow, melancholic French chanson about leaving a city." It then resembles the prompts you will type.

## Payoff: steps 8 and 9

### Step 8: Search

The goal is that `make "<prompt>"` prints a ranked list of tracks from your library.

- [ ] In `parse.ts`, have the LLM turn the prompt into a Zod-validated object: hard filters, a semantic query string, and a size
- [ ] In `query.ts`, select candidate ids with SQL filters, then rank those candidates by vector distance to the embedded query
- [ ] In `builder.ts`, shape the list: one row per ISRC, at most two tracks per artist, cut to size
- [ ] Print a table: position, title, artist, moods, distance
- [ ] Add `--size <n>` and `--explain`, which prints the parsed filters

The parsed prompt is the contract between the two halves of search:

```ts
type ParsedPrompt = {
  filters: { language?: string; energyMin?: number; energyMax?: number };
  semantic: string;
  size: number;
};
```

For "mellow French songs for a rainy Sunday", the filters carry the language and an energy ceiling, and `semantic` carries "mellow, rainy Sunday".

Hints:

- Filters handle facts and the vector handles feel. If a word in the prompt maps to a column, it belongs in a filter.
- With a few thousand tracks you can rank candidates in plain TypeScript. A dot product over normalised vectors is cosine similarity.
- If the filters leave fewer tracks than the requested size, relax the softest one (usually energy) and say so in the output.
- Run the parsing call at temperature 0 and log its output. Most bad playlists trace back to a wrong filter.

### Step 9: Write back

The goal is that `--save` creates the playlist in Tidal, and that nothing is written without it.

- [ ] Make preview the default and require `--save` to write
- [ ] Create the playlist, then add tracks in small batches through the same rate-limited queue
- [ ] Add `--name <text>`, with a default derived from the prompt
- [ ] Record each generated playlist locally: prompt, parsed filters, track ids, date
- [ ] Exclude generated playlists from `sync`, so they do not feed back into your library data

Hints:

- Adding items is a POST to `/playlists/{id}/relationships/items` ([TIDAL discussion](https://github.com/orgs/tidal-music/discussions/6)). Check the API reference for the maximum number of items per request.
- Add tracks in the printed order, then check the order in the app. A batch that fails midway can leave a gap.
- Put a marker in the playlist description. It makes generated playlists easy to recognise and to filter out.

## After v1

Three additions are worth making once the nine steps work, in this order.

1. **Incremental sync.** Fetch only what changed since the last run, so a refresh takes seconds.
2. **A review UI.** A small local web app calling the same modules, for removing, reordering and regenerating tracks before saving.
3. **Audio embeddings.** A text-audio model captures how a track sounds, which helps where tags are thin.

## Sources

- [Mixarr issue #81](https://github.com/aquantumofdonuts/mixarr/issues/81): current Tidal v2 paths, page size, cursor pagination, removed endpoints (opened 3 October 2026)
- [TIDAL developer discussion #6](https://github.com/orgs/tidal-music/discussions/6): authorization code requirement, 20-item cap, playlist write endpoint
- [sqlite-vec JavaScript guide](https://alexgarcia.xyz/sqlite-vec/js.html): loading the extension and passing vectors
- [Xenova/bge-m3 model card](https://huggingface.co/Xenova/bge-m3): Transformers.js usage, pooling, vector size
