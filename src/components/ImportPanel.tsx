import { useState } from 'react';
import type { HistoryEntry } from '../history';
import type { Site } from '../importers';
import { AccountBrowser } from './AccountBrowser';

export const SAMPLE_PGN = `[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

export const DEPTHS = [
  { depth: 12, label: 'Fast' },
  { depth: 16, label: 'Standard' },
  { depth: 20, label: 'Deep' },
  { depth: 26, label: 'Max' },
];

type Source = Site | 'pgn';

interface Props {
  depth: number;
  setDepth: (d: number) => void;
  onReview: (pgn: string, me?: string) => void;
  history: HistoryEntry[];
  onOpenHistory: (h: HistoryEntry) => void;
  onDeleteHistory: (id: string) => void;
  error?: string;
}

const stored = () => {
  try {
    return (localStorage.getItem('import:source') as Source | null) ?? 'chesscom';
  } catch {
    return 'chesscom';
  }
};

const SOURCES: { id: Source; label: string; icon: React.ReactNode }[] = [
  { id: 'chesscom', label: 'Chess.com', icon: <PawnIcon /> },
  { id: 'lichess', label: 'Lichess.org', icon: <KnightIcon /> },
  { id: 'pgn', label: 'PGN', icon: <DocIcon /> },
];

export function ImportPanel({ depth, setDepth, onReview, history, onOpenHistory, onDeleteHistory, error }: Props) {
  const [source, setSourceState] = useState<Source>(stored);
  const [pgn, setPgn] = useState('');
  const setSource = (s: Source) => {
    setSourceState(s);
    try {
      localStorage.setItem('import:source', s);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="import">
      <section className="card source-card">
        <div className="source-tiles" role="tablist" aria-label="Where is the game?">
          {SOURCES.map((s) => (
            <button key={s.id} role="tab" aria-selected={source === s.id} className={`tile ${source === s.id ? 'on' : ''}`} onClick={() => setSource(s.id)}>
              <span className={`tile-icon ${s.id}`}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {source === 'pgn' ? (
          <form
            className="source-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (pgn.trim()) onReview(pgn);
              else document.getElementById('pgn')?.focus();
            }}
          >
            <div className="field-head">
              <label htmlFor="pgn">Paste a PGN or FEN</label>
            </div>
            <textarea id="pgn" className="big-input" value={pgn} onChange={(e) => setPgn(e.target.value)} placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 …" spellCheck={false} rows={7} />
            <button className="cta">
              <SparkIcon />
              Review game
            </button>
            <div className="quick-picks">
              <button type="button" className="pick" onClick={() => onReview(SAMPLE_PGN)}>
                <span className="pick-avatar" aria-hidden>♞</span>
                Morphy&apos;s Opera Game
              </button>
            </div>
          </form>
        ) : (
          <AccountBrowser key={source} site={source} onReview={onReview} />
        )}
        {error && <p className="error">{error}</p>}

        <div className="depth-row">
          <span className="form-label">Analysis depth</span>
          <div className="segmented" role="radiogroup" aria-label="Analysis depth">
            {DEPTHS.map((d) => (
              <button key={d.depth} type="button" role="radio" aria-checked={depth === d.depth} className={depth === d.depth ? 'on' : ''} onClick={() => setDepth(d.depth)}>
                {d.label} <small>d{d.depth}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      {history.length > 0 && (
        <section className="card">
          <h2>Recent reviews</h2>
          <ul className="game-list">
            {history.map((h) => (
              <li key={h.id}>
                <button onClick={() => onOpenHistory(h)}>
                  <span className="players">{h.title}</span>
                  <span className="meta">{h.accuracy} · depth {h.depth} · {new Date(h.date).toLocaleDateString()}</span>
                </button>
                <button className="ghost small" aria-label="Remove" onClick={() => onDeleteHistory(h.id)}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PawnIcon() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
      <circle cx="16" cy="9" r="4.5" fill="currentColor" />
      <path d="M11.5 15h9l-1.5 3c1.8 2.3 2.8 5.2 3 8h-12c.2-2.8 1.2-5.7 3-8z" fill="currentColor" />
      <rect x="8" y="26" width="16" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function KnightIcon() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
      <path
        d="M10 28c0-4 1.5-6.5 4.5-9.5-2.2.4-4 1.6-5.5 3.3L6 19c1.5-5.5 5.6-11 12-12.5l1-2.5 2 2.8c3.6 2.5 5 7 5 12.2V28z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="11.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M8 4h11l6 6v18H8z" />
      <path d="M19 4v6h6M12 16h9M12 20.5h9M12 25h5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
      <path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z" />
    </svg>
  );
}
