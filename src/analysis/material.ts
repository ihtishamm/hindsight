import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { Color } from './types';

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/** Material balance (in pawns) from `color`'s point of view. */
export function materialBalance(chess: Chess, color: Color): number {
  let total = 0;
  for (const row of chess.board())
    for (const sq of row) if (sq) total += (sq.color === color ? 1 : -1) * PIECE_VALUE[sq.type];
  return total;
}

/**
 * Static exchange evaluation: how much material the side to move wins by
 * starting a capture sequence on `square`, where each side may stop at any
 * point. Uses legal moves only, so pins are respected.
 */
export function staticExchange(chess: Chess, square: Square): number {
  const target = chess.get(square);
  if (!target) return 0;
  const captures = chess
    .moves({ verbose: true })
    .filter((m) => m.to === square && m.captured)
    .sort((a, b) => PIECE_VALUE[a.piece] - PIECE_VALUE[b.piece]);
  if (!captures.length) return 0;
  // Capture with the least valuable attacker; prefer queen promotions on capture.
  const capture = captures.find((m) => !m.promotion || m.promotion === 'q') ?? captures[0];
  chess.move(capture);
  const gain = PIECE_VALUE[target.type] + (capture.promotion ? PIECE_VALUE[capture.promotion] - 1 : 0);
  const value = gain - staticExchange(chess, square);
  chess.undo();
  return Math.max(0, value);
}

export interface HangingPiece {
  square: Square;
  piece: PieceSymbol;
  /** Material the opponent wins by capturing it. */
  loss: number;
}

/** The mover's pieces that the opponent (now to move) can win material on. */
export function hangingPieces(fenAfter: string, mover: Color): HangingPiece[] {
  const chess = new Chess(fenAfter);
  const result: HangingPiece[] = [];
  for (const row of chess.board())
    for (const sq of row)
      if (sq && sq.color === mover && sq.type !== 'k') {
        const loss = staticExchange(chess, sq.square);
        if (loss > 0) result.push({ square: sq.square, piece: sq.type, loss });
      }
  return result.sort((a, b) => b.loss - a.loss);
}

/**
 * Detects a real sacrifice: after the move, the mover leaves material (a minor
 * piece or more, net of anything just captured) that the opponent can take,
 * and that material wasn't already en prise before the move.
 */
export function sacrifice(move: Move, mover: Color): HangingPiece | undefined {
  const captured = move.captured ? PIECE_VALUE[move.captured] : 0;
  const before = new Map(hangingBeforeMove(move.before, mover).map((h) => [h.square, h.loss]));
  return hangingPieces(move.after, mover).find((h) => {
    if (h.piece === 'p') return false;
    const wasHanging = h.square !== move.to && (before.get(h.square) ?? 0) >= h.loss;
    return !wasHanging && h.loss - captured >= 2;
  });
}

/** Pieces of `mover` that were already hanging if the opponent could move now. */
function hangingBeforeMove(fenBefore: string, mover: Color): HangingPiece[] {
  const parts = fenBefore.split(' ');
  parts[1] = mover === 'w' ? 'b' : 'w';
  parts[3] = '-';
  try {
    const flipped = new Chess(parts.join(' '));
    if (flipped.inCheck()) return [];
    return hangingPieces(flipped.fen(), mover);
  } catch {
    return []; // the mover was in check: no meaningful "pass" position
  }
}

/**
 * Material swing for `color` along a line of UCI moves (positive = color gains),
 * measured at the first quiet point after `minPlies`: the first moment the next
 * move isn't a capture, so we don't stop halfway through an exchange.
 */
export function materialSwing(fen: string, uciLine: string[], color: Color, minPlies = 1, maxPlies = 8): number {
  const chess = new Chess(fen);
  const start = materialBalance(chess, color);
  for (let i = 0; i < Math.min(uciLine.length, maxPlies); i++) {
    try {
      chess.move(uciToMove(uciLine[i]));
    } catch {
      break;
    }
    if (i + 1 < minPlies) continue;
    const next = uciLine[i + 1];
    const nextCaptures = next !== undefined && chess.get(next.slice(2, 4) as Square) !== undefined;
    if (!nextCaptures) break;
  }
  return materialBalance(chess, color) - start;
}

export const uciToMove = (uci: string) => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  promotion: uci.length > 4 ? uci[4] : undefined,
});

/** Converts a UCI line to SAN, stopping at the first illegal move. */
export function uciLineToSan(fen: string, uciLine: string[], maxPlies = 99): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const uci of uciLine.slice(0, maxPlies)) {
    try {
      out.push(chess.move(uciToMove(uci)).san);
    } catch {
      break;
    }
  }
  return out;
}
