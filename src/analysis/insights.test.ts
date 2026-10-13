import { describe, expect, it } from 'vitest';
import { accuracyStanding, estimateRating, RATING_TABLE } from './insights';

describe('estimateRating', () => {
  it('is monotonic in accuracy', () => {
    let last = 0;
    for (let acc = 40; acc <= 100; acc += 0.5) {
      const r = estimateRating(acc, 30)!;
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });

  it('hits the calibration points and clamps outside them', () => {
    expect(estimateRating(80, 30)).toBe(1700);
    expect(estimateRating(10, 30)).toBe(RATING_TABLE[0][1]);
    expect(estimateRating(99.9, 30)).toBe(RATING_TABLE.at(-1)![1]);
  });

  it('pulls the estimate halfway towards a known rating', () => {
    expect(estimateRating(80, 30, 1200)).toBe(1450);
  });

  it('declines to rate very short games', () => {
    expect(estimateRating(90, 5)).toBeUndefined();
  });
});

describe('accuracyStanding', () => {
  it('puts the median accuracy of a band near the top 50%', () => {
    expect(accuracyStanding(81, 1800).top).toBeGreaterThanOrEqual(45);
    expect(accuracyStanding(81, 1800).top).toBeLessThanOrEqual(55);
  });
  it('ranks higher accuracy higher', () => {
    expect(accuracyStanding(95, 1500).top).toBeLessThan(accuracyStanding(70, 1500).top);
  });
});
