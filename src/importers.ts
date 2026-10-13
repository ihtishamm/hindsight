// Player profiles and game archives from the public Chess.com and Lichess APIs.
// Both send CORS headers and need no auth.

export type Site = 'lichess' | 'chesscom';
export type Speed = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily';
export const SPEEDS: Speed[] = ['bullet', 'blitz', 'rapid', 'classical', 'daily'];

export interface GamePlayer {
  name: string;
  rating?: number;
}

export interface RemoteGame {
  id: string;
  url?: string;
  white: GamePlayer;
  black: GamePlayer;
  winner?: 'white' | 'black';
  result: '1-0' | '0-1' | '½-½';
  /** End (Chess.com) or start (Lichess) time, ms since epoch. */
  date: number;
  speed: Speed;
  rated: boolean;
  opening?: string;
  pgn: string;
}

export interface Rating {
  speed: Speed | 'puzzle';
  rating: number;
  games?: number;
  best?: number;
  provisional?: boolean;
  /** Rating change over the last ~12 games (Lichess) when known. */
  progress?: number;
  record?: { win: number; loss: number; draw: number };
}

export interface Profile {
  site: Site;
  username: string;
  name?: string;
  avatar?: string;
  title?: string;
  /** ISO country code, when known. */
  country?: string;
  url: string;
  joined?: number;
  lastSeen?: number;
  ratings: Rating[];
}

/** A user's games, newest first, loaded one page at a time. */
export interface GameFeed {
  next(): Promise<RemoteGame[]>;
  readonly done: boolean;
}

const json = async (url: string, what: string) => {
  const res = await fetch(url);
  if (res.status === 404) throw new Error(`${what} not found`);
  if (res.status === 429) throw new Error('Too many requests. Wait a minute and try again.');
  if (!res.ok) throw new Error(`${what}: the server returned ${res.status}`);
  return res.json();
};

/** "Sicilian Defense: Najdorf Variation" → "Sicilian Defense". */
export function openingFamily(name: string): string {
  const head = name.split(/[:,]/)[0].trim();
  const m = /^(.*?\b(?:Defen[cs]e|Game|Opening|Gambit|Attack|System|Variation))\b/.exec(head);
  return m ? m[1] : head;
}

// ---- Lichess ---------------------------------------------------------------

const LICHESS_SPEED: Record<string, Speed> = {
  ultraBullet: 'bullet',
  bullet: 'bullet',
  blitz: 'blitz',
  rapid: 'rapid',
  classical: 'classical',
  correspondence: 'daily',
};

export async function fetchLichessProfile(user: string): Promise<Profile> {
  const u = await json(`https://lichess.org/api/user/${encodeURIComponent(user)}`, `Lichess user "${user}"`);
  if (u.disabled || u.closed) throw new Error(`Lichess account "${user}" is closed`);
  const ratings: Rating[] = [];
  for (const [key, speed] of Object.entries({ bullet: 'bullet', blitz: 'blitz', rapid: 'rapid', classical: 'classical', correspondence: 'daily', puzzle: 'puzzle' } as const)) {
    const p = u.perfs?.[key];
    if (p?.games) ratings.push({ speed, rating: p.rating, games: p.games, provisional: !!p.prov, progress: p.prog });
  }
  return {
    site: 'lichess',
    username: u.username,
    name: u.profile?.realName,
    title: u.title,
    country: u.profile?.flag?.slice(0, 2),
    url: u.url ?? `https://lichess.org/@/${u.username}`,
    joined: u.createdAt,
    lastSeen: u.seenAt,
    ratings,
  };
}

export function lichessFeed(user: string, pageSize = 30): GameFeed {
  let until: number | undefined;
  let done = false;
  return {
    get done() {
      return done;
    },
    async next() {
      if (done) return [];
      const url =
        `https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=${pageSize}&pgnInJson=true&opening=true&clocks=true&evals=false` +
        (until ? `&until=${until}` : '');
      const res = await fetch(url, { headers: { Accept: 'application/x-ndjson' } });
      if (res.status === 404) throw new Error(`Lichess user "${user}" not found`);
      if (res.status === 429) throw new Error('Lichess is rate-limiting requests. Wait a minute and try again.');
      if (!res.ok) throw new Error(`Lichess returned ${res.status}`);
      const raw = (await res.text()).split('\n').filter(Boolean).map((l) => JSON.parse(l));
      if (raw.length < pageSize) done = true;
      if (raw.length) until = raw.at(-1).createdAt - 1;
      return raw
        .filter((g) => g.variant === 'standard' || g.variant === 'fromPosition')
        .map((g): RemoteGame => ({
          id: `li-${g.id}`,
          url: `https://lichess.org/${g.id}`,
          white: { name: g.players.white.user?.name ?? (g.players.white.aiLevel ? `Stockfish level ${g.players.white.aiLevel}` : 'Anonymous'), rating: g.players.white.rating },
          black: { name: g.players.black.user?.name ?? (g.players.black.aiLevel ? `Stockfish level ${g.players.black.aiLevel}` : 'Anonymous'), rating: g.players.black.rating },
          winner: g.winner,
          result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½',
          date: g.createdAt,
          speed: LICHESS_SPEED[g.speed] ?? 'classical',
          rated: !!g.rated,
          opening: g.opening?.name,
          pgn: g.pgn,
        }));
    },
  };
}

// ---- Chess.com -------------------------------------------------------------

const chessComUser = (user: string) => `https://api.chess.com/pub/player/${encodeURIComponent(user.trim().toLowerCase())}`;

export async function fetchChessComProfile(user: string): Promise<Profile> {
  const what = `Chess.com user "${user}"`;
  const [p, stats] = await Promise.all([json(chessComUser(user), what), json(`${chessComUser(user)}/stats`, what)]);
  const ratings: Rating[] = [];
  for (const [key, speed] of Object.entries({ chess_bullet: 'bullet', chess_blitz: 'blitz', chess_rapid: 'rapid', chess_daily: 'daily' } as const)) {
    const s = stats[key];
    if (!s?.last) continue;
    const record = s.record && { win: s.record.win, loss: s.record.loss, draw: s.record.draw };
    ratings.push({ speed, rating: s.last.rating, best: s.best?.rating, record, games: record && record.win + record.loss + record.draw });
  }
  if (stats.tactics?.highest) ratings.push({ speed: 'puzzle', rating: stats.tactics.highest.rating, best: stats.tactics.highest.rating });
  return {
    site: 'chesscom',
    username: p.username ?? user,
    name: p.name,
    avatar: p.avatar,
    title: p.title,
    country: typeof p.country === 'string' ? p.country.split('/').pop() : undefined,
    url: p.url ?? `https://www.chess.com/member/${user}`,
    joined: p.joined && p.joined * 1000,
    lastSeen: p.last_online && p.last_online * 1000,
    ratings,
  };
}

/** "https://www.chess.com/openings/Italian-Game-Two-Knights-Defense-4.d3" → "Italian Game Two Knights Defense". */
function chessComOpening(ecoUrl?: string): string | undefined {
  const slug = ecoUrl?.split('/openings/')[1];
  if (!slug) return undefined;
  return decodeURIComponent(slug).split(/-\d+\./)[0].replace(/-/g, ' ').trim() || undefined;
}

/** Chess.com archives are monthly; each page is one month, newest first. */
export function chessComFeed(user: string): GameFeed {
  let months: string[] | undefined;
  let done = false;
  return {
    get done() {
      return done;
    },
    async next() {
      if (done) return [];
      months ??= [...((await json(`${chessComUser(user)}/games/archives`, `Chess.com user "${user}"`)).archives as string[])].reverse();
      // Skip months without standard games so "load more" always brings something.
      while (months.length) {
        const month = await json(months.shift()!, 'Chess.com archive');
        const games = (month.games as any[])
          .filter((g) => g.pgn && g.rules === 'chess')
          .reverse()
          .map((g): RemoteGame => {
            const winner = g.white.result === 'win' ? 'white' : g.black.result === 'win' ? 'black' : undefined;
            return {
              id: `cc-${g.uuid ?? g.url}`,
              url: g.url,
              white: { name: g.white.username, rating: g.white.rating },
              black: { name: g.black.username, rating: g.black.rating },
              winner,
              result: winner === 'white' ? '1-0' : winner === 'black' ? '0-1' : '½-½',
              date: g.end_time * 1000,
              speed: g.time_class === 'daily' ? 'daily' : (g.time_class as Speed),
              rated: !!g.rated,
              opening: chessComOpening(g.eco ?? /\[ECOUrl "([^"]+)"\]/.exec(g.pgn)?.[1]),
              pgn: g.pgn,
            };
          });
        if (!months.length) done = true;
        if (games.length) return games;
      }
      done = true;
      return [];
    },
  };
}

export const fetchProfile = (site: Site, user: string) => (site === 'lichess' ? fetchLichessProfile : fetchChessComProfile)(user);
export const gameFeed = (site: Site, user: string) => (site === 'lichess' ? lichessFeed : chessComFeed)(user);
