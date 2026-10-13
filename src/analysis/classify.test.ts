import { Chess } from 'chess.js';
import { describe, expect, test } from 'vitest';
import { classifyByLoss, classifyMove } from './classify';
import { hangingPieces, sacrifice } from './material';
import { expectedPoints, winningChances } from './winChance';

describe('expected points', () => {
  test('even position is 0.5, symmetric for both sides', () => {
    expect(expectedPoints({ cp: 0 }, 'w')).toBeCloseTo(0.5);
    expect(expectedPoints({ cp: 300 }, 'w') + expectedPoints({ cp: 300 }, 'b')).toBeCloseTo(1);
  });
  test('mate beats any centipawn score and terminal results are certain', () => {
    expect(winningChances({ mate: 5 })).toBeGreaterThan(winningChances({ cp: 1000 }));
    expect(expectedPoints({ result: '0-1' }, 'b')).toBe(1);
  });
});

describe('Chess.com expected-points bands', () => {
  test.each([
    [0, 'best'],
    [0.015, 'excellent'],
    [0.04, 'good'],
    [0.08, 'inaccuracy'],
    [0.15, 'mistake'],
    [0.35, 'blunder'],
  ])('loss %f -> %s', (loss, cls) => expect(classifyByLoss(loss)).toBe(cls));
});

describe('sacrifice detection', () => {
  test('a queen walking into a bishop is hanging', () => {
    const m = new Chess('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2').move('Qg4');
    expect(hangingPieces(m.after, 'w')).toEqual([{ square: 'g4', piece: 'q', loss: 9 }]);
  });
  test('Bxf7+ into a defended square is a sacrifice, an even trade is not', () => {
    const sac = new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3').move('Bxf7+');
    expect(sacrifice(sac, 'w')?.piece).toBe('b');
    const trade = new Chess('rnbqkbnr/ppp2ppp/8/3pp3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 3').move('exd5');
    expect(sacrifice(trade, 'w')).toBeUndefined();
  });
});

describe('classifyMove', () => {
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  const before = {
    fen,
    lines: [
      { score: { cp: 30 }, pv: ['f1b5'], depth: 16 },
      { score: { cp: 25 }, pv: ['f1c4'], depth: 16 },
    ],
  };
  const input = (san: string, cp: number) => ({
    move: new Chess(fen).move(san),
    mover: 'w' as const,
    before,
    scoreAfter: { cp },
    inBook: false,
    legalMoveCount: 30,
  });
  test('engine move is best', () => expect(classifyMove(input('Bb5', 30)).classification).toBe('best'));
  test('dropping two pawns is a blunder', () => expect(classifyMove(input('Ng5', -200)).classification).toBe('blunder'));
  test('book overrides everything', () => expect(classifyMove({ ...input('Ng5', -200), inBook: true }).classification).toBe('book'));
});
