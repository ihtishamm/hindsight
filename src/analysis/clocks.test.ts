import { describe, expect, it } from 'vitest';
import { formatClock, parseClocks } from './clocks';

describe('parseClocks', () => {
  it('reads remaining time and think time with increment', () => {
    const pgn = '1. e4 {[%clk 0:03:00]} e5 {[%clk 0:02:58]} 2. Nf3 {[%clk 0:02:55]} Nc6 {[%clk 0:02:50.5]}';
    const c = parseClocks(pgn, { TimeControl: '180+2' }, 4)!;
    expect(c.remaining).toEqual([180, 178, 175, 170.5]);
    expect(c.spent).toEqual([2, 4, 7, 9.5]);
  });
  it('ignores games without a clock comment on every move', () => {
    expect(parseClocks('1. e4 {[%clk 0:03:00]} e5', {}, 2)).toBeUndefined();
  });
});

describe('formatClock', () => {
  it('shows tenths when low', () => {
    expect(formatClock(9.4)).toBe('0:09.4');
    expect(formatClock(125)).toBe('2:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});
