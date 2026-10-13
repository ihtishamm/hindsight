import { Chess } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uciLineToSan } from './analysis/material';
import { buildReview, parseGame, positionScore, reviewGame, terminalScore } from './analysis/review';
import type { Classification, EngineLine, GameReview, MoveReview, Score } from './analysis/types';
import { expectedPoints, formatScore } from './analysis/winChance';
import { badgeSvg } from './classMeta';
import { Board } from './components/Board';
import { CoachPanel, type RetryState } from './components/CoachPanel';
import { EvalBar } from './components/EvalBar';
import { AnalyzingPanel, type AnalyzeStage } from './components/AnalyzingPanel';
import { Avatar, TitleBadge } from './components/Avatar';
import { EvalGraph } from './components/EvalGraph';
import { InsightsPanel } from './components/InsightsPanel';
import { Chevron, MoveStrip } from './components/MoveStrip';
import { gameEndBadges, outcomeFor } from './components/GameEndBadges';
import { ShareButton } from './components/SharePanel';
import { TornHeadline } from './components/TornHeadline';
import { compactPgn, encodeGame, readShareHash, shareHash, shareUrl } from './share';
import { ImportPanel } from './components/ImportPanel';
import { MoveList } from './components/MoveList';
import { Summary } from './components/Summary';
import { Engine } from './engine/engine';
import { loadHistory, saveHistory, type HistoryEntry } from './history';
import { loadBook } from './analysis/openings';
import { formatClock } from './analysis/clocks';
import { usePlayerInfo, type PlayerInfo } from './playerInfo';
import { playSound, preloadSounds, setMuted, soundForSan } from './sound';

interface ExploreMove {
  san: string;
  fen: string;
  from: string;
  to: string;
}

interface Explore {
  basePly: number;
  /** Where "Back to game" returns to. */
  returnPly: number;
  moves: ExploreMove[];
  lines: EngineLine[];
  retry?: RetryState;
}

type Theme = 'system' | 'light' | 'dark';
const THEME_NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON: Record<Theme, React.ReactNode> = {
  system: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </svg>
  ),
  light: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
    </svg>
  ),
};

type View =
  | { kind: 'import' }
  | { kind: 'analyzing'; fens: string[]; done: number; score?: Score; white: string; black: string; headers: Record<string, string>; stage: AnalyzeStage; startedAt: number; depth: number }
  | { kind: 'review' };
type Tab = 'report' | 'analysis' | 'insights';
/** Where a review should open (from a share link). */
type OpenAt = { orientation?: 'white' | 'black'; move?: number; depth?: number };

/** Identity of a game for the review cache: players plus the moves. */
const gameKey = (g: { headers: Record<string, string>; moves: { lan: string }[] }) =>
  `${g.headers.White ?? ''}|${g.headers.Black ?? ''}|${g.moves.map((m) => m.lan).join(' ')}`;
const sameGame = (pgn: string, key: string) => {
  try {
    return gameKey(parseGame(pgn)) === key;
  } catch {
    return false;
  }
};

const NOT_BEST: Set<Classification> = new Set(['good', 'inaccuracy', 'mistake', 'miss', 'blunder']);
const stored = (k: string, fallback: string) => {
  try {
    return localStorage.getItem(k) ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

/** Which colour `player` had in the game, if they played in it. */
function sideOf(headers: Record<string, string>, player?: string): 'white' | 'black' | undefined {
  const p = player?.toLowerCase();
  if (!p) return undefined;
  if (headers.White?.toLowerCase() === p) return 'white';
  if (headers.Black?.toLowerCase() === p) return 'black';
  return undefined;
}

export function App() {
  const [view, setView] = useState<View>({ kind: 'import' });
  const [review, setReview] = useState<GameReview>();
  /** Whose game this is (from an account import): their side gets the "You win" treatment. */
  const [me, setMe] = useState<string>();
  const [ply, setPly] = useState(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [depth, setDepthState] = useState(() => Number(stored('depth', '16')));
  const [muted, setMutedState] = useState(() => stored('muted', '0') === '1');
  const [showEngine, setShowEngine] = useState(() => stored('engineArrows', '1') === '1');
  const [theme, setTheme] = useState<Theme>(() => stored('theme', 'system') as Theme);
  const [tab, setTab] = useState<Tab>('report');
  const [explore, setExplore] = useState<Explore>();
  const [error, setError] = useState<string>();
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const engineRef = useRef<Engine>(undefined);
  const engine = () => (engineRef.current ??= new Engine());

  useEffect(() => {
    setMuted(muted);
  }, [muted]);
  useEffect(() => () => engineRef.current?.destroy(), []);
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
  // Browsers only allow audio after a user gesture; decode the sounds then.
  useEffect(() => {
    const unlock = () => void preloadSounds();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const setDepth = (d: number) => {
    setDepthState(d);
    store('depth', String(d));
  };

  // ---- Reviewing -----------------------------------------------------------

  const showReview = useCallback((r: GameReview, player?: string, open?: OpenAt) => {
    setReview(r);
    setMe(player);
    setOrientation(open?.orientation ?? sideOf(r.headers, player) ?? 'white');
    setPly(Math.min(open?.move ?? 0, r.moves.length));
    setExplore(undefined);
    setTab('report');
    setView({ kind: 'review' });
    playSound('notify');
  }, []);

  const startReview = async (pgn: string, player?: string, open?: OpenAt) => {
    setError(undefined);
    let game;
    try {
      game = parseGame(pgn);
    } catch {
      setError("That doesn't look like a valid PGN. Check the moves and try again.");
      return;
    }
    if (!game.moves.length) {
      setError('The game has no moves to review.');
      return;
    }
    // Reviewed this game before at least this deep? Reopen it instantly.
    const key = gameKey(game);
    const cached = history.find((h) => h.depth >= (open?.depth ?? depth) && sameGame(h.pgn, key));
    if (cached) {
      showReview(await buildReview(parseGame(cached.pgn), cached.positions, cached.depth), player ?? cached.me, open);
      return;
    }
    const reviewDepth = open?.depth ?? depth;
    const fens = [game.startFen, ...game.moves.map((m) => m.after)];
    const white = game.headers.White ?? 'White';
    const black = game.headers.Black ?? 'Black';
    setOrientation(open?.orientation ?? sideOf(game.headers, player) ?? 'white');
    setView({ kind: 'analyzing', fens, done: 0, white, black, headers: game.headers, stage: 'engine', startedAt: Date.now(), depth: reviewDepth });
    void loadBook(); // fetch the opening book now so the report isn't waiting for it later
    try {
      const r = await reviewGame(game, reviewDepth, {
        analyse: (fen) => engine().analyse(fen, { depth: reviewDepth, multiPv: 2 }),
        onPosition: (i, _total, p) =>
          setView((v) => (v.kind === 'analyzing' ? { ...v, done: i + 1, score: positionScore(p) } : v)),
        onAnalysed: async () => {
          setView((v) => (v.kind === 'analyzing' ? { ...v, stage: 'report' } : v));
          // Let the "building your report" state paint before the synchronous work starts.
          await new Promise((r) => setTimeout(r, 60));
        },
      });
      const entry: HistoryEntry = {
        id: `${Date.now()}`,
        title: `${white} – ${black}${game.headers.Result ? ` (${game.headers.Result})` : ''}`,
        accuracy: `${r.white.accuracy.toFixed(1)} / ${r.black.accuracy.toFixed(1)}`,
        date: Date.now(),
        depth: reviewDepth,
        pgn,
        me: player,
        positions: r.positions,
      };
      const next = [entry, ...history];
      setHistory(next);
      saveHistory(next);
      showReview(r, player, open);
    } catch (e) {
      if ((e as Error).message !== 'cancelled') setError((e as Error).message);
      setView({ kind: 'import' });
    }
  };

  const startReviewRef = useRef(startReview);
  startReviewRef.current = startReview;

  const openHistory = async (h: HistoryEntry) => {
    showReview(await buildReview(parseGame(h.pgn), h.positions, h.depth), h.me);
  };

  const deleteHistory = (id: string) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    saveHistory(next);
  };

  // ---- Sharing -------------------------------------------------------------

  /** The reviewed game as a compact PGN (also what "Copy PGN" gives you). */
  const sharePgn = useMemo(() => {
    if (!review) return '';
    const [, turn, , , , fullmove] = review.startFen.split(' ');
    return compactPgn(review.headers, review.moves.map((m) => m.san), review.clocks?.remaining, turn === 'b', Number(fullmove) || 1);
  }, [review]);
  const [encoded, setEncoded] = useState<{ pgn: string; data: string }>();
  useEffect(() => {
    if (!sharePgn) return;
    let live = true;
    void encodeGame(sharePgn).then((data) => live && setEncoded({ pgn: sharePgn, data }));
    return () => {
      live = false;
    };
  }, [sharePgn]);
  const shareData = encoded?.pgn === sharePgn ? encoded.data : undefined;
  const shareDataRef = useRef(shareData);
  shareDataRef.current = shareData;
  const reviewPly = explore ? explore.returnPly : ply;

  // Opening a share link: review the game it carries, at its move and orientation.
  // (Declared before the URL sync below, so it reads the link before anything tidies it.)
  const openedLink = useRef('');
  useEffect(() => {
    const openLink = async () => {
      const hash = location.hash;
      if (!hash.includes('game=') || hash === openedLink.current) return;
      const current = new URLSearchParams(hash.slice(1)).get('game');
      if (current && current === shareDataRef.current) return; // our own URL sync
      openedLink.current = hash;
      try {
        const s = await readShareHash(hash);
        if (s) await startReviewRef.current(s.pgn, undefined, { orientation: s.orientation, move: s.move, depth: s.depth });
      } catch {
        setError('That share link looks damaged. Ask for a fresh one, or paste the PGN instead.');
      }
    };
    void openLink();
    window.addEventListener('hashchange', openLink);
    return () => window.removeEventListener('hashchange', openLink);
  }, []);

  // Like Chessigma, the address bar always holds a link to what you're looking at
  // (replaceState, so stepping through moves doesn't flood the back button).
  useEffect(() => {
    if (view.kind === 'review' && review && shareData) {
      window.history.replaceState(null, '', shareHash(shareData, { depth: review.depth, orientation, move: reviewPly }));
    } else if (view.kind === 'import' && location.hash.includes('game=')) {
      window.history.replaceState(null, '', location.pathname + location.search);
    }
  }, [view.kind, review, shareData, orientation, reviewPly]);

  const shareLink = (atMove: boolean) =>
    shareData && review ? shareUrl(shareHash(shareData, { depth: review.depth, orientation, move: atMove ? reviewPly : 0 })) : undefined;

  const cancel = () => {
    engineRef.current?.stop();
    setView({ kind: 'import' });
  };

  // ---- Navigation ----------------------------------------------------------

  const moves = review?.moves ?? [];
  const scores = useMemo(() => review?.positions.map(positionScore) ?? [], [review]);

  const goTo = useCallback(
    (target: number, sound = true) => {
      const p = Math.max(0, Math.min(moves.length, target));
      if (sound && p !== ply && p > 0) {
        // The last move of a finished game: win / loss / draw from the reviewed side.
        const outcome = p === moves.length && review ? outcomeFor(moves[p - 1].fenAfter, review.headers, sideOf(review.headers, me) ?? orientation) : undefined;
        playSound(outcome ?? soundForSan(moves[p - 1].san, p === moves.length && !!terminalScore(moves[p - 1].fenAfter)));
      }
      setExplore(undefined);
      engineRef.current?.stop();
      setPly(p);
      if (p > 0) setTab('analysis');
    },
    [moves, ply, review, me, orientation],
  );

  const jumpTo = (c: Classification) => {
    const after = moves.find((m) => m.classification === c && m.ply > ply) ?? moves.find((m) => m.classification === c);
    if (after) {
      setTab('analysis');
      goTo(after.ply);
    }
  };

  // ---- Exploration & retry -------------------------------------------------

  const analyseLive = useCallback((fen: string, onDone?: (lines: EngineLine[]) => void) => {
    const e = engine();
    e.stop();
    if (terminalScore(fen)) {
      setExplore((x) => x && { ...x, lines: [] });
      onDone?.([]);
      return;
    }
    e.analyse(fen, {
      depth: onDone ? 14 : 20,
      multiPv: onDone ? 1 : 3,
      onUpdate: (lines) => setExplore((x) => x && { ...x, lines }),
    }).then(
      (lines) => {
        setExplore((x) => x && { ...x, lines });
        onDone?.(lines);
      },
      () => {},
    );
  }, []);

  const exploreFen = explore
    ? (explore.moves.at(-1)?.fen ?? (explore.basePly === 0 ? review!.startFen : moves[explore.basePly - 1].fenAfter))
    : undefined;

  const startExplore = (basePly: number, first?: string, retry?: RetryState) => {
    const baseFen = basePly === 0 ? review!.startFen : moves[basePly - 1].fenAfter;
    const ex: Explore = { basePly, returnPly: ply, moves: [], lines: [], retry };
    if (first) {
      const chess = new Chess(baseFen);
      const m = chess.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] });
      ex.moves.push({ san: m.san, fen: chess.fen(), from: m.from, to: m.to });
      playSound(soundForSan(m.san));
    }
    setExplore(ex);
    analyseLive(ex.moves.at(-1)?.fen ?? baseFen);
  };

  const onBoardMove = (from: string, to: string, promotion?: string) => {
    const fen = exploreFen ?? (ply === 0 ? review!.startFen : moves[ply - 1].fenAfter);
    const chess = new Chess(fen);
    let m;
    try {
      m = chess.move({ from, to, promotion });
    } catch {
      return;
    }
    // Playing the game move from the main line just steps forward.
    if (!explore && moves[ply]?.uci === m.lan) {
      goTo(ply + 1);
      return;
    }
    playSound(soundForSan(m.san));
    const next: ExploreMove = { san: m.san, fen: chess.fen(), from: m.from, to: m.to };
    const base: Explore = explore ?? { basePly: ply, returnPly: ply, moves: [], lines: [] };
    const retry = base.retry;
    if (retry && base.moves.length === 0) {
      setExplore({ ...base, moves: [next], lines: [], retry: { ...retry, verdict: 'checking', tried: m.san } });
      const judge = (ok: boolean) => {
        setExplore((x) => x && { ...x, retry: x.retry && { ...x.retry, verdict: ok ? 'correct' : 'wrong' } });
        if (!ok) {
          playSound('error');
          setTimeout(() => setExplore((x) => (x?.retry ? { ...x, moves: [], lines: [] } : x)), 1100);
        }
      };
      if (m.lan === retry.target.bestUci) return judge(true);
      if (m.lan === retry.target.uci) return judge(false);
      analyseLive(next.fen, (lines) => {
        const score = terminalScore(next.fen) ?? lines[0]?.score ?? { cp: 0 };
        judge(retry.target.epBest - expectedPoints(score, retry.target.color) <= 0.05);
      });
      return;
    }
    setExplore({ ...base, moves: [...base.moves, next], lines: [] });
    analyseLive(next.fen);
  };

  const exploreBack = () => {
    if (!explore) return;
    if (!explore.moves.length) return goTo(explore.returnPly, false);
    const rest = explore.moves.slice(0, -1);
    setExplore({ ...explore, moves: rest, lines: [] });
    analyseLive(rest.at(-1)?.fen ?? (explore.basePly === 0 ? review!.startFen : moves[explore.basePly - 1].fenAfter));
  };

  // ---- Keyboard ------------------------------------------------------------

  useEffect(() => {
    if (view.kind !== 'review') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === 'ArrowLeft') explore ? exploreBack() : goTo(ply - 1);
      else if (e.key === 'ArrowRight') goTo(explore ? explore.returnPly : ply + 1);
      else if (e.key === 'ArrowUp' || e.key === 'Home') goTo(0);
      else if (e.key === 'ArrowDown' || e.key === 'End') goTo(moves.length);
      else if (e.key === 'f') setOrientation((o) => (o === 'white' ? 'black' : 'white'));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- Board state ---------------------------------------------------------

  const current: MoveReview | undefined = ply > 0 ? moves[ply - 1] : undefined;
  let boardFen = review?.startFen ?? new Chess().fen();
  let lastMove: [string, string] | undefined;
  let barScore: Score | undefined;
  const shapes: DrawShape[] = [];

  if (view.kind === 'analyzing') {
    boardFen = view.fens[Math.min(view.done, view.fens.length - 1)];
    barScore = view.score;
  } else if (explore && exploreFen) {
    boardFen = exploreFen;
    const last = explore.moves.at(-1);
    lastMove = last ? [last.from, last.to] : current && [current.uci.slice(0, 2), current.uci.slice(2, 4)];
    barScore = terminalScore(exploreFen) ?? explore.lines[0]?.score;
    if (!explore.retry || explore.retry.verdict === 'correct')
      explore.lines.slice(0, 3).forEach((l, i) => {
        const uci = l.pv[0];
        if (uci) shapes.push({ orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush: i === 0 ? 'blue' : 'paleBlue' });
      });
  } else if (review) {
    boardFen = current?.fenAfter ?? review.startFen;
    barScore = scores[ply];
    if (current) {
      lastMove = [current.uci.slice(0, 2), current.uci.slice(2, 4)];
      shapes.push({ orig: lastMove[1] as Key, customSvg: { html: badgeSvg(current.classification) } });
      if (current.bestUci && NOT_BEST.has(current.classification))
        shapes.push({ orig: current.bestUci.slice(0, 2) as Key, dest: current.bestUci.slice(2, 4) as Key, brush: 'green' });
    }
    const next = review.positions[ply]?.lines[0]?.pv[0];
    if (showEngine && next && ply < moves.length)
      shapes.push({ orig: next.slice(0, 2) as Key, dest: next.slice(2, 4) as Key, brush: 'paleBlue' });
  }

  const atEnd = view.kind === 'review' && !explore && !!review && ply === moves.length && moves.length > 0;
  const badges = useMemo(
    () => (atEnd && review ? gameEndBadges(moves[moves.length - 1].fenAfter, review.headers, sideOf(review.headers, me)) : []),
    [atEnd, review, moves, me],
  );

  const sanLines = useMemo(
    () => (explore && exploreFen ? explore.lines.map((l) => uciLineToSan(exploreFen, l.pv, 10)) : []),
    [explore, exploreFen],
  );

  const players =
    view.kind === 'analyzing'
      ? { white: { name: view.white } as Partial<GameReview['white']>, black: { name: view.black } as Partial<GameReview['black']> }
      : { white: review?.white, black: review?.black };
  const headers = view.kind === 'analyzing' ? view.headers : review?.headers;
  const info = usePlayerInfo(headers);
  const topSide = orientation === 'white' ? 'black' : 'white';
  const bottomSide = orientation;

  /** Clock of `side` at the current ply: what was left after their latest move. */
  const clockAt = (side: 'white' | 'black'): number | undefined => {
    const c = review?.clocks;
    if (!c || view.kind !== 'review') return undefined;
    const color = side === 'white' ? 'w' : 'b';
    for (let i = Math.min(ply, moves.length) - 1; i >= 0; i--) if (moves[i].color === color) return c.remaining[i];
    const tc = /^(\d+)/.exec(review.headers.TimeControl ?? '');
    return tc ? Number(tc[1]) : undefined;
  };
  const result = review?.headers.Result;
  const winner = view.kind === 'review' && ply === moves.length ? (result === '1-0' ? 'white' : result === '0-1' ? 'black' : undefined) : undefined;
  const bar = (side: 'white' | 'black') => (
    <PlayerBar
      side={side}
      name={players[side]?.name}
      rating={players[side]?.rating}
      accuracy={players[side]?.accuracy}
      info={info[side]}
      clock={clockAt(side)}
      toMove={view.kind === 'review' && new Chess(boardFen).turn() === side[0]}
      winner={winner === side}
    />
  );

  const currentLines = useMemo(() => {
    if (!review || explore || view.kind !== 'review') return [];
    const pos = review.positions[ply];
    return (pos?.lines ?? []).map((l) => ({ score: l.score, san: uciLineToSan(pos.fen, l.pv, 8), depth: l.depth }));
  }, [review, explore, ply, view.kind]);

  const tabButton = (id: Tab, label: string, icon: React.ReactNode) => (
    <button role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
      <span className="tab-icon" aria-hidden>{icon}</span>
      {label}
    </button>
  );

  // ---- Render --------------------------------------------------------------

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => (view.kind === 'analyzing' ? cancel() : setView({ kind: 'import' }))}>
          <span className="brand-mark" aria-hidden>♞</span> Hindsight
        </button>
        <span className="tagline">Hindsight is 20/20. Your chess can be too.</span>
        <span className="spacer" />
        {view.kind === 'review' && review && (
          <>
            <ShareButton link={shareLink} ply={reviewPly} pgn={sharePgn} title={`${review.white.name} vs ${review.black.name}`} />
            <button className="ghost" onClick={() => setView({ kind: 'import' })}>New review</button>
          </>
        )}
        <button
          className="ghost icon"
          aria-label={`Theme: ${theme}`}
          title={`Theme: ${theme} (click to change)`}
          onClick={() => {
            const next = THEME_NEXT[theme];
            setTheme(next);
            store('theme', next);
          }}
        >
          {THEME_ICON[theme]}
        </button>
        <button
          className="ghost icon"
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          title={muted ? 'Unmute sounds' : 'Mute sounds'}
          onClick={() => {
            setMutedState(!muted);
            store('muted', muted ? '0' : '1');
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </header>

      {view.kind === 'import' && (
        <main className="import-layout">
          <div className="hero">
            <span className="kicker">Hindsight is 20/20</span>
            <TornHeadline />
            <p>
              Find the exact move that won or lost your game. Stockfish grades every move, explains every mistake and
              shows you what you should have played. Free, unlimited, and no sign-up.
            </p>
            <ul className="proof">
              <li><span aria-hidden>∞</span> Unlimited free reviews</li>
              <li><span aria-hidden>⚡</span> Runs in your browser</li>
              <li><span aria-hidden>♟</span> Chess.com &amp; Lichess</li>
            </ul>
          </div>
          <ImportPanel
            depth={depth}
            setDepth={setDepth}
            onReview={startReview}
            history={history}
            onOpenHistory={openHistory}
            onDeleteHistory={deleteHistory}
            error={error}
          />
          {review && (
            <button className="ghost back-to-review" onClick={() => setView({ kind: 'review' })}>
              ← Back to the current review
            </button>
          )}
        </main>
      )}

      {view.kind !== 'import' && (
        <main className={`review-layout ${view.kind === 'analyzing' ? 'analyzing-mode' : ''}`}>
          <div className="board-column">
            {bar(topSide)}
            <div className="board-wrap">
              <EvalBar score={barScore} orientation={orientation} />
              <Board
                fen={boardFen}
                orientation={orientation}
                lastMove={lastMove}
                shapes={shapes}
                interactive={view.kind === 'review'}
                onMove={onBoardMove}
                badges={badges}
              />
            </div>
            {bar(bottomSide)}
            {view.kind === 'review' && (
              <MoveStrip
                moves={moves}
                ply={explore ? explore.returnPly : ply}
                onSelect={goTo}
                onPrev={() => (explore ? exploreBack() : goTo(ply - 1))}
                onNext={() => goTo(explore ? explore.returnPly : ply + 1)}
              />
            )}
          </div>

          <aside className="side-column">
            <div className="side-inner">
            {view.kind === 'analyzing' && (
              <div className="side-scroll">
              <AnalyzingPanel
                white={view.white}
                black={view.black}
                info={info}
                done={view.done}
                total={view.fens.length}
                depth={view.depth}
                stage={view.stage}
                startedAt={view.startedAt}
                onCancel={cancel}
              />
              </div>
            )}
            {view.kind === 'review' && review && (
              <>
                <div className="tab-bar" role="tablist">
                  {tabButton('report', 'Report', <ReportIcon />)}
                  {tabButton('analysis', 'Analysis', <BoardIcon />)}
                  {tabButton('insights', 'Insights', <BulbIcon />)}
                  <div className="tab-tools">
                    <button
                      className={`tool ${showEngine ? 'on' : ''}`}
                      onClick={() => {
                        setShowEngine(!showEngine);
                        store('engineArrows', showEngine ? '0' : '1');
                      }}
                      title={showEngine ? "Hide the engine's next-move arrow" : "Show the engine's next-move arrow"}
                      aria-pressed={showEngine}
                    >
                      <ArrowIcon />
                    </button>
                    <button className="tool" onClick={() => setOrientation(orientation === 'white' ? 'black' : 'white')} aria-label="Flip board" title="Flip board (f)">
                      <FlipIcon />
                    </button>
                  </div>
                </div>

                <div className="side-scroll tab-panel" key={tab}>
                  {tab === 'report' && (
                    <Summary
                      review={review}
                      info={info}
                      onJump={jumpTo}
                      onAllStats={() => setTab('insights')}
                      graph={<EvalGraph scores={scores} moves={moves} ply={ply} phases={review.phases} onSelect={goTo} />}
                    />
                  )}
                  {tab === 'analysis' && (
                    <>
                      <CoachPanel
                        review={review}
                        move={current}
                        exploring={explore && { lines: explore.lines, sanLines, retry: explore.retry }}
                        onRetry={() => current && startExplore(ply - 1, undefined, { target: current })}
                        onShowBest={() => current?.bestUci && startExplore(ply - 1, current.bestUci)}
                        onBackToGame={() => goTo(explore?.returnPly ?? ply, false)}
                      />
                      {currentLines.length > 0 && (
                        <section className="card engine-card">
                          <header>
                            <span className="form-label">Best here</span>
                            <span className="depth-chip">depth {currentLines[0].depth}</span>
                          </header>
                          <ol className="engine-lines">
                            {currentLines.map((l, i) => (
                              <li key={i}>
                                <span className="line-eval">{formatScore(l.score)}</span>
                                <span className="line-moves">
                                  <strong>{l.san[0]}</strong> {l.san.slice(1).join(' ')}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </section>
                      )}
                      <EvalGraph scores={scores} moves={moves} ply={explore ? explore.returnPly : ply} phases={review.phases} onSelect={goTo} />
                      <MoveList moves={moves} ply={ply} onSelect={goTo} />
                    </>
                  )}
                  {tab === 'insights' && (
                    <InsightsPanel
                      review={review}
                      info={info}
                      defaultSide={sideOf(review.headers, me) ?? 'white'}
                      onJump={(p) => {
                        setTab('analysis');
                        goTo(p);
                      }}
                    />
                  )}
                  <p className="fine-print">
                    Stockfish 17.1 (lite) · depth {review.depth}
                    {headers?.Event && headers.Event !== '?' ? ` · ${headers.Event}` : ''}
                    {headers?.Date && !headers.Date.startsWith('?') ? ` · ${headers.Date}` : ''}
                  </p>
                </div>

                {/* Always visible at the bottom of the panel, level with the move strip. */}
                {tab === 'report' ? (
                  <div className="side-foot">
                    <button
                      className="cta start-review"
                      onClick={() => {
                        setTab('analysis');
                        goTo(Math.max(ply, 1));
                      }}
                    >
                      Start review
                    </button>
                  </div>
                ) : (
                  <nav className="side-foot nav-buttons" aria-label="Move navigation">
                    <button className="nav-btn" onClick={() => goTo(0)} aria-label="First move"><Chevron dir="left" double /></button>
                    <button className="nav-btn cta" onClick={() => (explore ? exploreBack() : goTo(ply - 1))} aria-label="Previous move"><Chevron dir="left" /></button>
                    <button className="nav-btn cta" onClick={() => goTo(explore ? explore.returnPly : ply + 1)} aria-label="Next move"><Chevron dir="right" /></button>
                    <button className="nav-btn" onClick={() => goTo(moves.length)} aria-label="Last move"><Chevron dir="right" double /></button>
                  </nav>
                )}
              </>
            )}
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}

interface PlayerBarProps {
  side: 'white' | 'black';
  name?: string;
  rating?: string;
  accuracy?: number;
  info: PlayerInfo;
  clock?: number;
  toMove: boolean;
  winner: boolean;
}

function PlayerBar({ side, name, rating, accuracy, info, clock, toMove, winner }: PlayerBarProps) {
  return (
    <div className={`player-bar ${winner ? 'winner' : ''}`}>
      <div className="player-chip">
        <span className="player-avatar-wrap">
          {winner && <span className="crown" aria-label="Winner">♛</span>}
          <Avatar name={name ?? '?'} src={info.avatar} side={side} size={30} />
        </span>
        <TitleBadge title={info.title} />
        <span className="player-name">{name ?? ' '}</span>
        {rating && <span className="player-rating">{rating}</span>}
      </div>
      <span className="spacer" />
      {accuracy !== undefined && <span className="player-acc">{accuracy.toFixed(1)}%</span>}
      {clock !== undefined && <span className={`clock ${side} ${toMove ? 'running' : ''}`}>{formatClock(clock)}</span>}
    </div>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <rect x="3" y="12" width="4.5" height="9" rx="1.2" fill="#5fb041" />
      <rect x="9.75" y="7" width="4.5" height="14" rx="1.2" fill="#22b8b0" />
      <rect x="16.5" y="3" width="4.5" height="18" rx="1.2" fill="#5a8cf0" />
    </svg>
  );
}
function BoardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#7f9c8f" />
      <path d="M3 6a3 3 0 0 1 3-3h6v9H3zM12 12h9v6a3 3 0 0 1-3 3h-6z" fill="#ece3cf" />
    </svg>
  );
}
function BulbIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.6.5.8 1.1.8 1.8V17h6v-.9c0-.7.3-1.3.8-1.8A6.5 6.5 0 0 0 12 2.5z" fill="#f2b22e" />
      <rect x="9" y="18" width="6" height="2" rx="1" fill="#8f9a9c" />
      <rect x="10" y="20.6" width="4" height="1.6" rx=".8" fill="#8f9a9c" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 19 19 5M10 5h9v9" />
    </svg>
  );
}
function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
    </svg>
  );
}
