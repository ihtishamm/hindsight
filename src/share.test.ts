import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { parseClocks } from './analysis/clocks';
import { compactPgn, decodeGame, encodeGame, readShareHash, shareHash } from './share';

const PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[WhiteElo "1500"]
[BlackElo "1520"]
[TimeControl "180+2"]
[Termination "bob won by checkmate"]
[ECOUrl "https://www.chess.com/openings/Kings-Pawn"]

1. f3 {[%clk 0:03:00]} e5 {[%clk 0:02:59.5]} 2. g4 {[%clk 0:02:58]} Qh4# {[%clk 0:02:57]} 0-1`;

describe('share links', () => {
  it('round-trips a game through the link, keeping moves, headers and clocks', async () => {
    const chess = new Chess();
    chess.loadPgn(PGN);
    const headers = chess.getHeaders();
    const sans = chess.history();
    const clocks = parseClocks(PGN, headers, sans.length)!.remaining;
    const compact = compactPgn(headers, sans, clocks);
    expect(compact).not.toContain('ECOUrl');

    const hash = shareHash(await encodeGame(compact), { depth: 16, orientation: 'black', move: 3 });
    const back = await readShareHash(hash);
    expect(back).toMatchObject({ depth: 16, orientation: 'black', move: 3 });

    const again = new Chess();
    again.loadPgn(back!.pgn);
    expect(again.history()).toEqual(sans);
    expect(again.getHeaders().White).toBe('alice');
    expect(parseClocks(back!.pgn, again.getHeaders(), sans.length)!.remaining).toEqual(clocks);
  });

  it('ignores fragments without a game', async () => {
    expect(await readShareHash('#foo=1')).toBeUndefined();
  });

  it('decodes the uncompressed fallback', async () => {
    const plain = 'p' + btoa('1. e4 *').replace(/=+$/, '');
    expect(await decodeGame(plain)).toBe('1. e4 *');
  });
});
