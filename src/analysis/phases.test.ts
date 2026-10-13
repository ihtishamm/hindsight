import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { dividePhases, phaseOfPly } from './phases';

// Real Lichess games with the phase boundaries Lichess itself reports (games API, division=true).
const GAMES = [
  { id: 'lZmYVpIl', middlegame: undefined, endgame: undefined, moves: 'e4 g6' },
  { id: 'KmfieK8l', middlegame: 17, endgame: undefined, moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 d6 Nc3 Nf6 Bc4 g6 O-O Bg7 Be3 O-O Qd2 Ng4 f3 Nxe3 Qxe3 Bxd4' },
  { id: 'auSVts6o', middlegame: 20, endgame: 38, moves: 'e4 Nc6 d4 d5 exd5 Qxd5 Nf3 Bg4 Be2 Nf6 Nc3 Qd7 O-O O-O-O Be3 Bxf3 Bxf3 Nxd4 Bxd4 Qxd4 Qe2 Qb6 b3 e6 Na4 Qb4 a3 Qf4 b4 Be7 Nc5 Bxc5 bxc5 c6 Rab1 Nd5 Bxd5 Rxd5 Rb4 Rxc5 Rxf4' },
];

describe('dividePhases', () => {
  for (const g of GAMES)
    it(`matches Lichess on ${g.id}`, () => {
      const chess = new Chess();
      const fens = [chess.fen()];
      for (const san of g.moves.split(' ')) {
        chess.move(san);
        fens.push(chess.fen());
      }
      expect(dividePhases(fens)).toEqual({ middlegame: g.middlegame, endgame: g.endgame });
    });

  it('caps the opening at move 20', () => {
    const fens = Array(60).fill(new Chess().fen());
    expect(dividePhases(fens).middlegame).toBe(40);
  });
});

describe('phaseOfPly', () => {
  it('assigns each move to the phase of the position it creates', () => {
    const phases = { middlegame: 20, endgame: 50 };
    expect(phaseOfPly(19, phases)).toBe('opening');
    expect(phaseOfPly(20, phases)).toBe('middlegame');
    expect(phaseOfPly(50, phases)).toBe('endgame');
  });
});
