// Builds public/sounds/*.wav from Kenney's CC0 sound packs (https://kenney.nl).
//
//   node scripts/build-sounds.mjs <impact-sounds dir> <interface-sounds dir>
//
// Download "Impact Sounds" and "Interface Sounds" from kenney.nl, unzip them, and pass
// the two folders. Requires ffmpeg. Each sound is a layered, trimmed and EQ'd mix of
// the source clips, so the result is short and crisp like a piece set down on a board.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [impactDir, uiDir] = process.argv.slice(2);
if (!impactDir || !uiDir) {
  console.error('usage: node scripts/build-sounds.mjs <impact-sounds dir> <interface-sounds dir>');
  process.exit(1);
}
const impact = (f) => join(impactDir, 'Audio', `${f}.ogg`);
const ui = (f) => join(uiDir, 'Audio', `${f}.ogg`);
const out = 'public/sounds';
mkdirSync(out, { recursive: true });

// Layers: [file, delay ms, gain]. The wood EQ keeps the sound round and soft: it trims
// the boom below 180 Hz and the clicky highs above ~3.8 kHz, with a little woody tick at 1.3 kHz.
const WOOD = 'highpass=f=180,lowpass=f=3800:p=2,equalizer=f=1300:t=q:w=1:g=5';
const SOUNDS = {
  move: { layers: [[impact('impactWood_light_002'), 0, 1]], length: 0.13, eq: WOOD, peak: -7 },
  capture: {
    layers: [
      [impact('impactWood_light_000'), 0, 1],
      [impact('impactWood_medium_003'), 0, 0.55],
    ],
    length: 0.16,
    eq: WOOD,
    peak: -6.5,
  },
  castle: {
    layers: [
      [impact('impactWood_light_004'), 0, 1],
      [impact('impactWood_light_001'), 110, 0.85],
    ],
    length: 0.24,
    eq: WOOD,
    peak: -6,
  },
  check: {
    layers: [
      [impact('impactWood_light_002'), 0, 1],
      [ui('glass_002'), 25, 0.22],
    ],
    length: 0.22,
    eq: WOOD,
    peak: -5,
  },
  promote: {
    layers: [
      [impact('impactWood_light_004'), 0, 1],
      [ui('confirmation_003'), 60, 0.3],
    ],
    length: 0.4,
    eq: WOOD,
    peak: -5,
  },
  end: {
    layers: [
      [impact('impactWood_light_000'), 0, 0.8],
      [ui('confirmation_002'), 70, 0.6],
    ],
    length: 0.65,
  },
  // Game over, from the reviewed player's side: a rising arpeggio for a win, a gentle
  // falling tone for a loss, and two level plucks (all square) for a draw.
  win: {
    layers: [
      [impact('impactWood_light_002'), 0, 0.7],
      [ui('confirmation_004'), 60, 0.8],
    ],
    length: 0.6,
    eq: 'lowpass=f=5000',
    peak: -6,
  },
  loss: {
    layers: [
      [impact('impactWood_light_003'), 0, 0.7],
      [ui('minimize_006'), 60, 0.9],
    ],
    length: 0.5,
    eq: 'lowpass=f=4000',
    peak: -7,
  },
  draw: {
    layers: [
      [impact('impactWood_light_001'), 0, 0.7],
      [ui('pluck_002'), 60, 0.8],
      [ui('pluck_002'), 210, 0.8],
    ],
    length: 0.45,
    eq: 'lowpass=f=4500',
    peak: -7,
  },
  error: { layers: [[ui('error_008'), 0, 0.6]], length: 0.18 },
  notify: { layers: [[ui('confirmation_001'), 0, 0.55]], length: 0.35 },
};

const ffmpeg = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stderr;
};

for (const [name, s] of Object.entries(SOUNDS)) {
  const inputs = s.layers.flatMap(([f]) => ['-i', f]);
  const chains = s.layers.map(([, delay, gain], i) => `[${i}:a]aformat=channel_layouts=mono:sample_rates=44100,adelay=${delay},volume=${gain}[l${i}]`);
  const mix = `${s.layers.map((_, i) => `[l${i}]`).join('')}amix=inputs=${s.layers.length}:normalize=0`;
  const fadeStart = Math.max(0, s.length - 0.06).toFixed(3);
  const tail = [s.eq, `atrim=0:${s.length}`, `afade=t=out:st=${fadeStart}:d=0.06`].filter(Boolean).join(',');
  const graph = (last) => `${chains.join(';')};${mix},${tail},${last}[out]`;

  // Pass 1 measures the peak; pass 2 brings every sound to the same peak level.
  const log = ffmpeg([...inputs, '-filter_complex', graph('volumedetect'), '-map', '[out]', '-f', 'null', '-']);
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(log)?.[1] ?? 0);
  const target = s.peak ?? -6;
  ffmpeg([...inputs, '-filter_complex', graph(`volume=${(target - peak).toFixed(2)}dB,alimiter=limit=0.84:attack=0.5:release=20:level=false`), '-map', '[out]', '-ac', '1', '-c:a', 'pcm_s16le', join(out, `${name}.wav`)]);
  console.log(`${name}.wav  (gain ${(target - peak).toFixed(1)} dB)`);
}
