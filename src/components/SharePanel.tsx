import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Builds the link; `atMove` false gives a link to the start of the game. */
  link: (atMove: boolean) => string | undefined;
  ply: number;
  pgn: string;
  title: string;
}

/** The header's Share button and its dropdown: copy link, native share, PGN. */
export function ShareButton({ link, ply, pgn, title }: Props) {
  const [open, setOpen] = useState(false);
  const [atMove, setAtMove] = useState(true);
  const [copied, setCopied] = useState<'link' | 'pgn'>();
  const root = useRef<HTMLDivElement>(null);
  const url = link(atMove && ply > 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(undefined), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (text: string, what: 'link' | 'pgn') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers / insecure origins: select-and-copy fallback.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(what);
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([pgn], { type: 'application/x-chess-pgn' }));
    a.download = `${title.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'game'}.pgn`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const canNativeShare = typeof navigator.share === 'function';
  const moveLabel = `${Math.ceil(ply / 2)}${ply % 2 ? '.' : '…'}`;

  return (
    <div className="share" ref={root}>
      <button className={`ghost share-btn ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-label="Share" title="Share this review" aria-expanded={open} aria-haspopup="dialog">
        <ShareIcon />
        <span className="share-label">Share</span>
      </button>
      {open && (
        <div className="share-panel" role="dialog" aria-label="Share this review">
          <h3>Share this review</h3>
          <p className="muted small-text">The game travels inside the link. Whoever opens it gets the same review, analysed in their own browser.</p>

          <div className="share-link">
            <input readOnly value={url ?? 'Preparing link…'} onFocus={(e) => e.currentTarget.select()} aria-label="Review link" />
            <button className="cta small-cta" disabled={!url} onClick={() => url && copy(url, 'link')}>
              {copied === 'link' ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>

          <label className="share-opt">
            <input type="checkbox" checked={atMove && ply > 0} disabled={ply === 0} onChange={(e) => setAtMove(e.target.checked)} />
            {ply > 0 ? `Open at the current move (${moveLabel})` : 'Opens at the start of the game'}
          </label>

          <div className="share-actions">
            {canNativeShare && (
              <button className="dark-btn" disabled={!url} onClick={() => url && navigator.share({ title: `${title} · Hindsight review`, url }).catch(() => {})}>
                <ShareIcon /> Share via…
              </button>
            )}
            <button onClick={() => copy(pgn, 'pgn')}>{copied === 'pgn' ? 'PGN copied ✓' : 'Copy PGN'}</button>
            <button onClick={download}>Download PGN</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="m8.3 10.8 7.4-4.4M8.3 13.2l7.4 4.4" />
    </svg>
  );
}
