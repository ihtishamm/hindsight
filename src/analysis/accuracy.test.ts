// Ported from lila modules/analyse/src/test/AccuracyPercentTest.scala
import { describe, expect, test } from 'vitest';
import { gameAccuracy } from './accuracy';
import { winPercent } from './winChance';

const compute = (cps: number[], whiteFirst = true) =>
  gameAccuracy([15, ...cps].map((cp) => winPercent({ cp })), whiteFirst);
const close = (x: number | undefined, target: number, tol: number) => {
  expect(x).toBeDefined();
  expect(Math.abs(x! - target)).toBeLessThanOrEqual(tol);
};

describe('game accuracy (Lichess parity)', () => {
  test('two good moves', () => {
    const a = compute([15, 15]);
    close(a.white, 100, 1);
    close(a.black, 100, 1);
  });
  test('white blunders on first move', () => {
    const a = compute([-900, -900]);
    close(a.white, 10, 5);
    close(a.black, 100, 1);
  });
  test('both blunder on first move', () => {
    const a = compute([-900, 0]);
    close(a.white, 10, 5);
    close(a.black, 10, 5);
  });
  test('20 perfect moves and a white blunder', () => {
    const a = compute([...Array(20).fill(15), -900]);
    close(a.white, 50, 5);
    close(a.black, 100, 1);
  });
  test('21 perfect moves and a black blunder', () => {
    const a = compute([...Array(21).fill(15), 900]);
    close(a.white, 100, 1);
    close(a.black, 50, 5);
  });
  const repeat = (n: number, pair: number[]) => Array.from({ length: n }, () => pair).flat();
  test('5 average moves (65 cpl) each', () => {
    const a = compute(repeat(5, [-50, 15]));
    close(a.white, 76, 8);
    close(a.black, 76, 8);
  });
  test('50 mediocre moves (150 cpl) each', () => {
    const a = compute(repeat(50, [-135, 15]));
    close(a.white, 54, 8);
    close(a.black, 54, 8);
  });
  test('50 terrible moves (500 cpl) each', () => {
    const a = compute(repeat(50, [-435, 15]));
    close(a.white, 20, 8);
    close(a.black, 20, 8);
  });
  test('black moves first, black blunders', () => {
    const a = compute([900, 900], false);
    close(a.black, 10, 5);
    close(a.white, 100, 1);
  });
});
