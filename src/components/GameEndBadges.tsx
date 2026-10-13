import { Chess } from 'chess.js';

export type Outcome = 'win' | 'loss' | 'draw';
export type EndReason = 'checkmate' | 'resignation' | 'time' | 'stalemate' | 'repetition' | 'agreement' | 'material' | 'other';

export interface KingBadge {
  square: string;
  outcome: Outcome;
  reason: EndReason;
  /** Text for the pill next to the badge; no pill when absent. */
  label?: string;
}

/** Why the game ended, from the final position and the PGN's Termination tag. */
function endReason(fen: string, headers: Record<string, string>): EndReason {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isInsufficientMaterial()) return 'material';
  const t = (headers.Termination ?? '').toLowerCase();
  if (t.includes('resign')) return 'resignation';
  if (t.includes('time')) return 'time';
  if (t.includes('repetition')) return 'repetition';
  if (t.includes('agree')) return 'agreement';
  if (t.includes('insufficient')) return 'material';
  if (t.includes('stalemate')) return 'stalemate';
  return 'other';
}

/**
 * Badges for both kings once the game is over, like the end of a game on the
 * big sites: a laurel pill for the winner, a red badge for the loser, grey for a draw.
 * `me` is the player the review belongs to, when known, so the pill can say "You win!".
 */
/** The game's result: from the final position when it's mate, otherwise from the PGN. */
export function finalResult(fen: string, headers: Record<string, string>): '1-0' | '0-1' | '1/2-1/2' | undefined {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return chess.turn() === 'w' ? '0-1' : '1-0';
  const r = headers.Result;
  return r === '1-0' || r === '0-1' || r === '1/2-1/2' ? r : undefined;
}

/** Win, loss or draw for `side`, once the game has a result. */
export function outcomeFor(fen: string, headers: Record<string, string>, side: 'white' | 'black'): Outcome | undefined {
  const r = finalResult(fen, headers);
  if (!r) return undefined;
  if (r === '1/2-1/2') return 'draw';
  return (r === '1-0') === (side === 'white') ? 'win' : 'loss';
}

export function gameEndBadges(fen: string, headers: Record<string, string>, me?: 'white' | 'black'): KingBadge[] {
  const chess = new Chess(fen);
  const result = finalResult(fen, headers);
  if (!result) return [];
  const reason = endReason(fen, headers);
  const kings: Record<'white' | 'black', string | undefined> = { white: undefined, black: undefined };
  for (const row of chess.board()) for (const sq of row) if (sq?.type === 'k') kings[sq.color === 'w' ? 'white' : 'black'] = sq.square;
  if (!kings.white || !kings.black) return [];

  if (result === '1/2-1/2') {
    const pillOn = me ?? 'white';
    return (['white', 'black'] as const).map((c) => ({ square: kings[c]!, outcome: 'draw', reason, label: c === pillOn ? 'Draw' : undefined }));
  }
  const winner = result === '1-0' ? 'white' : 'black';
  const loser = winner === 'white' ? 'black' : 'white';
  return [
    { square: kings[winner]!, outcome: 'win', reason, label: me === loser ? undefined : me === winner ? 'You win!' : `${winner === 'white' ? 'White' : 'Black'} wins` },
    { square: kings[loser]!, outcome: 'loss', reason, label: me === loser ? 'You lost' : undefined },
  ];
}

const REASON_TITLE: Record<EndReason, string> = {
  checkmate: 'by checkmate',
  resignation: 'by resignation',
  time: 'on time',
  stalemate: 'by stalemate',
  repetition: 'by repetition',
  agreement: 'by agreement',
  material: 'by insufficient material',
  other: '',
};

/** Badges positioned over the board; `orientation` decides where each square sits. */
export function BadgeLayer({ badges, orientation }: { badges: KingBadge[]; orientation: 'white' | 'black' }) {
  return (
    <div className="badge-layer" aria-live="polite">
      {badges.map((b, i) => {
        const file = b.square.charCodeAt(0) - 97;
        const rank = Number(b.square[1]);
        const col = orientation === 'white' ? file : 7 - file;
        const row = orientation === 'white' ? 8 - rank : rank - 1;
        const title = `${b.outcome === 'win' ? 'Won' : b.outcome === 'loss' ? 'Lost' : 'Drawn'} ${REASON_TITLE[b.reason]}`.trim();
        const delay = { ['--d' as string]: `${i * 140}ms` };
        return [
          <div key={`sq-${b.square}`} className={`king-square ${b.outcome}`} style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, ...delay }} />,
          <div
            key={`${b.square}-${b.outcome}`}
            className={`king-badge ${b.outcome} ${col >= 5 ? 'pill-left' : ''}`}
            style={{ left: `${(col + 1) * 12.5}%`, top: `${row * 12.5}%`, ...delay }}
            title={title}
          >
            <span className="badge-icon">
              <BadgeIcon outcome={b.outcome} reason={b.reason} />
            </span>
            {b.label && <span className="badge-pill">{b.label}</span>}
            <span className="sr-only">{title}</span>
          </div>,
        ];
      })}
    </div>
  );
}

function BadgeIcon({ outcome, reason }: { outcome: Outcome; reason: EndReason }) {
  if (outcome === 'draw') return <span className="badge-half">½</span>;
  if (outcome === 'win')
    // Laurel wreath around a star.
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 7.2l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="currentColor" />
        <path d="M6.5 5.5C4 8 3.8 13.5 7.5 17.5M17.5 5.5C20 8 20.2 13.5 16.5 17.5M7.5 17.5 9.5 19.5M16.5 17.5l-2 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M5 9.5l-1.6-.6M4.7 12.8l-1.7.2M5.8 15.6l-1.4 1M19 9.5l1.6-.6M19.3 12.8l1.7.2M18.2 15.6l1.4 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  if (reason === 'checkmate') return <span className="badge-hash">#</span>;
  if (reason === 'time')
    return (
      <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="13" r="7.5" />
        <path d="M12 9v4l2.5 2M10 3h4" />
      </svg>
    );
  if (reason === 'resignation')
    return (
      <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" fill="currentColor" fillOpacity=".9" />
      </svg>
    );
  // Fallen king.
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M4 17.5h16v2.5H4zM6 16l1.5-6.5 4.5 3 4.5-3L18 16z" />
      <path d="M11 3h2v2.2h2v2h-2V9h-2V7.2H9v-2h2z" />
    </svg>
  );
}
