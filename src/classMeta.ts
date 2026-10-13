import type { Classification } from './analysis/types';

export interface ClassMeta {
  label: string;
  /** Completes "Nf3 is …". */
  phrase: string;
  glyph: string;
  color: string;
}

export const CLASS_META: Record<Classification, ClassMeta> = {
  brilliant: { phrase: 'brilliant', label: 'Brilliant', glyph: '!!', color: 'var(--c-brilliant)' },
  great: { phrase: 'a great move', label: 'Great', glyph: '!', color: 'var(--c-great)' },
  best: { phrase: 'the best move', label: 'Best', glyph: '★', color: 'var(--c-best)' },
  excellent: { phrase: 'excellent', label: 'Excellent', glyph: '✓', color: 'var(--c-excellent)' },
  good: { phrase: 'good', label: 'Good', glyph: '✓', color: 'var(--c-good)' },
  book: { phrase: 'a book move', label: 'Book', glyph: '≡', color: 'var(--c-book)' },
  forced: { phrase: 'forced', label: 'Forced', glyph: '→', color: 'var(--c-forced)' },
  inaccuracy: { phrase: 'an inaccuracy', label: 'Inaccuracy', glyph: '?!', color: 'var(--c-inaccuracy)' },
  mistake: { phrase: 'a mistake', label: 'Mistake', glyph: '?', color: 'var(--c-mistake)' },
  miss: { phrase: 'a miss', label: 'Miss', glyph: '✕', color: 'var(--c-miss)' },
  blunder: { phrase: 'a blunder', label: 'Blunder', glyph: '??', color: 'var(--c-blunder)' },
};

/** Concrete hex colours for SVG drawn inside the board (CSS vars don't reach chessground's shapes reliably). */
export const CLASS_HEX: Record<Classification, string> = {
  brilliant: '#22b8b0',
  great: '#5a8cf0',
  best: '#5fb041',
  excellent: '#7fbf5a',
  good: '#93a98c',
  book: '#b0916b',
  forced: '#8f9a9c',
  inaccuracy: '#e3b93c',
  mistake: '#e8873a',
  miss: '#e2637a',
  blunder: '#d63c32',
};

/** A circular badge for the top-right corner of a square (chessground customSvg: 100 units = 1 square, origin at its top-left). */
export function badgeSvg(cls: Classification): string {
  const glyph = CLASS_META[cls].glyph;
  const size = glyph.length > 1 ? 24 : 30;
  return `<g transform="translate(86,14)">
    <circle r="17" fill="${CLASS_HEX[cls]}" stroke="#0d1214" stroke-opacity=".35" stroke-width="2.5"/>
    <text text-anchor="middle" dominant-baseline="central" y="1" fill="#fff" font-size="${size}" font-weight="800"
      font-family="system-ui, sans-serif">${glyph}</text>
  </g>`;
}
