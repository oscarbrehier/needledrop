import { getDatabase } from "../src/db/client";
import { buildArtistField } from "../src/tidal/artists";

// One-off repair for rows synced before artist-name dedup existed. Rebuilds
// each stored "artist" field the same way sync does now, from its existing
// comma-separated segments, and only writes rows that actually change.
const db = getDatabase();

const rows = db.prepare("SELECT tidal_id AS tidalId, artist FROM tracks WHERE artist IS NOT NULL")
	.all() as { tidalId: string; artist: string }[];

const update = db.prepare("UPDATE tracks SET artist = ? WHERE tidal_id = ?");
let fixed = 0;

for (const row of rows) {

	const rebuilt = buildArtistField(row.artist.split(","));

	if (rebuilt !== row.artist) {
		update.run(rebuilt, row.tidalId);
		fixed++;
		console.log(`${row.artist}  ->  ${rebuilt}`);
	};

};

console.log(`Fixed ${fixed} of ${rows.length} track artist fields.`);
