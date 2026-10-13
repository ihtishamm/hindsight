// Avatars and titles for the two players of a reviewed game, looked up on the
// site the game came from. Chess.com has avatars; Lichess only has titles.
import { useEffect, useState } from 'react';

export interface PlayerInfo {
  avatar?: string;
  title?: string;
}

const cache = new Map<string, Promise<PlayerInfo>>();

function siteOf(headers: Record<string, string>): 'chesscom' | 'lichess' | undefined {
  const site = `${headers.Site ?? ''} ${headers.Link ?? ''}`.toLowerCase();
  if (site.includes('chess.com')) return 'chesscom';
  if (site.includes('lichess')) return 'lichess';
  return undefined;
}

function lookup(site: 'chesscom' | 'lichess', name: string): Promise<PlayerInfo> {
  const key = `${site}:${name.toLowerCase()}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      try {
        if (site === 'chesscom') {
          const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(name.toLowerCase())}`);
          if (!res.ok) return {};
          const j = await res.json();
          return { avatar: j.avatar, title: j.title };
        }
        const res = await fetch(`https://lichess.org/api/user/${encodeURIComponent(name)}`);
        if (!res.ok) return {};
        const j = await res.json();
        return { title: j.title };
      } catch {
        return {};
      }
    })();
    cache.set(key, p);
  }
  return p;
}

/** Info for White and Black; empty until (or unless) the lookup succeeds. */
export function usePlayerInfo(headers?: Record<string, string>): { white: PlayerInfo; black: PlayerInfo } {
  const [info, setInfo] = useState<{ white: PlayerInfo; black: PlayerInfo }>({ white: {}, black: {} });
  const white = headers?.White;
  const black = headers?.Black;
  const site = headers && siteOf(headers);
  useEffect(() => {
    const fromHeaders = { white: { title: headers?.WhiteTitle }, black: { title: headers?.BlackTitle } };
    setInfo(fromHeaders);
    if (!site || !white || !black) return;
    let live = true;
    void Promise.all([lookup(site, white), lookup(site, black)]).then(([w, b]) => {
      if (live) setInfo({ white: { ...fromHeaders.white, ...w, title: w.title ?? fromHeaders.white.title }, black: { ...fromHeaders.black, ...b, title: b.title ?? fromHeaders.black.title } });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, white, black]);
  return info;
}
