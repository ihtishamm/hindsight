// Move sounds: short wooden recordings from Kenney's CC0 packs (built by scripts/build-sounds.mjs),
// decoded once into Web Audio buffers so they play with no latency.
export type SoundKind = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'end' | 'win' | 'loss' | 'draw' | 'error' | 'notify';

const KINDS: SoundKind[] = ['move', 'capture', 'check', 'castle', 'promote', 'end', 'win', 'loss', 'draw', 'error', 'notify'];

let ctx: AudioContext | undefined;
let muted = false;
const VOLUME = 0.7;
let loading: Promise<void> | undefined;
const buffers = new Map<SoundKind, AudioBuffer>();

export const setMuted = (m: boolean) => (muted = m);

function audio(): AudioContext | undefined {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

/** Fetches and decodes every sound; safe to call repeatedly. */
export function preloadSounds(): Promise<void> {
  const ac = audio();
  if (!ac) return Promise.resolve();
  loading ??= Promise.all(
    KINDS.map(async (kind) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}sounds/${kind}.wav`);
        buffers.set(kind, await ac.decodeAudioData(await res.arrayBuffer()));
      } catch {
        /* a missing sound just stays silent */
      }
    }),
  ).then(() => {});
  return loading;
}

export function playSound(kind: SoundKind) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const buffer = buffers.get(kind);
  if (!buffer) {
    // First sound of the session: play it as soon as it's decoded.
    void preloadSounds().then(() => buffers.has(kind) && playSound(kind));
    return;
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.value = VOLUME;
  src.connect(gain).connect(ac.destination);
  src.start();
}

/** Picks the sound for a move from its SAN. */
export function soundForSan(san: string, gameOver = false): SoundKind {
  if (gameOver || san.includes('#')) return 'end';
  if (san.includes('+')) return 'check';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('=')) return 'promote';
  if (san.includes('x')) return 'capture';
  return 'move';
}
