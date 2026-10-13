import { useEffect, useRef } from 'react';
import type { MoveReview } from '../analysis/types';
import { CLASS_META } from '../classMeta';

interface Props {
  moves: MoveReview[];
  ply: number;
  onSelect: (ply: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

/** All moves in one scrolling row under the board, with big step buttons at either end. */
export function MoveStrip({ moves, ply, onSelect, onPrev, onNext }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.current');
    const box = ref.current;
    if (el && box) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [ply]);

  return (
    <div className="move-strip">
      <button className="step-btn" onClick={onPrev} aria-label="Previous move">
        <Chevron dir="left" />
      </button>
      <div className="strip-moves" ref={ref}>
        {moves.map((m) => (
          <button key={m.ply} className={`strip-move ${m.ply === ply ? 'current' : ''}`} onClick={() => onSelect(m.ply)} title={CLASS_META[m.classification].label}>
            {m.color === 'w' && <span className="strip-num">{Math.ceil(m.ply / 2)}.</span>}
            {m.san}
            <span className="move-glyph" style={{ background: CLASS_META[m.classification].color }}>{CLASS_META[m.classification].glyph}</span>
          </button>
        ))}
      </div>
      <button className="step-btn" onClick={onNext} aria-label="Next move">
        <Chevron dir="right" />
      </button>
    </div>
  );
}

export function Chevron({ dir, double = false }: { dir: 'left' | 'right'; double?: boolean }) {
  const d = dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7';
  const d2 = dir === 'left' ? 'M21 5l-7 7 7 7' : 'M3 5l7 7-7 7';
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {double && <path d={d2} />}
    </svg>
  );
}
