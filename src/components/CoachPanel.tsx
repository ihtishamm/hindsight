import { formatScore } from '../analysis/winChance';
import type { EngineLine, GameReview, MoveReview } from '../analysis/types';
import { CLASS_META } from '../classMeta';
import { CoachMascot } from './Coach';

interface Props {
  review: GameReview;
  move?: MoveReview;
  exploring?: { lines: EngineLine[]; sanLines: string[][]; retry?: RetryState };
  onRetry?: () => void;
  onShowBest?: () => void;
  onBackToGame?: () => void;
}

export interface RetryState {
  target: MoveReview;
  verdict?: 'correct' | 'wrong' | 'checking';
  tried?: string;
}

const GOOD_ENOUGH = new Set(['inaccuracy', 'mistake', 'miss', 'blunder']);

export function CoachPanel({ review, move, exploring, onRetry, onShowBest, onBackToGame }: Props) {
  if (exploring) {
    const retry = exploring.retry;
    return (
      <section className="card coach exploring">
        <header className="coach-head">
          <CoachMascot size={40} />
          <strong>{retry ? 'Find a better move' : 'Exploring'}</strong>
          <button className="ghost small" onClick={onBackToGame}>Back to game</button>
        </header>
        {retry && (
          <p className={`coach-text verdict-${retry.verdict ?? 'pending'}`}>
            {retry.verdict === undefined && `In the game ${retry.target.san} was played here. Can you do better?`}
            {retry.verdict === 'checking' && `Checking ${retry.tried}…`}
            {retry.verdict === 'correct' && `${retry.tried} — well found! That keeps the position on track.`}
            {retry.verdict === 'wrong' && `${retry.tried} isn't it either. Take the move back and try again.`}
          </p>
        )}
        {!retry && <p className="coach-text">Make moves on the board to try out ideas. The engine follows along.</p>}
        {(!retry || retry.verdict === 'correct') && (
        <ol className="engine-lines">
          {exploring.lines.map((l, i) => (
            <li key={i}>
              <span className="line-eval">{formatScore(l.score)}</span>
              <span className="line-moves">{exploring.sanLines[i]?.slice(0, 8).join(' ')}</span>
            </li>
          ))}
          {!exploring.lines.length && <li className="muted">Engine thinking…</li>}
        </ol>
        )}
      </section>
    );
  }

  if (!move) {
    return (
      <section className="card coach">
        <header className="coach-head">
          <CoachMascot size={40} />
          <strong>Game review</strong>
        </header>
        <p className="coach-text">
          {review.white.name} played with {review.white.accuracy.toFixed(1)}% accuracy, {review.black.name} with{' '}
          {review.black.accuracy.toFixed(1)}%. Step through the moves with ← → or click any move.
        </p>
      </section>
    );
  }

  const meta = CLASS_META[move.classification];
  const moveNo = `${Math.ceil(move.ply / 2)}${move.color === 'w' ? '.' : '…'}`;
  return (
    <section className="card coach move-card" style={{ ['--accent' as string]: meta.color }} key={move.ply}>
      <div className="coach-row">
        <CoachMascot size={44} />
        <div className="coach-body">
          <header className="coach-head">
            <span className="move-glyph" style={{ background: meta.color }}>{meta.glyph}</span>
            <strong>
              {moveNo} {move.san} <span className="coach-label">is {meta.phrase}</span>
            </strong>
            <span className="coach-eval">{formatScore(move.scoreAfter)}</span>
          </header>
          <p className="coach-text">{move.explanation}</p>
        </div>
      </div>
      {(move.bestSan || GOOD_ENOUGH.has(move.classification)) && (
        <div className="coach-actions">
          {move.bestSan && (
            <button className="dark-btn" onClick={onShowBest}>
              <span aria-hidden>★</span> {GOOD_ENOUGH.has(move.classification) || move.classification === 'good' ? 'Best' : 'Engine'}: {move.bestSan}
            </button>
          )}
          {GOOD_ENOUGH.has(move.classification) && (
            <button className="cta small-cta" onClick={onRetry}>
              <span aria-hidden>↻</span> Retry
            </button>
          )}
        </div>
      )}
    </section>
  );
}
