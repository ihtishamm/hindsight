import { useEffect, useState } from 'react';
import type { PlayerInfo } from '../playerInfo';
import { Avatar, TitleBadge } from './Avatar';

export type AnalyzeStage = 'engine' | 'report';

interface Props {
  white: string;
  black: string;
  info: { white: PlayerInfo; black: PlayerInfo };
  done: number;
  total: number;
  depth: number;
  stage: AnalyzeStage;
  startedAt: number;
  onCancel: () => void;
}

const TIPS = [
  'Accuracy uses the same formula as Lichess, so you can compare the two.',
  'A move is “Great” when it was the only one that kept the game on track.',
  'Brilliant moves are sound sacrifices: material given up on purpose.',
  'Press ← and → to step through moves, and f to flip the board.',
  'Every analysis runs on your own computer. Nothing is uploaded.',
  'Retry any mistake as a puzzle to find the move you missed.',
];

/** What the user watches while Stockfish works: a hopping knight, progress, and what happens next. */
export function AnalyzingPanel({ white, black, info, done, total, depth, stage, startedAt, onCancel }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    const u = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 6000);
    return () => {
      clearInterval(t);
      clearInterval(u);
    };
  }, []);

  const pct = stage === 'report' ? 100 : Math.floor((done / total) * 100);
  const elapsed = (now - startedAt) / 1000;
  const eta = done >= 3 && stage === 'engine' ? Math.max(0, ((elapsed / done) * (total - done))) : undefined;
  const steps: { label: string; state: 'done' | 'active' | 'todo'; detail?: string }[] = [
    { label: 'Game loaded', state: 'done', detail: `${total - 1} moves` },
    {
      label: 'Analysing every position',
      state: stage === 'engine' ? 'active' : 'done',
      detail: stage === 'engine' ? `${Math.min(done + 1, total)} of ${total} · depth ${depth}` : `${total} positions`,
    },
    { label: 'Grading moves', state: stage === 'report' ? 'active' : 'todo' },
    { label: 'Building your report', state: stage === 'report' ? 'active' : 'todo' },
  ];

  return (
    <section className="card analyzing-panel" aria-live="polite">
      <div className="analyzing-players">
        <div className="ap-player">
          <Avatar name={white} src={info.white.avatar} side="white" size={44} />
          <span className="ap-name"><TitleBadge title={info.white.title} />{white}</span>
        </div>
        <span className="ap-vs">vs</span>
        <div className="ap-player">
          <Avatar name={black} src={info.black.avatar} side="black" size={44} />
          <span className="ap-name"><TitleBadge title={info.black.title} />{black}</span>
        </div>
      </div>

      <div className="analyzing-hero">
        <KnightSpinner />
        <div className="analyzing-numbers">
          <span className="analyzing-pct">{pct}<small>%</small></span>
          <span className="muted">
            {stage === 'report' ? 'Putting the report together…' : eta !== undefined ? (eta < 10 ? (pct >= 80 ? 'Almost there…' : 'Only a few seconds left') : `About ${formatEta(eta)} left`) : 'Warming up the engine…'}
          </span>
        </div>
      </div>

      <div className="progress fancy" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${pct}%` }} />
      </div>

      <ol className="steps">
        {steps.map((s) => (
          <li key={s.label} className={s.state}>
            <span className="step-dot" aria-hidden>{s.state === 'done' ? '✓' : ''}</span>
            <span className="step-label">{s.label}</span>
            {s.detail && <span className="step-detail">{s.detail}</span>}
          </li>
        ))}
      </ol>

      <p className="tip" key={tip}>
        <strong>Tip</strong> {TIPS[tip]}
      </p>

      <button className="ghost cancel" onClick={onCancel}>Cancel</button>
    </section>
  );
}

function formatEta(s: number) {
  if (s < 60) return `${Math.round(s / 5) * 5} seconds`;
  const m = Math.round(s / 60);
  return m === 1 ? 'a minute' : `${m} minutes`;
}

/** A knight touring a 3×3 board in L-shaped jumps. */
function KnightSpinner() {
  return (
    <div className="knight-spinner" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={(Math.floor(i / 3) + (i % 3)) % 2 ? 'dark' : 'light'} />
      ))}
      <svg className="hopper" viewBox="0 0 32 32">
        <path
          d="M10 28c0-4 1.5-6.5 4.5-9.5-2.2.4-4 1.6-5.5 3.3L6 19c1.5-5.5 5.6-11 12-12.5l1-2.5 2 2.8c3.6 2.5 5 7 5 12.2V28z"
          fill="#fff8e6"
          stroke="#2a1d05"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="16.5" cy="11.5" r="1.4" fill="#2a1d05" />
      </svg>
    </div>
  );
}
