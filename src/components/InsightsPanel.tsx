import { useState } from 'react';
import { formatClock } from '../analysis/clocks';
import { accuracyStanding, PHASES, scoreLabel } from '../analysis/insights';
import type { GameReview, MoveReview } from '../analysis/types';
import { CLASS_META } from '../classMeta';
import type { PlayerInfo } from '../playerInfo';
import { Avatar } from './Avatar';
import { CoachBubble } from './Coach';

type Side = 'white' | 'black';

interface Props {
  review: GameReview;
  info: { white: PlayerInfo; black: PlayerInfo };
  defaultSide: Side;
  onJump: (ply: number) => void;
}

const PHASE_LABEL = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' };
const KEY_CLASSES = new Set(['brilliant', 'great', 'miss', 'mistake', 'blunder']);

export function InsightsPanel({ review, info, defaultSide, onJump }: Props) {
  const [side, setSide] = useState<Side>(defaultSide);
  const p = review[side];
  const color = side === 'white' ? 'w' : 'b';
  const rating = Number(p.rating) || p.gameRating;
  const standing = rating ? accuracyStanding(p.accuracy, rating) : undefined;
  const own = review.moves.filter((m) => m.color === color);
  const errors = p.counts.mistake + p.counts.blunder + p.counts.miss;

  const phases = PHASES.filter((ph) => p.phases[ph] !== undefined);
  const best = phases.reduce<(typeof phases)[number] | undefined>((b, ph) => (b && p.phases[b]! >= p.phases[ph]! ? b : ph), undefined);
  const worst = phases.reduce<(typeof phases)[number] | undefined>((b, ph) => (b && p.phases[b]! <= p.phases[ph]! ? b : ph), undefined);

  const summary = [
    standing
      ? standing.top <= 20
        ? `An excellent game: more accurate than ${100 - standing.top}% of players around ${standing.band}.`
        : standing.top <= 50
          ? `A solid game, above the average for players around ${standing.band}.`
          : `A tough game: below the usual accuracy for players around ${standing.band}.`
      : `${p.accuracy.toFixed(1)}% accuracy this game.`,
    best && worst && best !== worst ? `Your ${PHASE_LABEL[best].toLowerCase()} was the strongest phase; the ${PHASE_LABEL[worst].toLowerCase()} is where points slipped.` : '',
  ].join(' ');

  const moments = review.moves
    .filter((m) => m.color === color && KEY_CLASSES.has(m.classification))
    .sort((a, b) => importance(b) - importance(a))
    .slice(0, 5)
    .sort((a, b) => a.ply - b.ply);

  return (
    <div className="insights">
      <div className="side-switch" role="radiogroup" aria-label="Player">
        {(['white', 'black'] as const).map((s) => (
          <button key={s} role="radio" aria-checked={side === s} className={side === s ? 'on' : ''} onClick={() => setSide(s)}>
            <Avatar name={review[s].name} src={info[s].avatar} side={s} size={26} />
            <span>{review[s].name}</span>
          </button>
        ))}
      </div>

      <CoachBubble>{summary}</CoachBubble>

      <section className="insight-block">
        <header>
          <h3>Where you stand this game</h3>
          {standing && <span className="muted small-text">vs {standing.band}±100</span>}
        </header>
        {standing && <MeterRow label="Accuracy" value={100 - standing.top} note={`top ${standing.top}%`} icon="◎" />}
        {PHASES.map((ph) => (
          <MeterRow key={ph} label={PHASE_LABEL[ph]} value={p.phases[ph]} note={p.phases[ph] !== undefined ? `${p.phases[ph]!.toFixed(0)}%` : 'not reached'} icon={ph === 'opening' ? '❶' : ph === 'middlegame' ? '❷' : '❸'} />
        ))}
        <MeterRow label="Tactics" value={p.tactics} note={p.tactics !== undefined ? scoreLabel(p.tactics) : 'not tested'} icon="⚔" />
        <MeterRow label="Strategy" value={p.strategy} note={p.strategy !== undefined ? scoreLabel(p.strategy) : 'not tested'} icon="♜" />
        <div className="meter-row">
          <span className="meter-icon" aria-hidden>✕</span>
          <span className="meter-label">Mistakes</span>
          <span className="error-pips">
            {errors === 0 ? <span className="muted">None. Clean game!</span> : (['miss', 'mistake', 'blunder'] as const).flatMap((c) => Array.from({ length: p.counts[c] }, (_, i) => <span key={c + i} className="pip" style={{ background: CLASS_META[c].color }} title={CLASS_META[c].label} />))}
          </span>
          <span className="meter-note">{errors ? `${errors} in ${own.length}` : ''}</span>
        </div>
      </section>

      <section className="insight-block">
        <header>
          <h3>Accuracy per move</h3>
          <span className="legend">
            <i className="lg white" /> {review.white.accuracy.toFixed(1)} <i className="lg black" /> {review.black.accuracy.toFixed(1)}
          </span>
        </header>
        <AccuracyChart moves={review.moves} onJump={onJump} />
      </section>

      {review.clocks && (
        <section className="insight-block">
          <header>
            <h3>Time per move</h3>
            <span className="legend">
              <i className="lg white" /> {review.white.name} <i className="lg black" /> {review.black.name}
            </span>
          </header>
          <TimeChart spent={review.clocks.spent} moves={review.moves} onJump={onJump} />
        </section>
      )}

      {moments.length > 0 && (
        <section className="insight-block">
          <header>
            <h3>Key moments</h3>
          </header>
          <ul className="moments">
            {moments.map((m) => (
              <li key={m.ply}>
                <button onClick={() => onJump(m.ply)}>
                  <span className="move-glyph" style={{ background: CLASS_META[m.classification].color }}>{CLASS_META[m.classification].glyph}</span>
                  <span className="moment-move">
                    {Math.ceil(m.ply / 2)}
                    {m.color === 'w' ? '.' : '…'} {m.san}
                  </span>
                  <span className="muted moment-text">{m.explanation}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Big swings first; brilliant and great moves count as much as the mistakes. */
const importance = (m: MoveReview) => (m.classification === 'brilliant' || m.classification === 'great' ? 0.3 : m.epLoss);

function MeterRow({ label, value, note, icon }: { label: string; value?: number; note: string; icon: string }) {
  return (
    <div className="meter-row">
      <span className="meter-icon" aria-hidden>{icon}</span>
      <span className="meter-label">{label}</span>
      <span className="meter-track">
        {value !== undefined && <span className="meter-fill" style={{ ['--w' as string]: `${Math.max(3, value)}%` }} />}
      </span>
      <span className={`meter-note ${value !== undefined && value >= 75 ? 'good' : ''}`}>{note}</span>
    </div>
  );
}

const CW = 360;
const CH = 110;

/** Per-move accuracy for both players, lightly smoothed so the shape of the game shows. */
function AccuracyChart({ moves, onJump }: { moves: MoveReview[]; onJump: (ply: number) => void }) {
  const series = (['w', 'b'] as const).map((c) => {
    const own = moves.filter((m) => m.color === c);
    return own.map((m, i) => {
      const win = own.slice(Math.max(0, i - 1), i + 2);
      return { ply: m.ply, acc: win.reduce((a, x) => a + x.accuracy, 0) / win.length };
    });
  });
  const n = Math.max(1, moves.length);
  const x = (ply: number) => ((ply - 1) / Math.max(1, n - 1)) * CW;
  const y = (acc: number) => 6 + (1 - acc / 100) * (CH - 12);
  const path = (pts: { ply: number; acc: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.ply).toFixed(1)},${y(p.acc).toFixed(1)}`).join(' ');
  return (
    <svg className="mini-chart" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" role="img" aria-label="Accuracy per move"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onJump(Math.max(1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)) + 1));
      }}>
      {[25, 50, 75].map((v) => <line key={v} x1="0" x2={CW} y1={y(v)} y2={y(v)} className="chart-grid" />)}
      <path d={path(series[1])} className="series black" />
      <path d={path(series[0])} className="series white" />
    </svg>
  );
}

/** Think time per move: White's bars grow up, Black's down. */
function TimeChart({ spent, moves, onJump }: { spent: number[]; moves: MoveReview[]; onJump: (ply: number) => void }) {
  const max = Math.max(1, ...spent);
  const n = spent.length;
  const bw = CW / n;
  const mid = CH / 2;
  const top = spent.indexOf(max);
  return (
    <svg className="mini-chart" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" role="img" aria-label="Time spent per move">
      <line x1="0" x2={CW} y1={mid} y2={mid} className="chart-grid" />
      {spent.map((s, i) => {
        const h = (s / max) * (mid - 4);
        const white = moves[i]?.color === 'w';
        return (
          <rect key={i} x={i * bw + bw * 0.15} width={bw * 0.7} y={white ? mid - h : mid} height={Math.max(0.5, h)} className={`bar ${white ? 'white' : 'black'} ${i === top ? 'peak' : ''}`} onClick={() => onJump(i + 1)}>
            <title>{`${Math.ceil((i + 1) / 2)}${white ? '.' : '…'} ${moves[i]?.san}: ${formatClock(s)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
