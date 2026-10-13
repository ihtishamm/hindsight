// End-to-end review against the real Stockfish build in Node. Slow, so opt-in:
//   ENGINE_TESTS=1 npx vitest run review.engine
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { afterAll, describe, expect, test } from 'vitest';
import { parseInfo } from '../engine/engine';
import { parseGame, reviewGame } from './review';
import type { EngineLine } from './types';

const ENGINE = 'node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js';

function nodeEngine() {
  const proc = spawn('node', [ENGINE]);
  const rl = createInterface({ input: proc.stdout });
  let pending: { lines: EngineLine[]; white: boolean; resolve: (l: EngineLine[]) => void } | undefined;
  rl.on('line', (line) => {
    if (!pending) return;
    if (line.startsWith('info') && line.includes(' pv ')) {
      const parsed = parseInfo(line, pending.white);
      if (parsed) {
        pending.lines[parsed[0]] = parsed[1];
        if (parsed[0] === 0) pending.lines.length = 1;
      }
    } else if (line.startsWith('bestmove')) {
      const p = pending;
      pending = undefined;
      p.resolve(p.lines.filter(Boolean));
    }
  });
  proc.stdin.write('uci\nsetoption name MultiPV value 2\nisready\n');
  return {
    analyse: (fen: string, depth: number) =>
      new Promise<EngineLine[]>((resolve) => {
        pending = { lines: [], white: fen.split(' ')[1] === 'w', resolve };
        proc.stdin.write(`position fen ${fen}\ngo depth ${depth}\n`);
      }),
    quit: () => proc.kill(),
  };
}

// Morphy vs. Duke of Brunswick & Count Isouard, Paris 1858 ("Opera Game").
const OPERA = `1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

describe.runIf(process.env.ENGINE_TESTS)('review with real engine', () => {
  const engine = nodeEngine();
  afterAll(() => engine.quit());

  test('Opera Game', { timeout: 300_000 }, async () => {
    const review = await reviewGame(parseGame(OPERA), 14, { analyse: (fen) => engine.analyse(fen, 14) });
    for (const m of review.moves)
      console.log(
        `${Math.ceil(m.ply / 2)}${m.color === "w" ? "." : "..."} ${m.san.padEnd(7)} ${m.classification.padEnd(10)} loss=${m.epLoss.toFixed(3)} acc=${m.accuracy.toFixed(0)}  ${m.explanation}`,
      );
    console.log('accuracy', review.white.accuracy.toFixed(1), review.black.accuracy.toFixed(1), review.opening);
    const byPly = (san: string) => review.moves.find((m) => m.san === san)!;
    expect(byPly('e4').classification).toBe('book');
    expect(byPly('Rd8#').classification).toBe('best');
    expect(review.white.accuracy).toBeGreaterThan(review.black.accuracy);
  });
});
