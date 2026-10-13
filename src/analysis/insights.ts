/**
 * Per-player insights beyond the headline accuracy: accuracy per game phase,
 * how well tactical and quiet positions were handled, and an estimated
 * playing strength for this one game.
 */
import { gameAccuracy } from './accuracy';
import { phaseOfPly, type Phase, type Phases } from './phases';
import { expectedPoints } from './winChance';
import type { Color, MoveReview, PositionAnalysis } from './types';

export const PHASES: Phase[] = ['opening', 'middlegame', 'endgame'];

/**
 * Accuracy for each phase, using the same Lichess formula as the whole-game
 * figure, run over just that phase's moves (as Lichess does).
 */
export function phaseAccuracy(winPercents: number[], moves: MoveReview[], phases: Phases): Record<Color, Record<Phase, number | undefined>> {
  const out = { w: {}, b: {} } as Record<Color, Record<Phase, number | undefined>>;
  for (const phase of PHASES) {
    const inPhase = moves.filter((m) => phaseOfPly(m.ply, phases) === phase);
    if (!inPhase.length) {
      out.w[phase] = out.b[phase] = undefined;
      continue;
    }
    const from = inPhase[0].ply - 1;
    const to = inPhase.at(-1)!.ply;
    const acc = gameAccuracy(winPercents.slice(from, to + 1), inPhase[0].color === 'w');
    out.w[phase] = acc.white;
    out.b[phase] = acc.black;
  }
  return out;
}

/** A position is tactical when only one move holds, or the opponent just left something en prise. */
const TACTICAL_GAP = 0.1;

export interface StyleScores {
  /** Mean move accuracy in tactical positions (0..100), when there were enough of them. */
  tactics?: number;
  /** Mean move accuracy in quiet, undecided positions. */
  strategy?: number;
  tacticalMoves: number;
  quietMoves: number;
  verdict: string;
}

export function styleScores(moves: MoveReview[], positions: PositionAnalysis[], color: Color): StyleScores {
  const tactical: number[] = [];
  const quiet: number[] = [];
  moves.forEach((m, i) => {
    if (m.color !== color || m.classification === 'book' || m.classification === 'forced') return;
    const [best, second] = positions[i].lines;
    if (!best) return;
    const epBest = expectedPoints(best.score, color);
    const gap = second ? epBest - expectedPoints(second.score, color) : 0;
    const prev = moves[i - 1]?.classification;
    const opportunity = prev === 'mistake' || prev === 'blunder' || prev === 'miss';
    if (gap >= TACTICAL_GAP || opportunity) tactical.push(m.accuracy);
    else if (epBest > 0.15 && epBest < 0.85) quiet.push(m.accuracy);
  });
  const mean = (xs: number[], min: number) => (xs.length >= min ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
  const tactics = mean(tactical, 3);
  const strategy = mean(quiet, 5);
  return { tactics, strategy, tacticalMoves: tactical.length, quietMoves: quiet.length, verdict: verdict(tactics, strategy) };
}

export const scoreLabel = (x: number) => (x >= 90 ? 'Sharp' : x >= 78 ? 'Solid' : x >= 62 ? 'Shaky' : 'Poor');

function verdict(tactics?: number, strategy?: number): string {
  if (tactics === undefined && strategy === undefined) return 'Too short a game to judge.';
  if (tactics === undefined) return strategy! >= 78 ? 'Steady positional play; no real tactics were tested.' : 'Drifted in quiet positions; no real tactics were tested.';
  if (strategy === undefined) return tactics >= 78 ? 'Handled the tactics well in a sharp game.' : 'The tactics decided this sharp game, and they went wrong.';
  const diff = tactics - strategy;
  if (tactics >= 85 && strategy >= 85) return 'Strong all round: accurate in both sharp and quiet positions.';
  if (diff >= 10) return 'Tactically alert, but drifted when the position was quiet.';
  if (diff <= -10) return 'Good positional sense, but the critical tactical moments slipped.';
  if (tactics < 62 && strategy < 62) return 'Struggled in both tactical and quiet positions.';
  return 'Balanced: tactics and strategy at a similar level.';
}

/**
 * Estimated rating for a single game: the rating at which this accuracy is
 * typical. Calibrated on ~4,000 analysed Lichess blitz/rapid/classical games
 * sampled evenly across rating bands (400–3000): for each band we took the
 * median game accuracy, smoothed it to be monotonic, and inverted it. Lichess
 * accuracy uses the same formula as ours, so the scales line up.
 * Single-game accuracy is noisy (the middle half of players at any accuracy
 * spans ~800 points), so treat this as a rough read, not a rating.
 */
export const RATING_TABLE: [accuracy: number, rating: number][] = [
  [55, 400],
  [63, 550],
  [70, 750],
  [73, 1000],
  [75, 1250],
  [78, 1450],
  [80, 1700],
  [82, 1900],
  [84, 2100],
  [85, 2300],
  [86, 2550],
  [89, 2800],
  [92, 2950],
];

/** How much of the accuracy-based estimate to keep when the player's real rating is known. */
const ESTIMATE_WEIGHT = 0.5;

/**
 * @param knownRating the player's rating from the PGN, if any. One game says
 *   little on its own, so the estimate is pulled halfway towards it.
 */
export function estimateRating(accuracy: number, moveCount: number, knownRating?: number): number | undefined {
  if (moveCount < 10) return undefined; // too few moves to say anything
  const t = RATING_TABLE;
  let r: number;
  if (accuracy <= t[0][0]) r = t[0][1];
  else if (accuracy >= t.at(-1)![0]) r = t.at(-1)![1];
  else {
    const i = t.findIndex(([a]) => a >= accuracy);
    const [a0, r0] = t[i - 1];
    const [a1, r1] = t[i];
    r = r0 + ((accuracy - a0) / (a1 - a0)) * (r1 - r0);
  }
  if (knownRating && knownRating > 0) r = knownRating + ESTIMATE_WEIGHT * (r - knownRating);
  return Math.round(r / 25) * 25;
}

/**
 * Game-accuracy deciles (10th…90th percentile) per Lichess rating band, from
 * the same ~4,000-game sample as the rating table.
 */
const ACCURACY_DECILES: [band: number, deciles: number[]][] = [
  [600, [45, 54, 60, 66, 71, 75, 79, 83, 91]],
  [800, [43, 52, 59, 64, 70, 76, 81, 85, 92]],
  [1000, [49, 58, 64, 69, 73, 77, 81, 85, 91]],
  [1200, [53, 62, 67, 72, 74, 78, 81, 85, 92]],
  [1400, [58, 66, 70, 74, 78, 81, 84, 87, 91]],
  [1600, [56, 66, 71, 76, 79, 82, 85, 89, 94]],
  [1800, [62, 70, 74, 78, 81, 84, 87, 90, 93]],
  [2000, [69, 75, 79, 81, 83, 86, 88, 91, 95]],
  [2200, [73, 80, 82, 84, 86, 88, 90, 93, 95]],
  [2400, [71, 76, 79, 82, 85, 87, 89, 92, 95]],
  [2600, [73, 78, 81, 83, 86, 88, 89, 91, 94]],
  [2800, [75, 82, 84, 87, 89, 90, 91, 94, 95]],
];

/**
 * Where an accuracy sits among games by players of a similar rating:
 * the share of those games (0..100) that were *more* accurate, i.e. "top N%".
 */
export function accuracyStanding(accuracy: number, rating: number): { top: number; band: number } {
  const [band, d] = ACCURACY_DECILES.reduce((best, row) => (Math.abs(row[0] - rating) < Math.abs(best[0] - rating) ? row : best));
  // Percentile by linear interpolation between deciles, with 0 and 100 at the ends.
  const xs = [Math.min(d[0] - 15, accuracy), ...d, Math.max(100, accuracy)];
  const ps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  let pct = 100;
  for (let i = 1; i < xs.length; i++)
    if (accuracy <= xs[i]) {
      pct = ps[i - 1] + ((accuracy - xs[i - 1]) / Math.max(0.001, xs[i] - xs[i - 1])) * 10;
      break;
    }
  return { top: Math.max(1, Math.min(99, Math.round(100 - pct))), band };
}
