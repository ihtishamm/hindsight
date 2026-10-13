import { useMemo, useRef, useState } from 'react';
import { GameFilters, NO_FILTERS, type Filters } from './GameFilters';
import { fetchProfile, gameFeed, openingFamily, SPEEDS, type GameFeed, type Profile, type RemoteGame, type Site, type Speed } from '../importers';

const SPEED_LABEL: Record<Speed | 'puzzle', string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classical',
  daily: 'Daily',
  puzzle: 'Puzzles',
};
const SPEED_ICON: Record<Speed | 'puzzle', string> = { bullet: '•', blitz: 'ϟ', rapid: '◷', classical: '♜', daily: '☀', puzzle: '✦' };

type Outcome = 'win' | 'loss' | 'draw';


interface Loaded {
  site: Site;
  user: string;
  profile?: Profile;
  games: RemoteGame[];
  feed: GameFeed;
}

const stored = (k: string) => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};
const store = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

/** The searched player's side of a game. */
function perspective(g: RemoteGame, user: string) {
  const color: 'white' | 'black' = g.black.name.toLowerCase() === user.toLowerCase() ? 'black' : 'white';
  const outcome: Outcome = !g.winner ? 'draw' : g.winner === color ? 'win' : 'loss';
  return { color, outcome, me: g[color], opp: g[color === 'white' ? 'black' : 'white'] };
}

// Chess.com files games by the month they started, so a long daily game can sort out of place.
const byDate = (games: RemoteGame[]) => games.sort((a, b) => b.date - a.date);

const flag = (cc?: string) =>
  cc && /^[A-Z]{2}$/i.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '';

/** Well-known accounts to try with one click. */
const QUICK_PICKS: Record<Site, { user: string; label: string }[]> = {
  chesscom: [
    { user: 'MagnusCarlsen', label: 'Magnus Carlsen' },
    { user: 'Hikaru', label: 'Hikaru' },
    { user: 'GothamChess', label: 'GothamChess' },
  ],
  lichess: [
    { user: 'DrNykterstein', label: 'DrNykterstein' },
    { user: 'EricRosen', label: 'Eric Rosen' },
    { user: 'penguingim1', label: 'penguingim1' },
  ],
};
const SITE_NAME: Record<Site, string> = { chesscom: 'Chess.com', lichess: 'Lichess' };
const userKey = (site: Site) => `account:user:${site}`;

interface Props {
  site: Site;
  /** `me` is the searched player, so the review can be shown from their side. */
  onReview: (pgn: string, me?: string) => void;
}

export function AccountBrowser({ site, onReview }: Props) {
  const [user, setUser] = useState(() => stored(userKey(site)));
  const [saved, setSaved] = useState(() => stored(userKey(site)));
  const [data, setData] = useState<Loaded>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const request = useRef(0);

  // Each site remembers its own username.
  const [shownSite, setShownSite] = useState(site);
  if (shownSite !== site) {
    setShownSite(site);
    setUser(stored(userKey(site)));
    setSaved(stored(userKey(site)));
    setError(undefined);
  }

  const search = async (name: string) => {
    name = name.trim();
    if (!name) {
      document.getElementById('username')?.focus();
      return;
    }
    setUser(name);
    const id = ++request.current;
    setLoading(true);
    setError(undefined);
    setFilters(NO_FILTERS);
    store(userKey(site), name);
    setSaved(name);
    try {
      const feed = gameFeed(site, name);
      const [profile, games] = await Promise.all([fetchProfile(site, name).catch(() => undefined), feed.next()]);
      if (id !== request.current) return;
      setData({ site, user: profile?.username ?? name, profile, games: byDate(games), feed });
    } catch (err) {
      if (id !== request.current) return;
      setError((err as Error).message);
      setData(undefined);
    } finally {
      if (id === request.current) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!data || data.feed.done) return;
    const id = request.current;
    setLoading(true);
    try {
      const more = await data.feed.next();
      if (id === request.current) setData((d) => d && { ...d, games: byDate([...d.games, ...more]) });
    } catch (err) {
      if (id === request.current) setError((err as Error).message);
    } finally {
      if (id === request.current) setLoading(false);
    }
  };

  const games = data?.games ?? [];
  const openings = useMemo(() => {
    const count = new Map<string, number>();
    for (const g of games) if (g.opening) count.set(openingFamily(g.opening), (count.get(openingFamily(g.opening)) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1]);
  }, [games]);
  const speeds = SPEEDS.map((s) => [s, games.filter((g) => g.speed === s).length] as [Speed, number]).filter(([, n]) => n > 0);

  const filtered = useMemo(() => {
    if (!data) return [];
    const from = filters.from ? new Date(`${filters.from}T00:00`).getTime() : -Infinity;
    const to = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : Infinity;
    return data.games.filter((g) => {
      const p = perspective(g, data.user);
      const q = filters.q.trim().toLowerCase();
      return (
        (!q || p.opp.name.toLowerCase().includes(q) || (g.opening ?? '').toLowerCase().includes(q)) &&
        (filters.speed === 'all' || g.speed === filters.speed) &&
        (filters.color === 'all' || p.color === filters.color) &&
        (filters.result === 'all' || p.outcome === filters.result) &&
        (filters.rated === 'all' || g.rated === (filters.rated === 'rated')) &&
        (!filters.opening || (g.opening && openingFamily(g.opening) === filters.opening)) &&
        g.date >= from &&
        g.date <= to
      );
    });
  }, [data, filters]);

  const active = Object.entries(filters).filter(([k, v]) => v !== NO_FILTERS[k as keyof Filters]).length;
  const oldest = games.length ? Math.min(...games.map((g) => g.date)) : undefined;
  const reachedFrom = filters.from && oldest !== undefined && oldest < new Date(`${filters.from}T00:00`).getTime();

  const forget = () => {
    store(userKey(site), '');
    setSaved('');
    setUser('');
  };

  return (
    <div className="account">
      <form
        className="source-form"
        onSubmit={(e) => {
          e.preventDefault();
          void search(user);
        }}
      >
        <div className="field-head">
          <label htmlFor="username">{SITE_NAME[site]} username</label>
          {saved && user === saved && (
            <button type="button" className="chip-x" onClick={forget} title="Forget this username">
              Previously used <span aria-hidden>✕</span>
            </button>
          )}
        </div>
        <input id="username" className="big-input" value={user} onChange={(e) => setUser(e.target.value)} placeholder={`Your ${SITE_NAME[site]} username`} autoComplete="off" spellCheck={false} />
        <button className="cta" disabled={loading}>
          <SearchIcon />
          {loading && !data ? 'Loading your games…' : 'Review my games'}
        </button>
        {error && <p className="error">{error}</p>}
        <div className="quick-picks" aria-label="Try a well-known player">
          {QUICK_PICKS[site].map((q) => (
            <button type="button" key={q.user} className="pick" onClick={() => void search(q.user)}>
              <span className="pick-avatar" aria-hidden>{q.label.slice(0, 1)}</span>
              {q.label}
            </button>
          ))}
        </div>
      </form>

      {data && data.site === site && (
        <div className="account-results">
          {data.profile && <ProfileCard profile={data.profile} games={data.games} user={data.user} />}

          <GameFilters filters={filters} onChange={setFilters} speeds={speeds} openings={openings} matches={filtered.length} />

          <p className="list-meta muted">
            {filtered.length === games.length ? `${games.length} games` : `${filtered.length} of ${games.length} loaded games match`}
            {oldest && ` · back to ${new Date(oldest).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
          </p>

          <ul className="game-list games">
            {filtered.map((g) => {
              const p = perspective(g, data.user);
              return (
                <li key={g.id}>
                  <button onClick={() => onReview(g.pgn, data.user)}>
                    <span className={`outcome ${p.outcome}`} aria-label={p.outcome}>{p.outcome === 'win' ? 'W' : p.outcome === 'loss' ? 'L' : 'D'}</span>
                    <span className="game-main">
                      <span className="players">
                        <span className={`dot ${p.color === 'white' ? 'black' : 'white'}`} title={`Opponent played ${p.color === 'white' ? 'Black' : 'White'}`} />
                        {p.opp.name}
                        {p.opp.rating && <span className="muted"> ({p.opp.rating})</span>}
                      </span>
                      <span className="meta">{g.opening ? openingFamily(g.opening) : 'Unknown opening'}</span>
                    </span>
                    <span className="game-side">
                      <span className="meta" title={SPEED_LABEL[g.speed]}>{SPEED_ICON[g.speed]} {SPEED_LABEL[g.speed]}{g.rated ? '' : ' · casual'}</span>
                      <span className="meta">{new Date(g.date).toLocaleDateString()}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="muted empty-row">{games.length ? 'No loaded games match these filters.' : 'No games found.'}</li>}
          </ul>

          {!data.feed.done && (
            <button className="load-more" onClick={loadMore} disabled={loading}>
              {loading ? 'Loading…' : data.site === 'chesscom' ? 'Load the previous month' : 'Load older games'}
              {reachedFrom ? '' : filtered.length < 5 && active > 0 ? ' to find more matches' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}

function ProfileCard({ profile, games, user }: { profile: Profile; games: RemoteGame[]; user: string }) {
  const recent = games.slice(0, 10).map((g) => perspective(g, user).outcome);
  const tally = { win: 0, loss: 0, draw: 0 };
  for (const g of games) tally[perspective(g, user).outcome]++;

  // Rating trend in the time control played most among the loaded games.
  const counts = new Map<Speed, number>();
  for (const g of games) counts.set(g.speed, (counts.get(g.speed) ?? 0) + 1);
  const main = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const trend = games
    .filter((g) => g.speed === main && g.rated)
    .map((g) => perspective(g, user).me.rating)
    .filter((r): r is number => r !== undefined)
    .slice(0, 40)
    .reverse();

  return (
    <div className="profile">
      <div className="profile-id">
        {profile.avatar ? <img className="avatar" src={profile.avatar} alt="" /> : <span className="avatar mono" aria-hidden>{profile.username.slice(0, 1).toUpperCase()}</span>}
        <div className="profile-names">
          <a className="profile-name" href={profile.url} target="_blank" rel="noreferrer">
            {profile.title && <span className="title-badge">{profile.title}</span>}
            {profile.username}
          </a>
          <span className="muted small-text">
            {[flag(profile.country), profile.name, profile.joined && `joined ${new Date(profile.joined).getFullYear()}`].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>

      <div className="ratings">
        {profile.ratings.map((r) => (
          <div className="rating-chip" key={r.speed} title={r.record ? `${r.record.win}W ${r.record.loss}L ${r.record.draw}D${r.best ? ` · best ${r.best}` : ''}` : r.games ? `${r.games} games` : undefined}>
            <span className="rating-speed">{SPEED_ICON[r.speed]} {SPEED_LABEL[r.speed]}</span>
            <span className="rating-value">
              {r.rating}
              {r.provisional && '?'}
              {r.progress ? <span className={r.progress > 0 ? 'up' : 'down'}>{r.progress > 0 ? `▲${r.progress}` : `▼${-r.progress}`}</span> : null}
            </span>
          </div>
        ))}
      </div>

      {games.length > 0 && (
        <div className="form">
          <div className="form-col">
            <span className="form-label">Recent form</span>
            <span className="form-chips">
              {recent.map((o, i) => (
                <span key={i} className={`outcome ${o}`} title={o}>{o === 'win' ? 'W' : o === 'loss' ? 'L' : 'D'}</span>
              ))}
            </span>
          </div>
          <div className="form-col">
            <span className="form-label">Last {games.length}</span>
            <span className="form-score">
              <span className="win">{tally.win}W</span> <span className="loss">{tally.loss}L</span> <span className="draw">{tally.draw}D</span>
            </span>
          </div>
          {trend.length > 2 && main && (
            <div className="form-col trend">
              <span className="form-label">{SPEED_LABEL[main]} trend</span>
              <Sparkline values={trend} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const W = 120;
  const H = 30;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 3 - ((v - lo) / span) * (H - 6)).toFixed(1)}`);
  const delta = values.at(-1)! - values[0];
  return (
    <span className="sparkline">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Rating from ${values[0]} to ${values.at(-1)}`}>
        <polyline points={pts.join(' ')} className={delta >= 0 ? 'up' : 'down'} />
      </svg>
      <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '+' : ''}{delta}</span>
    </span>
  );
}
