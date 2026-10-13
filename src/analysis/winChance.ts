import type { Color, Score } from './types';

/**
 * Logistic fit of centipawns -> winning chances from Lichess
 * (lila ui/lib/src/ceval/winningChances.ts, lichess-org/lila#11148), fitted
 * on real Lichess games.
 */
const MULTIPLIER = -0.00368208;

/** Winning chances in [-1, 1] for a centipawn score (White POV). */
export const rawWinningChances = (cp: number): number => 2 / (1 + Math.exp(MULTIPLIER * cp)) - 1;

const clampCp = (cp: number) => Math.min(1000, Math.max(-1000, cp));

/** Lichess maps "mate in n" to a large pseudo-centipawn score that shrinks as n grows. */
export const mateToCp = (mate: number): number => (21 - Math.min(10, Math.abs(mate))) * 100 * Math.sign(mate || 1);

/** Winning chances in [-1, 1] from White's point of view. */
export function winningChances(score: Score): number {
  if (score.result) return score.result === '1-0' ? 1 : score.result === '0-1' ? -1 : 0;
  if (score.mate !== undefined) return rawWinningChances(mateToCp(score.mate));
  return rawWinningChances(clampCp(score.cp ?? 0));
}

/**
 * Expected points (0 = certain loss, 0.5 = even, 1 = certain win) for `color`.
 * This is the same idea as Chess.com's "Expected Points" model; theirs also
 * conditions on player rating, which is proprietary, so we use the Lichess fit.
 */
export function expectedPoints(score: Score, color: Color): number {
  const ep = (winningChances(score) + 1) / 2;
  return color === 'w' ? ep : 1 - ep;
}

/** Lichess "Win%" (0..100, White POV) used by the accuracy formula; mates are capped like any big score. */
export function winPercent(score: Score): number {
  if (score.result) return score.result === '1-0' ? 100 : score.result === '0-1' ? 0 : 50;
  const cp = score.mate !== undefined ? mateToCp(score.mate) : (score.cp ?? 0);
  return 50 + 50 * rawWinningChances(clampCp(cp));
}

export function formatScore(score: Score, short = false): string {
  if (score.result) return score.result === '1/2-1/2' ? '½-½' : score.result;
  if (score.mate !== undefined) return `${score.mate < 0 ? '-' : ''}M${Math.abs(score.mate)}`;
  const pawns = (score.cp ?? 0) / 100;
  const s = Math.abs(pawns).toFixed(short && Math.abs(pawns) >= 10 ? 0 : 1);
  return pawns > 0 ? `+${s}` : pawns < 0 ? `-${s}` : '0.0';
}
