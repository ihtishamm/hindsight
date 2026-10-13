import { Chess, DEFAULT_POSITION, type Move } from 'chess.js';
import { gameAccuracy } from './accuracy';
import { classifyMove } from './classify';
import { parseClocks } from './clocks';
import { explainMove } from './explain';
import { estimateRating, phaseAccuracy, styleScores } from './insights';
import { uciLineToSan } from './material';
import { bookKey, loadBook } from './openings';
import { dividePhases } from './phases';
import { winPercent } from './winChance';
import type {
  Classification,
  EngineLine,
  GameReview,
  MoveReview,
  PlayerSummary,
  PositionAnalysis,
  Score,
} from './types';

export const CLASSIFICATIONS: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'forced',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

export interface ParsedGame {
  headers: Record<string, string>;
  startFen: string;
  moves: Move[];
  /** The original text, kept for clock comments. */
  pgn?: string;
}

export function parseGame(pgn: string): ParsedGame {
  const chess = new Chess();
  const text = pgn.trim();
  // Accept a bare FEN too (single position, nothing to review but explorable).
  if (/^[rnbqkpRNBQKP1-8/]+ [wb] /.test(text)) {
    chess.load(text);
    return { headers: { FEN: text }, startFen: chess.fen(), moves: [] };
  }
  chess.loadPgn(text);
  const headers = chess.getHeaders();
  const moves = chess.history({ verbose: true });
  return { headers, startFen: moves[0]?.before ?? headers.FEN ?? DEFAULT_POSITION, moves, pgn: text };
}

/** Score of a finished position, or undefined if the game can continue. */
export function terminalScore(fen: string): Score | undefined {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0' };
  if (chess.isStalemate() || chess.isInsufficientMaterial()) return { result: '1/2-1/2' };
  return undefined;
}

export function positionScore(p: PositionAnalysis): Score {
  return terminalScore(p.fen) ?? p.lines[0]?.score ?? { cp: 0 };
}

/**
 * Hindsight correction. When the move played was the engine's own top choice,
 * the search of the next position is effectively one ply deeper, so its score
 * is the better estimate of the current position too. Walking backwards lets a
 * late-discovered mate or tactic flow back to the move that set it up.
 */
export function backPropagate(game: ParsedGame, positions: PositionAnalysis[]): PositionAnalysis[] {
  const out = positions.map((p) => ({ ...p, lines: [...p.lines] }));
  for (let i = game.moves.length - 1; i >= 0; i--) {
    const top = out[i].lines[0];
    if (!top || top.pv[0] !== game.moves[i].lan) continue;
    const next = positionScore(out[i + 1]);
    const mover = game.moves[i].color === 'w' ? 1 : -1;
    let score: Score;
    if (next.result) score = next.result === '1/2-1/2' ? { cp: 0 } : { mate: next.result === '1-0' ? 1 : -1 };
    else if (next.mate !== undefined) score = { mate: Math.sign(next.mate) === mover ? next.mate + mover : next.mate };
    else score = next;
    out[i].lines[0] = { ...top, score };
  }
  return out;
}

export interface ReviewCallbacks {
  analyse: (fen: string) => Promise<EngineLine[]>;
  onPosition?: (index: number, total: number, analysis: PositionAnalysis) => void;
  /** Called once the engine is done, before the (synchronous) report building starts. */
  onAnalysed?: () => Promise<void> | void;
}

/** Runs the engine over every position, then classifies and explains every move. */
export async function reviewGame(game: ParsedGame, depth: number, cb: ReviewCallbacks): Promise<GameReview> {
  const fens = [game.startFen, ...game.moves.map((m) => m.after)];
  const positions: PositionAnalysis[] = [];
  for (let i = 0; i < fens.length; i++) {
    const fen = fens[i];
    const lines = terminalScore(fen) ? [] : await cb.analyse(fen);
    positions.push({ fen, lines });
    cb.onPosition?.(i, fens.length, positions[i]);
  }
  await cb.onAnalysed?.();
  return buildReview(game, positions, depth);
}

/** Pure part of the review: everything that follows from engine output. */
export async function buildReview(game: ParsedGame, positions: PositionAnalysis[], depth: number): Promise<GameReview> {
  const book = await loadBook();
  positions = backPropagate(game, positions);
  const scores = positions.map(positionScore);
  const whiteFirst = game.startFen.split(' ')[1] === 'w';
  const winPercents = scores.map(winPercent);
  const acc = gameAccuracy(winPercents, whiteFirst);
  const phases = dividePhases(positions.map((p) => p.fen));

  const reviews: MoveReview[] = [];
  let inBook = game.startFen === DEFAULT_POSITION;
  let opening: string | undefined;

  game.moves.forEach((move, i) => {
    const before = positions[i];
    const after = positions[i + 1];
    const key = bookKey(move.after);
    inBook = inBook && key in book;
    if (inBook && book[key]) opening = book[key];

    const prev = reviews[i - 1];
    const legalMoveCount = new Chess(move.before).moves().length;
    const result = classifyMove({
      move,
      mover: move.color,
      before,
      scoreAfter: scores[i + 1],
      inBook,
      legalMoveCount,
      previous: prev && {
        classification: prev.classification,
        epBefore: prev.epBefore,
        to: game.moves[i - 1].to,
        captured: game.moves[i - 1].captured !== undefined,
      },
    });

    const best = before.lines[0];
    const bestLineSan = best ? uciLineToSan(before.fen, best.pv, 8) : [];
    const replyLineSan = after.lines[0] ? uciLineToSan(after.fen, after.lines[0].pv, 8) : [];
    const bestSan = best && best.pv[0] !== move.lan ? bestLineSan[0] : undefined;

    reviews.push({
      ply: i + 1,
      color: move.color,
      san: move.san,
      uci: move.lan,
      fenBefore: move.before,
      fenAfter: move.after,
      ...result,
      accuracy: acc.perMove[i] ?? 100,
      scoreAfter: scores[i + 1],
      bestUci: best?.pv[0],
      bestSan,
      bestLineSan,
      replyLineSan,
      opening: inBook ? opening : undefined,
      explanation: explainMove({
        move,
        mover: move.color,
        classification: result.classification,
        before,
        after,
        scoreAfter: scores[i + 1],
        bestSan,
        bestLineSan,
        replyLineSan,
        opening,
        previous: game.moves[i - 1],
      }),
    });
  });

  const byPhase = phaseAccuracy(winPercents, reviews, phases);
  const summary = (color: 'w' | 'b'): PlayerSummary => {
    const counts = Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0])) as Record<Classification, number>;
    for (const m of reviews) if (m.color === color) counts[m.classification]++;
    const name = color === 'w' ? 'White' : 'Black';
    const accuracy = (color === 'w' ? acc.white : acc.black) ?? 100;
    const style = styleScores(reviews, positions, color);
    const ownMoves = reviews.filter((m) => m.color === color && m.classification !== 'book').length;
    return {
      name: game.headers[name] && game.headers[name] !== '?' ? game.headers[name] : name,
      rating: game.headers[`${name}Elo`],
      accuracy,
      counts,
      phases: byPhase[color],
      gameRating: estimateRating(accuracy, ownMoves, Number(game.headers[`${name}Elo`]) || undefined),
      tactics: style.tactics,
      strategy: style.strategy,
      verdict: style.verdict,
    };
  };

  return {
    headers: game.headers,
    startFen: game.startFen,
    moves: reviews,
    positions,
    white: summary('w'),
    black: summary('b'),
    opening,
    phases,
    clocks: game.pgn ? parseClocks(game.pgn, game.headers, game.moves.length) : undefined,
    depth,
  };
}
