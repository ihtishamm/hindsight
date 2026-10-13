import { useEffect, useRef, useState } from 'react';
import type { Speed } from '../importers';

export interface Filters {
  /** Free text: opponent name or opening. */
  q: string;
  speed: Speed | 'all';
  color: 'all' | 'white' | 'black';
  result: 'all' | 'win' | 'loss' | 'draw';
  rated: 'all' | 'rated' | 'casual';
  opening: string;
  /** yyyy-mm-dd, inclusive; empty = open-ended. */
  from: string;
  to: string;
}
export const NO_FILTERS: Filters = { q: '', speed: 'all', color: 'all', result: 'all', rated: 'all', opening: '', from: '', to: '' };

const SPEED_LABEL: Record<Speed, string> = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical', daily: 'Daily' };
const RESULT_LABEL = { win: 'Wins', loss: 'Losses', draw: 'Draws' };
const COLOR_LABEL = { white: 'As White', black: 'As Black' };
const RATED_LABEL = { rated: 'Rated', casual: 'Casual' };

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => day(new Date(Date.now() - n * 864e5));
const PRESETS: { id: string; label: string; days?: number }[] = [
  { id: 'any', label: 'Any time' },
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '3 months', days: 90 },
  { id: '365', label: '1 year', days: 365 },
  { id: 'custom', label: 'Custom' },
];
function presetOf(f: Filters): string {
  if (!f.from && !f.to) return 'any';
  if (!f.to) {
    const p = PRESETS.find((p) => p.days && daysAgo(p.days) === f.from);
    if (p) return p.id;
  }
  return 'custom';
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  speeds: [Speed, number][];
  openings: [string, number][];
  matches: number;
}

/** A search box, a "Filters" dropdown with chip groups, and removable chips for what's active. */
export function GameFilters({ filters, onChange, speeds, openings, matches }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(() => presetOf(filters) === 'custom');
  const root = useRef<HTMLDivElement>(null);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });

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

  const preset = custom ? 'custom' : presetOf(filters);
  const chips: { label: string; clear: Partial<Filters> }[] = [];
  if (filters.speed !== 'all') chips.push({ label: SPEED_LABEL[filters.speed], clear: { speed: 'all' } });
  if (filters.color !== 'all') chips.push({ label: COLOR_LABEL[filters.color], clear: { color: 'all' } });
  if (filters.result !== 'all') chips.push({ label: RESULT_LABEL[filters.result], clear: { result: 'all' } });
  if (filters.rated !== 'all') chips.push({ label: RATED_LABEL[filters.rated], clear: { rated: 'all' } });
  if (filters.opening) chips.push({ label: filters.opening, clear: { opening: '' } });
  if (filters.from || filters.to) {
    const p = PRESETS.find((x) => x.id === presetOf(filters));
    const label = p && p.id !== 'custom' ? `Last ${p.label}` : `${filters.from || '…'} → ${filters.to || 'now'}`;
    chips.push({ label, clear: { from: '', to: '' } });
  }

  return (
    <div className="game-filters" ref={root}>
      <div className="filter-bar">
        <label className="search-box">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
          <input value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="Search opponent or opening" aria-label="Search games" />
          {filters.q && (
            <button type="button" className="clear-q" onClick={() => set('q', '')} aria-label="Clear search">✕</button>
          )}
        </label>
        <button type="button" className={`filter-toggle ${open ? 'open' : ''} ${chips.length ? 'has' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filters
          {chips.length > 0 && <span className="filter-count">{chips.length}</span>}
          <svg className="caret" viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="filter-panel" role="dialog" aria-label="Filter games">
          <Group label="Time control">
            <Chip on={filters.speed === 'all'} onClick={() => set('speed', 'all')}>All</Chip>
            {speeds.map(([s, n]) => (
              <Chip key={s} on={filters.speed === s} onClick={() => set('speed', s)}>
                {SPEED_LABEL[s]} <small>{n}</small>
              </Chip>
            ))}
          </Group>
          <div className="filter-cols">
            <Group label="Played as">
              <Chip on={filters.color === 'all'} onClick={() => set('color', 'all')}>Either</Chip>
              <Chip on={filters.color === 'white'} onClick={() => set('color', 'white')}><span className="dot white" /> White</Chip>
              <Chip on={filters.color === 'black'} onClick={() => set('color', 'black')}><span className="dot black" /> Black</Chip>
            </Group>
            <Group label="Game type">
              <Chip on={filters.rated === 'all'} onClick={() => set('rated', 'all')}>Both</Chip>
              <Chip on={filters.rated === 'rated'} onClick={() => set('rated', 'rated')}>Rated</Chip>
              <Chip on={filters.rated === 'casual'} onClick={() => set('rated', 'casual')}>Casual</Chip>
            </Group>
          </div>
          <Group label="Result">
            <Chip on={filters.result === 'all'} onClick={() => set('result', 'all')}>Any</Chip>
            <Chip on={filters.result === 'win'} onClick={() => set('result', 'win')} tone="win">Wins</Chip>
            <Chip on={filters.result === 'loss'} onClick={() => set('result', 'loss')} tone="loss">Losses</Chip>
            <Chip on={filters.result === 'draw'} onClick={() => set('result', 'draw')} tone="draw">Draws</Chip>
          </Group>
          <Group label="Opening">
            <select className="filter-select" value={filters.opening} onChange={(e) => set('opening', e.target.value)}>
              <option value="">All openings</option>
              {openings.map(([o, n]) => (
                <option key={o} value={o}>{`${o} (${n})`}</option>
              ))}
            </select>
          </Group>
          <Group label="Date">
            {PRESETS.map((p) => (
              <Chip
                key={p.id}
                on={preset === p.id}
                onClick={() => {
                  setCustom(p.id === 'custom');
                  if (p.id === 'any') onChange({ ...filters, from: '', to: '' });
                  else if (p.days) onChange({ ...filters, from: daysAgo(p.days), to: '' });
                }}
              >
                {p.label}
              </Chip>
            ))}
            {preset === 'custom' && (
              <div className="date-range">
                <input type="date" aria-label="From" value={filters.from} max={filters.to || undefined} onChange={(e) => set('from', e.target.value)} />
                <span aria-hidden>→</span>
                <input type="date" aria-label="To" value={filters.to} min={filters.from || undefined} onChange={(e) => set('to', e.target.value)} />
              </div>
            )}
          </Group>
          <div className="filter-foot">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setCustom(false);
                onChange({ ...NO_FILTERS, q: filters.q });
              }}
            >
              Reset
            </button>
            <button type="button" className="cta small-cta" onClick={() => setOpen(false)}>
              Show {matches} game{matches === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="active-chips">
          {chips.map((c) => (
            <button key={c.label} type="button" className="active-chip" onClick={() => onChange({ ...filters, ...c.clear })} title="Remove filter">
              {c.label} <span aria-hidden>✕</span>
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" className="link-btn" onClick={() => onChange({ ...NO_FILTERS, q: filters.q })}>Clear all</button>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="filter-group">
      <legend className="form-label">{label}</legend>
      <div className="chip-row">{children}</div>
    </fieldset>
  );
}

function Chip({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: 'win' | 'loss' | 'draw' }) {
  return (
    <button type="button" className={`fchip ${on ? 'on' : ''} ${tone ?? ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}
