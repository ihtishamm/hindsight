import type { Move } from 'chess.js';
import { sacrifice } from './material';
import { expectedPoints } from './winChance';
import type { Classification, Color, PositionAnalysis, Score } from './types';

/**
 * Expected-points-lost bands, from Chess.com's public help article
 * "How are moves classified?". Each entry is the upper limit (inclusive).
 */
export const EP_BANDS: [number, Classification][] = [
  [0.0025, 'best'], // 0.00 in the article; small tolerance for engine noise between searches
  [0.02, 'excellent'],
  [0.05, 'good'],
  [0.1, 'inaccuracy'],
  [0.2, 'mistake'],
  [1, 'blunder'],
];

/** Gap to the second-best move that makes the played move the "only move". */
export const ONLY_MOVE_GAP = 0.15;
/** "You should not be completely winning even if you hadn't found it." */
export const ALREADY_WINNING = 0.9;

export interface ClassifyInput {
  move: Move;
  mover: Color;
  before: PositionAnalysis;
  /** Score of the position after the move (White POV). */
  scoreAfter: Score;
  inBook: boolean;
  legalMoveCount: number;
  /** The opponent's previous move, if any. */
  previous?: { classification: Classification; epBefore: number; to: string; captured: boolean };
}

export interface ClassifyResult {
  classification: Classification;
  epBefore: number;
  epAfter: number;
  epBest: number;
  epLoss: number;
}

export function classifyByLoss(loss: number): Classification {
  return EP_BANDS.find(([limit]) => loss <= limit)![1];
}

export function classifyMove(input: ClassifyInput): ClassifyResult {
  const { move, mover, before, scoreAfter } = input;
  const [bestLine, secondLine] = before.lines;
  const epBest = bestLine ? expectedPoints(bestLine.score, mover) : 0.5;
  const epAfter = expectedPoints(scoreAfter, mover);
  const playedBest = bestLine?.pv[0] === move.lan;
  // The played move is re-searched in the next position; if that search likes it
  // more than the best line did, nothing was lost.
  const epLoss = playedBest ? 0 : Math.max(0, epBest - epAfter);
  const result = (classification: Classification): ClassifyResult => ({
    classification,
    epBefore: epBest,
    epAfter,
    epBest,
    epLoss,
  });

  if (input.inBook) return result('book');
  if (input.legalMoveCount === 1) return result('forced');

  const base = classifyByLoss(epLoss);
  // Delivering mate is simply the best move, never a "great find".
  if (scoreAfter.result && scoreAfter.result !== '1/2-1/2') return result(base);

  if (base === 'best' || base === 'excellent') {
    const epSecond = secondLine ? expectedPoints(secondLine.score, mover) : undefined;
    const alreadyWinning = (epSecond ?? epBest) >= ALREADY_WINNING;

    // Brilliant: a (nearly) best move that sacrifices material, leaves us OK,
    // and wasn't needed just to stay completely winning.
    if (!alreadyWinning && epAfter >= 0.45 && sacrifice(move, mover)) return result('brilliant');

    // Great: the only move that keeps the result, i.e. everything else is much worse.
    const obviousRecapture =
      input.previous?.captured && move.captured !== undefined && move.to === input.previous.to;
    if (
      epSecond !== undefined &&
      epBest - epSecond >= ONLY_MOVE_GAP &&
      !alreadyWinning &&
      !obviousRecapture
    )
      return result('great');
    return result(base);
  }

  if (base === 'inaccuracy' || base === 'mistake' || base === 'blunder') {
    // Miss: the opponent just erred and we failed to cash in, ending up roughly
    // where we were before their mistake rather than creating a new problem.
    const prev = input.previous;
    if (prev && ['mistake', 'blunder', 'miss'].includes(prev.classification) && epLoss >= 0.1) {
      const epBeforeTheirError = 1 - prev.epBefore;
      if (epAfter >= epBeforeTheirError - 0.1) return result('miss');
    }
    // Missed a forced mate but still clearly better.
    const bestMates = bestLine?.score.mate !== undefined && Math.sign(bestLine.score.mate) === (mover === 'w' ? 1 : -1);
    if (bestMates && scoreAfter.mate === undefined && epAfter >= 0.6) return result('miss');
  }
  return result(base);
}
