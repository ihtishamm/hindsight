// Copies the single-threaded "lite" Stockfish 17.1 WASM build into public/engine.
// The single-threaded build needs no cross-origin isolation headers, so the app
// can be hosted on any static host (GitHub Pages, Netlify, ...).
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

const src = 'node_modules/stockfish/src';
const files = readdirSync(src).filter((f) => /^stockfish-.*-lite-single-[0-9a-f]+\.(js|wasm)$/.test(f));
if (files.length !== 2) throw new Error(`expected lite-single js+wasm in ${src}, found: ${files}`);
mkdirSync('public/engine', { recursive: true });
for (const f of files) copyFileSync(`${src}/${f}`, `public/engine/${f}`);
console.log('engine:', files.join(', '));
