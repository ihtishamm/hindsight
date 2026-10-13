import { formatScore, winningChances } from '../analysis/winChance';
import type { Score } from '../analysis/types';

export function EvalBar({ score, orientation }: { score?: Score; orientation: 'white' | 'black' }) {
  const white = score ? 50 + 50 * winningChances(score) : 50;
  const whiteAhead = white >= 50;
  return (
    <div className={`eval-bar ${orientation === 'black' ? 'flipped' : ''}`} aria-label="Evaluation">
      <div className="eval-white" style={{ height: `${white}%` }} />
      <span className={`eval-label ${whiteAhead ? 'on-white' : 'on-black'}`}>{score ? formatScore(score, true) : '…'}</span>
    </div>
  );
}
