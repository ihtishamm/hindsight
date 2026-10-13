/**
 * Game phases, following Lichess (scalachess `Divider.scala`).
 *
 * The middlegame starts at the first position where any of these holds:
 *   - 10 or fewer major and minor pieces are left on the board,
 *   - either side's back rank has fewer than 4 pieces on it (pieces developed),
 *   - the armies are "mixed": many 2×2 regions hold pieces of both colours
 *     near the enemy camp (a score over 150).
 * The endgame starts at the first position with 6 or fewer major and minor pieces.
 *
 * On top of Lichess's rules, the opening is capped at move 20 so that a slow
 * maneuvering game still gets a middlegame.
 */

export interface Phases {
  /** Index of the first middlegame position (0 = start position), if any. */
  middlegame?: number;
  /** Index of the first endgame position, if any. */
  endgame?: number;
}

export type Phase = 'opening' | 'middlegame' | 'endgame';

const OPENING_PLY_CAP = 40;

/** Board as rows from rank 8 down to rank 1; each cell is 'w', 'b' or '' plus the piece letter. */
function parseBoard(fen: string): { color: 'w' | 'b'; piece: string }[][] {
  return fen
    .split(' ')[0]
    .split('/')
    .map((row) => {
      const cells: { color: 'w' | 'b'; piece: string }[] = [];
      for (const ch of row) {
        if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) cells.push({ color: 'w', piece: '' });
        else cells.push({ color: ch === ch.toUpperCase() ? 'w' : 'b', piece: ch.toLowerCase() });
      }
      return cells;
    });
}

function majorsAndMinors(board: ReturnType<typeof parseBoard>): number {
  let n = 0;
  for (const row of board) for (const c of row) if (c.piece && c.piece !== 'p' && c.piece !== 'k') n++;
  return n;
}

function backrankSparse(board: ReturnType<typeof parseBoard>): boolean {
  const white = board[7].filter((c) => c.piece && c.color === 'w').length;
  const black = board[0].filter((c) => c.piece && c.color === 'b').length;
  return white < 4 || black < 4;
}

/** Score of a 2×2 region whose lower rank is `y` (1..7) holding `w` white and `b` black pieces. */
function regionScore(w: number, b: number, y: number): number {
  switch (`${w}${b}`) {
    case '00': return 0;
    case '10': return 1 + (8 - y);
    case '20': return y > 2 ? 2 + (y - 2) : 0;
    case '30': return y > 1 ? 3 + (y - 1) : 0;
    case '40': return y > 1 ? 3 + (y - 1) : 0;
    case '01': return 1 + y;
    case '11': return 5 + Math.abs(4 - y);
    case '21': return 4 + (y - 1);
    case '31': return 5 + (y - 1);
    case '02': return y < 6 ? 2 + (6 - y) : 0;
    case '12': return 4 + (7 - y);
    case '22': return 7;
    case '03': return y < 7 ? 3 + (7 - y) : 0;
    case '13': return 5 + (7 - y);
    case '04': return y < 7 ? 3 + (7 - y) : 0;
    default: return 0;
  }
}

export function mixedness(fen: string): number {
  const board = parseBoard(fen);
  // board[0] is rank 8; convert to rank index r (0 = rank 1).
  const at = (file: number, rank: number) => board[7 - rank][file];
  let total = 0;
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) {
      let w = 0;
      let b = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const c = at(x + dx, y + dy);
        if (c.piece) c.color === 'w' ? w++ : b++;
      }
      total += regionScore(w, b, y + 1);
    }
  return total;
}

/** Splits a game into phases. `fens[0]` is the start position, `fens[i]` the position after ply i. */
export function dividePhases(fens: string[]): Phases {
  let middlegame: number | undefined;
  let endgame: number | undefined;
  fens.forEach((fen, i) => {
    const board = parseBoard(fen);
    const pieces = majorsAndMinors(board);
    if (middlegame === undefined && (pieces <= 10 || backrankSparse(board) || mixedness(fen) > 150 || i >= OPENING_PLY_CAP))
      middlegame = i;
    if (endgame === undefined && middlegame !== undefined && pieces <= 6) endgame = i;
  });
  // A game that jumps straight from the opening into an endgame has no middlegame.
  if (middlegame !== undefined && endgame !== undefined && middlegame >= endgame) middlegame = undefined;
  return { middlegame, endgame };
}

/** Phase of the move with this 1-based ply (the move that leads to position `ply`). */
export function phaseOfPly(ply: number, phases: Phases): Phase {
  if (phases.endgame !== undefined && ply >= phases.endgame) return 'endgame';
  if (phases.middlegame !== undefined && ply >= phases.middlegame) return 'middlegame';
  return 'opening';
}
