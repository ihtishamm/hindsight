import { winningChances } from '../analysis/winChance';
import type { MoveReview, Score } from '../analysis/types';
import { CLASS_HEX } from '../classMeta';

const W = 600;
const H = 110;
const MARKED = new Set(['brilliant', 'great', 'mistake', 'miss', 'blunder']);

interface Props {
  scores: Score[];
  moves: MoveReview[];
  ply: number;
  /** First middlegame / endgame position, drawn as dividers. */
  phases?: { middlegame?: number; endgame?: number };
  onSelect: (ply: number) => void;
}

/** White's share of the game over time; click anywhere to jump there. */
export function EvalGraph({ scores, moves, ply, phases, onSelect }: Props) {
  const n = Math.max(1, scores.length - 1);
  const x = (i: number) => (i / n) * W;
  const y = (s: Score) => H / 2 - (winningChances(s) * (H / 2 - 4));
  const pts = scores.map((s, i) => `${x(i).toFixed(1)},${y(s).toFixed(1)}`);
  const area = `M0,${H} L${pts.join(' L')} L${W},${H} Z`;

  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSelect(Math.round(((e.clientX - r.left) / r.width) * n));
  };

  return (
    <svg className="eval-graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onClick={pick} role="img" aria-label="Evaluation graph">
      <rect width={W} height={H} className="graph-black" />
      <path d={area} className="graph-white" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="graph-mid" />
      {[phases?.middlegame, phases?.endgame].map((p, i) =>
        p !== undefined ? <line key={i} x1={x(p)} x2={x(p)} y1="0" y2={H} className="graph-phase" /> : null,
      )}
      <line x1={x(ply)} x2={x(ply)} y1="0" y2={H} className="graph-cursor" />
      {moves.map((m) =>
        MARKED.has(m.classification) ? (
          <circle key={m.ply} cx={x(m.ply)} cy={y(scores[m.ply])} r="3.6" fill={CLASS_HEX[m.classification]} vectorEffect="non-scaling-stroke" className="graph-dot" />
        ) : null,
      )}
    </svg>
  );
}
