// Shareable review links. Chessigma's "Share" copies a URL like
// /games/<uuid>?orientation=black&move=9, where the uuid points at analysis stored on
// their server, and keeps `move` in sync as you step through the game (replaceState).
// Hindsight has no server, so the link carries the game itself: a compact PGN, deflated
// and base64url-encoded, in the URL fragment (never sent to any server). Opening the
// link re-runs the analysis locally at the same depth, or reuses a cached review.
//
//   https://…/#game=<data>&depth=16&orientation=black&move=9

export interface ShareState {
  pgn: string;
  depth?: number;
  orientation?: 'white' | 'black';
  /** Ply to open at (0 = start). */
  move?: number;
}

/** Headers worth keeping in a shared link; the rest is noise for a review. */
const KEEP = ['Event', 'Site', 'Date', 'White', 'Black', 'Result', 'WhiteElo', 'BlackElo', 'WhiteTitle', 'BlackTitle', 'TimeControl', 'Termination', 'FEN', 'SetUp', 'Link'];

/** A minimal PGN: kept headers, SAN moves, and clock comments if the game had them. */
export function compactPgn(headers: Record<string, string>, sans: string[], clocks?: number[], startsWithBlack = false, firstMoveNumber = 1): string {
  const tags = KEEP.filter((k) => headers[k] && headers[k] !== '?').map((k) => `[${k} "${headers[k].replace(/"/g, "'")}"]`);
  const clk = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = (s % 60).toFixed(1).replace(/\.0$/, '').padStart(2, '0');
    return ` {[%clk ${h}:${String(m).padStart(2, '0')}:${sec}]}`;
  };
  const parts: string[] = [];
  sans.forEach((san, i) => {
    const ply = i + (startsWithBlack ? 1 : 0);
    const num = firstMoveNumber + Math.floor(ply / 2);
    if (ply % 2 === 0) parts.push(`${num}.`);
    else if (i === 0) parts.push(`${num}...`);
    parts.push(san + (clocks?.[i] !== undefined ? clk(clocks[i]) : ''));
  });
  parts.push(headers.Result && headers.Result !== '?' ? headers.Result : '*');
  return `${tags.join('\n')}\n\n${parts.join(' ')}`;
}

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** "z" + deflated base64url when the browser can compress, otherwise "p" + plain base64url. */
export async function encodeGame(pgn: string): Promise<string> {
  const bytes = new TextEncoder().encode(pgn);
  if (typeof CompressionStream === 'function') return `z${b64url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
  return `p${b64url(bytes)}`;
}

export async function decodeGame(data: string): Promise<string> {
  const bytes = unb64url(data.slice(1));
  if (data[0] === 'z') return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
  if (data[0] === 'p') return new TextDecoder().decode(bytes);
  throw new Error('Unknown share link format');
}

/** The fragment for an encoded game, e.g. "#game=z…&depth=16&orientation=black&move=9". */
export function shareHash(encoded: string, s: Omit<ShareState, 'pgn'>): string {
  const q = new URLSearchParams({ game: encoded });
  if (s.depth) q.set('depth', String(s.depth));
  if (s.orientation === 'black') q.set('orientation', 'black');
  if (s.move) q.set('move', String(s.move));
  return `#${q.toString()}`;
}

export const shareUrl = (hash: string) => `${location.origin}${location.pathname}${hash}`;

/** Reads a share link's fragment; undefined when there is no game in it. */
export async function readShareHash(hash: string): Promise<ShareState | undefined> {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const game = q.get('game');
  if (!game) return undefined;
  const depth = Number(q.get('depth'));
  const move = Number(q.get('move'));
  return {
    pgn: await decodeGame(game),
    depth: [12, 16, 20, 26].includes(depth) ? depth : undefined,
    orientation: q.get('orientation') === 'black' ? 'black' : 'white',
    move: Number.isInteger(move) && move > 0 ? move : 0,
  };
}
