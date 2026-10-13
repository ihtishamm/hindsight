// Builds src/data/openings.json from the Lichess chess-openings TSV files (CC0).
// Usage: node scripts/build-openings.mjs <dir-with-a..e.tsv>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';

const dir = process.argv[2];
if (!dir) throw new Error('usage: build-openings.mjs <tsv-dir>');

const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
const named = new Map(); // positions that carry their own name
const prefixes = new Set(); // every position reached along any book line

for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const rows = readFileSync(join(dir, `${f}.tsv`), 'utf8').trim().split('\n').slice(1);
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t');
    const chess = new Chess();
    const sans = pgn.replace(/\d+\./g, ' ').trim().split(/\s+/);
    for (const san of sans) {
      chess.move(san);
      prefixes.add(key(chess.fen()));
    }
    const k = key(chess.fen());
    if (!named.has(k)) named.set(k, `${eco} ${name}`);
  }
}

const out = {};
for (const k of prefixes) out[k] = named.get(k) ?? '';
writeFileSync('src/data/openings.json', JSON.stringify(out));
console.log(`${prefixes.size} book positions, ${named.size} named`);
