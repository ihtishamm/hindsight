import type { Move } from 'chess.js';
import { hangingPieces, materialSwing, PIECE_NAME, sacrifice } from './material';
import { formatScore } from './winChance';
import type { Classification, Color, PositionAnalysis, Score } from './types';


export interface ExplainInput {
  move: Move;
  mover: Color;
  classification: Classification;
  before: PositionAnalysis;
  after: PositionAnalysis;
  scoreAfter: Score;
  bestSan?: string;
  bestLineSan: string[];
  replyLineSan: string[];
  opening?: string;
  /** The opponent's previous move. */
  previous?: Move;
}

const side = (c: Color) => (c === 'w' ? 'White' : 'Black');
const pieceWord = (n: number) => (n >= 9 ? 'a queen' : n >= 5 ? 'an exchange or more' : n >= 3 ? 'a piece' : n >= 2 ? 'two pawns' : 'a pawn');
const line = (sans: string[], n = 4) => sans.slice(0, n).join(' ');
const moverMates = (s: Score, mover: Color) => s.mate !== undefined && Math.sign(s.mate) === (mover === 'w' ? 1 : -1);
const opponentMates = (s: Score, mover: Color) => s.mate !== undefined && !moverMates(s, mover);

/** Short, coach-style explanation of a move, built from engine lines and simple tactical checks. */
export function explainMove(i: ExplainInput): string {
  const { move, mover, classification: cls, before, after, scoreAfter } = i;
  const best = before.lines[0];
  const opp: Color = mover === 'w' ? 'b' : 'w';
  const parts: string[] = [];

  if (scoreAfter.result) {
    if (scoreAfter.result === '1/2-1/2') return `${move.san} ends the game in a draw.`;
    return `${move.san} is checkmate. ${side(mover)} wins!`;
  }

  // What happens after the played move, according to the engine.
  const reply = after.lines[0];
  // Material the played move nets once the dust settles (move + best reply).
  const gain = reply ? materialSwing(move.before, [move.lan, ...reply.pv], mover, 2) : 0;
  // Material lost to the opponent's best reply.
  const swingAfter = reply ? materialSwing(move.after, reply.pv, mover, 1) : 0;
  const swingBest = best ? materialSwing(move.before, best.pv, mover, 2) : 0;
  const recapture = i.previous?.captured !== undefined && move.captured !== undefined && move.to === i.previous.to;

  switch (cls) {
    case 'book':
      return i.opening ? `A known opening move — ${i.opening}.` : 'A known opening move. Still in theory.';
    case 'forced':
      return `${move.san} was the only legal move.`;
    case 'brilliant': {
      const sac = sacrifice(move, mover);
      parts.push(
        sac
          ? `${move.san}!! A real sacrifice: the ${PIECE_NAME[sac.piece]} on ${sac.square} can be taken, but the engine shows it pays off.`
          : `${move.san}!! A brilliant, counter-intuitive move.`,
      );
      if (i.replyLineSan.length) parts.push(`A possible continuation: ${line(i.replyLineSan, 5)}.`);
      return parts.join(' ');
    }
    case 'great': {
      const second = before.lines[1];
      parts.push(`${move.san} is a great find — the only move that keeps the balance in ${side(mover)}'s favour.`);
      if (second) parts.push(`Anything else drops to about ${formatScore(second.score)}.`);
      return parts.join(' ');
    }
  }

  if (cls === 'best' || cls === 'excellent' || cls === 'good') {
    const opener = cls === 'best' ? `${move.san} is the best move.` : cls === 'excellent' ? `${move.san} is an excellent move.` : `${move.san} is a decent move.`;
    parts.push(opener);
    if (moverMates(scoreAfter, mover)) parts.push(`It forces mate in ${Math.abs(scoreAfter.mate!)}.`);
    else if (opponentMates(scoreAfter, mover)) parts.push(`The position was already lost, though — ${line(i.replyLineSan, 4)}.`);
    else if (recapture) parts.push(`It recaptures the ${PIECE_NAME[move.captured!]}.`);
    else if (gain >= 2 && (move.captured || move.san.includes("+"))) parts.push(`It wins ${pieceWord(gain)}.`);
    else if (move.san.includes('+')) parts.push('It comes with check.');
    else if (move.isKingsideCastle() || move.isQueensideCastle()) parts.push('Castling gets the king to safety and connects the rooks.');
    else if (move.isPromotion()) parts.push('Promoting brings a new queen into play.');
    else if (move.captured) parts.push(`It captures the ${PIECE_NAME[move.captured]}.`);
    if (cls === 'good' && i.bestSan) parts.push(`${i.bestSan} was a little more precise.`);
    return parts.join(' ');
  }

  // Inaccuracy, mistake, miss, blunder: find the concrete reason.
  const label = { inaccuracy: 'an inaccuracy', mistake: 'a mistake', blunder: 'a blunder', miss: 'a missed opportunity' }[cls];
  parts.push(`${move.san} is ${label}.`);

  const hanging = hangingPieces(move.after, mover)[0];
  if (opponentMates(scoreAfter, mover)) {
    parts.push(`It allows a forced mate in ${Math.abs(scoreAfter.mate!)}${i.replyLineSan.length ? `: ${line(i.replyLineSan, 6)}` : ''}.`);
  } else if (cls === 'miss' && moverMates(best?.score ?? {}, mover)) {
    parts.push(`There was a forced mate in ${Math.abs(best!.score.mate!)} starting with ${i.bestSan}.`);
  } else if (cls === 'miss' && swingBest >= 2) {
    parts.push(`The opponent's last move left an opening — ${i.bestSan} would have won ${pieceWord(swingBest)}.`);
  } else if (cls === 'miss') {
    parts.push(`The opponent's last move was a mistake, but this lets them off the hook.`);
  } else if (hanging && hanging.square === move.to && hanging.loss >= 2) {
    parts.push(`It leaves the ${PIECE_NAME[hanging.piece]} on ${hanging.square} en prise${i.replyLineSan[0] ? ` — ${i.replyLineSan[0]} wins it` : ''}.`);
  } else if (swingAfter <= -2) {
    parts.push(`After ${line(i.replyLineSan, 3) || 'the best reply'}, ${side(mover)} loses ${pieceWord(-swingAfter)}.`);
  } else if (hanging && hanging.loss >= 2) {
    parts.push(`It leaves the ${PIECE_NAME[hanging.piece]} on ${hanging.square} undefended.`);
  } else if (i.replyLineSan[0]) {
    parts.push(`It gives ${side(opp)} the chance to play ${i.replyLineSan[0]}.`);
  }

  if (i.bestSan && !(cls === 'miss' && parts.length > 1 && parts[1].includes(i.bestSan))) {
    if (moverMates(best?.score ?? {}, mover) && cls !== 'miss') parts.push(`${i.bestSan} would have forced mate in ${Math.abs(best!.score.mate!)}.`);
    else if (swingBest >= 2 && swingBest > swingAfter) parts.push(`${i.bestSan} was better, winning ${pieceWord(swingBest)}.`);
    else parts.push(`Better was ${i.bestSan}${i.bestLineSan.length > 1 ? ` (${line(i.bestLineSan, 4)})` : ''}.`);
  }
  if (best) parts.push(`Evaluation: ${formatScore(best.score)} → ${formatScore(scoreAfter)}.`);
  return parts.join(' ');
}
