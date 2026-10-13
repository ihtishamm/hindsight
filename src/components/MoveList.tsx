import { useEffect, useRef } from 'react';
import type { MoveReview } from '../analysis/types';
import { CLASS_META } from '../classMeta';

interface Props {
  moves: MoveReview[];
  ply: number;
  onSelect: (ply: number) => void;
}

export function MoveList({ moves, ply, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
  }, [ply]);

  const rows: { num: number; white?: MoveReview; black?: MoveReview }[] = [];
  for (const m of moves) {
    const num = Number(m.fenBefore.split(' ')[5]);
    if (m.color === 'w' || !rows.length || rows[rows.length - 1].num !== num) rows.push({ num });
    rows[rows.length - 1][m.color === 'w' ? 'white' : 'black'] = m;
  }

  const cell = (m?: MoveReview) =>
    m ? (
      <button className={`move ${m.ply === ply ? 'current' : ''}`} onClick={() => onSelect(m.ply)}>
        <span className="move-glyph" style={{ background: CLASS_META[m.classification].color }} title={CLASS_META[m.classification].label}>
          {CLASS_META[m.classification].glyph}
        </span>
        {m.san}
      </button>
    ) : (
      <span className="move empty">…</span>
    );

  return (
    <div className="move-list" ref={ref}>
      {rows.map((r) => (
        <div className="move-row" key={`${r.num}-${r.white?.ply ?? r.black?.ply}`}>
          <span className="move-num">{r.num}.</span>
          {cell(r.white)}
          {cell(r.black)}
        </div>
      ))}
    </div>
  );
}
