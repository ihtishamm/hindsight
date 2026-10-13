/**
 * Clock times from PGN comments (`{[%clk 0:02:57.3]}`), which both Chess.com
 * and Lichess write after every move when the game had a clock.
 */
export interface Clocks {
  /** Seconds left on the mover's clock after each move. */
  remaining: number[];
  /** Seconds spent thinking on each move (increment included). */
  spent: number[];
}

export function parseClocks(pgn: string, headers: Record<string, string>, plies: number): Clocks | undefined {
  const remaining = [...pgn.matchAll(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g)].map(([, h, m, s]) => Number(h) * 3600 + Number(m) * 60 + Number(s));
  if (!plies || remaining.length !== plies) return undefined;
  // "180+2" = 3 minutes plus 2 seconds per move. Daily games ("1/86400") have no useful think time.
  const tc = /^(\d+)(?:\+(\d+))?$/.exec(headers.TimeControl ?? '');
  const base = tc ? Number(tc[1]) : undefined;
  const inc = tc?.[2] ? Number(tc[2]) : 0;
  const spent = remaining.map((left, i) => {
    const before = i >= 2 ? remaining[i - 2] : (base ?? left);
    return Math.max(0, Math.round((before - left + inc) * 10) / 10);
  });
  return { remaining, spent };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = s < 20 ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
