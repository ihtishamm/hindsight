/**
 * Accuracy, following Lichess (lila modules/analyse/src/main/AccuracyPercent.scala).
 *
 * Per move: an exponential fit of how much Win% the move threw away.
 * Per game: the average of a volatility-weighted mean and a harmonic mean of
 * the move accuracies. The weighting makes moves in sharp, swingy phases count
 * more; the harmonic mean makes a few big blunders drag the score down hard.
 */

/** Accuracy (0..100) of a move given the mover's Win% before and after it. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100;
  const winDiff = winBefore - winAfter;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * winDiff) - 3.166924740191411;
  return Math.min(100, Math.max(0, raw + 1)); // +1: uncertainty bonus for imperfect analysis
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function standardDeviation(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
}

function weightedMean(pairs: [number, number][]): number | undefined {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  return total > 0 ? pairs.reduce((a, [x, w]) => a + x * w, 0) / total : undefined;
}

function harmonicMean(xs: number[]): number | undefined {
  return xs.length ? xs.length / xs.reduce((a, x) => a + 1 / Math.max(1, x), 0) : undefined;
}

export interface GameAccuracy {
  white?: number;
  black?: number;
  /** Per-move accuracy, aligned with the moves. */
  perMove: number[];
}

/**
 * @param winPercents White-POV Win% for every position: index 0 is the start
 *   position, index i is the position after move i.
 * @param whiteMovesFirst false when the game starts from a FEN with Black to move.
 */
export function gameAccuracy(winPercents: number[], whiteMovesFirst = true): GameAccuracy {
  const moveCount = winPercents.length - 1;
  if (moveCount < 1) return { perMove: [] };

  const windowSize = clamp(Math.floor(moveCount / 10), 2, 8);
  const windows: number[][] = [];
  const first = winPercents.slice(0, windowSize);
  for (let i = 0; i < Math.min(windowSize, winPercents.length) - 2; i++) windows.push(first);
  for (let i = 0; i + windowSize <= winPercents.length; i++) windows.push(winPercents.slice(i, i + windowSize));
  const weights = windows.map((w) => clamp(standardDeviation(w), 0.5, 12));

  const perMove: number[] = [];
  const byColor: Record<'w' | 'b', { acc: number[]; weighted: [number, number][] }> = {
    w: { acc: [], weighted: [] },
    b: { acc: [], weighted: [] },
  };
  for (let i = 0; i < moveCount; i++) {
    const isWhite = (i % 2 === 0) === whiteMovesFirst;
    const prev = winPercents[i];
    const next = winPercents[i + 1];
    const acc = isWhite ? moveAccuracy(prev, next) : moveAccuracy(100 - prev, 100 - next);
    perMove.push(acc);
    const bucket = byColor[isWhite ? 'w' : 'b'];
    bucket.acc.push(acc);
    bucket.weighted.push([acc, weights[i] ?? 1]);
  }

  const colorAccuracy = (c: 'w' | 'b') => {
    const w = weightedMean(byColor[c].weighted);
    const h = harmonicMean(byColor[c].acc);
    return w !== undefined && h !== undefined ? (w + h) / 2 : undefined;
  };
  return { white: colorAccuracy('w'), black: colorAccuracy('b'), perMove };
}
