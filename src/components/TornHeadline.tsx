import { useEffect, useState } from 'react';

/** What players tell themselves after a game, and what the review actually shows. */
const PAIRS: [excuse: string, truth: string][] = [
  ['I played fine.', 'You missed mate in 3.'],
  ['I just got unlucky.', 'Move 23 lost you the game.'],
  ['My opening was solid.', 'You were down a pawn by move 9.'],
  ['They got lucky.', 'They found the only move. Twice.'],
  ['I only lost on time.', 'You spent 4 minutes on move 14.'],
];

type Phase = 'paper' | 'tear' | 'truth';
const TIMING: Record<Phase, number> = { paper: 1900, tear: 900, truth: 2900 };

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The hero headline: an excuse written on a strip of paper rips in two and falls
 * away, revealing what really happened underneath. Cycles through a few pairs.
 */
export function TornHeadline() {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('paper');
  const still = reducedMotion();

  useEffect(() => {
    if (still) return;
    const t = setTimeout(() => {
      if (phase === 'paper') setPhase('tear');
      else if (phase === 'tear') setPhase('truth');
      else {
        setI((n) => (n + 1) % PAIRS.length);
        setPhase('paper');
      }
    }, TIMING[phase]);
    return () => clearTimeout(t);
  }, [phase, still]);

  const [excuse, truth] = PAIRS[i];

  return (
    <h1 className="torn-h1">
      <span className="sr-only">Hindsight is 20/20: find the exact move that won or lost your game.</span>
      <span className={`torn ${still ? 'still' : `phase-${phase}`}`} aria-hidden key={i}>
        <span className="truth">
          <span className="torn-label">What really happened</span>
          {/* A block wrapper keeps the text inline, so the highlighter wraps each line separately. */}
          <span className="truth-line">
            <span className="truth-text">{truth}</span>
          </span>
        </span>
        {(['left', 'right'] as const).map((side) => (
          <span key={side} className={`paper-half ${side}`}>
            <span className="paper">
              <span className="torn-label">What you told yourself</span>
              <span className="excuse-text">{excuse}</span>
            </span>
          </span>
        ))}
      </span>
    </h1>
  );
}
