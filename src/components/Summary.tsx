import { useState, type ReactNode } from 'react';
import type { Classification, GameReview } from '../analysis/types';
import { CLASS_META } from '../classMeta';
import type { PlayerInfo } from '../playerInfo';
import { Avatar, TitleBadge } from './Avatar';
import { CoachBubble } from './Coach';
import { CountUp } from './CountUp';

const ROWS: Classification[] = ['brilliant', 'great', 'book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'miss', 'blunder'];
/** Rows shown when the table is collapsed: the ones that tell the story. */
const KEY_ROWS = new Set<Classification>(['brilliant', 'great', 'best', 'mistake', 'miss', 'blunder']);

/** Grade an accuracy figure on the same scale as the move classifications. */
function accuracyClass(acc: number): Classification {
  return acc >= 90 ? 'best' : acc >= 80 ? 'excellent' : acc >= 70 ? 'good' : acc >= 60 ? 'inaccuracy' : acc >= 50 ? 'mistake' : 'blunder';
}

interface Props {
  review: GameReview;
  onJump: (c: Classification) => void;
  onAllStats: () => void;
  info: { white: PlayerInfo; black: PlayerInfo };
  /** The eval graph, shown under the coach's greeting. */
  graph: ReactNode;
}

/**
 * The game report as a two-column table (White left, Black right), like
 * Chess.com's: players, accuracy, move counts, game rating, advanced stats.
 */
export function Summary({ review, onJump, onAllStats, info, graph }: Props) {
  const { white, black } = review;
  const [expanded, setExpanded] = useState(true);
  const key = review.moves.length + white.name + black.name + white.accuracy;
  const rows = ROWS.filter((c) => (c !== 'book' || white.counts.book + black.counts.book > 0) && (expanded || KEY_ROWS.has(c)));
  const advanced: { label: string; w?: number; b?: number }[] = [
    { label: 'Opening', w: white.phases.opening, b: black.phases.opening },
    { label: 'Middlegame', w: white.phases.middlegame, b: black.phases.middlegame },
    { label: 'Endgame', w: white.phases.endgame, b: black.phases.endgame },
    { label: 'Tactics', w: white.tactics, b: black.tactics },
    { label: 'Strategy', w: white.strategy, b: black.strategy },
  ];

  return (
    <section className="card report" key={key}>
      <CoachBubble>{greeting(review)}</CoachBubble>
      {graph}

      <div className="rtable">
        <div className="rrow head">
          <span />
          {(['white', 'black'] as const).map((side) => (
            <span key={side} className="rcell rname" title={review[side].name}>
              <TitleBadge title={info[side].title} />
              {review[side].name}
            </span>
          ))}
        </div>
        <div className="rrow">
          <span className="rlabel">Players</span>
          {(['white', 'black'] as const).map((side) => (
            <span key={side} className="rcell">
              <Avatar name={review[side].name} src={info[side].avatar} side={side} size={52} className="report-avatar" />
              {review[side].rating && <small className="report-rating">{review[side].rating}</small>}
            </span>
          ))}
        </div>
        <div className="rrow">
          <span className="rlabel">Accuracy</span>
          <span className="rcell"><span className="rbox white big"><CountUp value={white.accuracy} decimals={1} animKey={key} /></span></span>
          <span className="rcell"><span className="rbox black big"><CountUp value={black.accuracy} decimals={1} delay={120} animKey={key} /></span></span>
        </div>

        <div className="rdivider" />

        {rows.map((c, i) => (
          <button key={c} className="rrow count-row" onClick={() => onJump(c)} title={`Jump to the next ${CLASS_META[c].label.toLowerCase()} move`} style={{ ['--i' as string]: i }}>
            <span className="rlabel">{CLASS_META[c].label}</span>
            <span className="rcell rcount" style={{ color: white.counts[c] ? CLASS_META[c].color : undefined }}>
              <CountUp value={white.counts[c]} delay={300 + i * 45} duration={600} animKey={key} />
            </span>
            <span className="move-glyph ricon" style={{ background: CLASS_META[c].color }}>{CLASS_META[c].glyph}</span>
            <span className="rcell rcount" style={{ color: black.counts[c] ? CLASS_META[c].color : undefined }}>
              <CountUp value={black.counts[c]} delay={300 + i * 45} duration={600} animKey={key} />
            </span>
          </button>
        ))}
        <button className="rtoggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label={expanded ? 'Show fewer move types' : 'Show all move types'}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(180deg)' : undefined }}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <div className="rdivider" />

        <div className="rrow">
          <span className="rlabel" title="A rough estimate of the playing strength shown in this one game">Game rating</span>
          <span className="rcell"><span className="rbox white">{white.gameRating ? <CountUp value={white.gameRating} delay={300} animKey={key} /> : '—'}</span></span>
          <span className="rcell"><span className="rbox black">{black.gameRating ? <CountUp value={black.gameRating} delay={300} animKey={key} /> : '—'}</span></span>
        </div>

        <div className="rdivider" />
        <h3 className="rsection">Advanced stats</h3>
        {advanced.map((a) => (
          <div className="rrow" key={a.label}>
            <span className="rlabel">{a.label}</span>
            <GradeIcon value={a.w} />
            <GradeIcon value={a.b} />
          </div>
        ))}
        <button className="link-btn all-stats" onClick={onAllStats}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <rect x="3" y="12" width="4.5" height="9" rx="1.2" fill="currentColor" />
            <rect x="9.75" y="7" width="4.5" height="14" rx="1.2" fill="currentColor" />
            <rect x="16.5" y="3" width="4.5" height="18" rx="1.2" fill="currentColor" />
          </svg>
          View all stats
        </button>
      </div>

      {review.opening && <p className="opening">{review.opening}</p>}
    </section>
  );
}

/** A phase or skill shown as a move-style grade; the number is in the tooltip. */
function GradeIcon({ value }: { value?: number }) {
  if (value === undefined) return <span className="rcell muted" title="Not reached or not tested in this game">—</span>;
  const meta = CLASS_META[accuracyClass(value)];
  return (
    <span className="rcell" title={`${value.toFixed(0)}%`}>
      <span className="move-glyph grade" style={{ background: meta.color }}>{meta.glyph}</span>
    </span>
  );
}

function greeting(review: GameReview): string {
  const { white, black } = review;
  const gap = Math.abs(white.accuracy - black.accuracy);
  const better = white.accuracy > black.accuracy ? white : black;
  if (white.counts.brilliant + black.counts.brilliant > 0) return 'There’s a brilliant move in this one. Let’s walk through it.';
  if (gap >= 15) return `${better.name} was clearly the sharper player. Let’s see where it turned.`;
  if (white.counts.blunder + black.counts.blunder === 0) return 'A clean game with no blunders. Let’s walk through it.';
  return 'All set. Let’s walk through it.';
}
