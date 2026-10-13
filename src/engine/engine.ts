import type { EngineLine, Score } from '../analysis/types';

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-17.1-lite-single-03e3232.js`;

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  multiPv?: number;
  /** Called with intermediate results as depth increases. */
  onUpdate?: (lines: EngineLine[]) => void;
}

interface Job {
  fen: string;
  opts: SearchOptions;
  resolve: (lines: EngineLine[]) => void;
  reject: (e: Error) => void;
}

/**
 * Minimal UCI wrapper around Stockfish running in a Web Worker. Searches are
 * queued; `stop()` cancels everything pending and halts the current search.
 */
export class Engine {
  private worker: Worker;
  private ready: Promise<void>;
  private queue: Job[] = [];
  private current?: { job: Job; lines: EngineLine[]; whiteToMove: boolean; cancelled: boolean };
  private multiPv = 1;
  private onLine?: (line: string) => void;

  constructor() {
    this.worker = new Worker(ENGINE_URL);
    this.worker.onmessage = (e: MessageEvent) => this.handle(String(e.data));
    this.ready = new Promise((resolve, reject) => {
      this.worker.onerror = (e) => reject(new Error(`Engine failed to load: ${e.message}`));
      this.onLine = (line) => {
        if (line === 'uciok') this.send('isready');
        if (line === 'readyok') {
          this.onLine = undefined;
          resolve();
        }
      };
    });
    this.send('uci');
  }

  analyse(fen: string, opts: SearchOptions = {}): Promise<EngineLine[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, opts, resolve, reject });
      void this.ready.then(() => this.next(), reject);
    });
  }

  /** Cancels queued searches and stops the running one (its promise rejects). */
  stop() {
    for (const job of this.queue.splice(0)) job.reject(new Error('cancelled'));
    if (this.current && !this.current.cancelled) {
      this.current.cancelled = true;
      this.send('stop');
    }
  }

  destroy() {
    this.stop();
    this.worker.terminate();
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private next() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift()!;
    const multiPv = job.opts.multiPv ?? 1;
    if (multiPv !== this.multiPv) {
      this.send(`setoption name MultiPV value ${multiPv}`);
      this.multiPv = multiPv;
    }
    this.current = { job, lines: [], whiteToMove: job.fen.split(' ')[1] === 'w', cancelled: false };
    this.send(`position fen ${job.fen}`);
    const limit = job.opts.movetime ? `movetime ${job.opts.movetime}` : `depth ${job.opts.depth ?? 16}`;
    this.send(`go ${limit}`);
  }

  private handle(line: string) {
    this.onLine?.(line);
    const cur = this.current;
    if (!cur) return;
    if (line.startsWith('info') && line.includes(' pv ')) {
      const parsed = parseInfo(line, cur.whiteToMove);
      if (!parsed) return;
      const [idx, ln] = parsed;
      cur.lines[idx] = ln;
      if (idx === 0) cur.lines.length = 1; // a new depth begins with the first PV
      if (!cur.cancelled) cur.job.opts.onUpdate?.(cur.lines.filter(Boolean));
    } else if (line.startsWith('bestmove')) {
      this.current = undefined;
      if (cur.cancelled) cur.job.reject(new Error('cancelled'));
      else cur.job.resolve(cur.lines.filter(Boolean));
      this.next();
    }
  }
}

/** Parses a UCI `info` line into [multipv index, line] with the score made White-POV. */
export function parseInfo(line: string, whiteToMove: boolean): [number, EngineLine] | undefined {
  const tokens = line.split(' ');
  const get = (key: string) => {
    const i = tokens.indexOf(key);
    return i >= 0 ? tokens[i + 1] : undefined;
  };
  if (tokens.includes('lowerbound') || tokens.includes('upperbound')) return;
  const depth = Number(get('depth'));
  const multipv = Number(get('multipv') ?? 1);
  const scoreIdx = tokens.indexOf('score');
  if (scoreIdx < 0) return;
  const sign = whiteToMove ? 1 : -1;
  const value = Number(tokens[scoreIdx + 2]) * sign;
  const score: Score = tokens[scoreIdx + 1] === 'mate' ? { mate: value } : { cp: value };
  const pv = tokens.slice(tokens.indexOf('pv') + 1);
  return [multipv - 1, { score, pv, depth }];
}
