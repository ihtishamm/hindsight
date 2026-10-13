export type Color = 'w' | 'b';

/** Engine score, always from White's point of view. */
export interface Score {
  cp?: number;
  /** Moves to mate; positive = White mates, negative = Black mates. */
  mate?: number;
  /** Set for positions that are already over (checkmate, stalemate, ...). */
  result?: '1-0' | '0-1' | '1/2-1/2';
}

export interface EngineLine {
  score: Score;
  /** Principal variation in UCI notation. */
  pv: string[];
  depth: number;
}

/** Engine analysis of one position (lines sorted best-first). */
export interface PositionAnalysis {
  fen: string;
  lines: EngineLine[];
}

export type Classification =
  | 'book'
  | 'forced'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface GameMove {
  ply: number; // 1-based
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
}

export interface MoveReview extends GameMove {
  classification: Classification;
  /** Expected points (0..1) for the mover before / after the move, and with the best move. */
  epBefore: number;
  epAfter: number;
  epBest: number;
  /** Expected points lost compared to the engine's best move (>= 0). */
  epLoss: number;
  /** Lichess-style per-move accuracy, 0..100. */
  accuracy: number;
  scoreAfter: Score;
  bestUci?: string;
  bestSan?: string;
  bestLineSan: string[];
  /** Engine's expected continuation after the played move, in SAN. */
  replyLineSan: string[];
  opening?: string;
  explanation: string;
}

export interface PlayerSummary {
  name: string;
  rating?: string;
  accuracy: number;
  counts: Record<Classification, number>;
  /** Accuracy per game phase; undefined when the game never reached it. */
  phases: Record<'opening' | 'middlegame' | 'endgame', number | undefined>;
  /** Estimated playing strength shown in this game. */
  gameRating?: number;
  tactics?: number;
  strategy?: number;
  verdict: string;
}

export interface GameReview {
  headers: Record<string, string>;
  startFen: string;
  moves: MoveReview[];
  positions: PositionAnalysis[];
  white: PlayerSummary;
  black: PlayerSummary;
  opening?: string;
  /** First middlegame / endgame position index (see analysis/phases.ts). */
  phases: { middlegame?: number; endgame?: number };
  clocks?: import('./clocks').Clocks;
  depth: number;
}
