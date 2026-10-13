import { useEffect, useState } from 'react';

const REPO = 'ihtishamm/hindsight';
const CACHE_KEY = 'gh-stars';
const CACHE_MS = 60 * 60 * 1000; // the unauthenticated API allows 60 requests an hour

const cachedStars = (): number | undefined => {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return c && Date.now() - c.at < CACHE_MS ? c.stars : undefined;
  } catch {
    return undefined;
  }
};

/** The header's link to the repo, with its live star count. */
export function GitHubLink() {
  const [stars, setStars] = useState(cachedStars);

  useEffect(() => {
    if (stars !== undefined) return;
    const ctrl = new AbortController();
    fetch(`https://api.github.com/repos/${REPO}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { stargazers_count: number }) => {
        setStars(d.stargazers_count);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ stars: d.stargazers_count, at: Date.now() }));
        } catch {
          /* storage unavailable */
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [stars]);

  return (
    <a
      className="github-link"
      href={`https://github.com/${REPO}`}
      target="_blank"
      rel="noreferrer"
      aria-label={stars === undefined ? 'Hindsight on GitHub' : `Hindsight on GitHub, ${stars} stars`}
      title="Star Hindsight on GitHub"
    >
      <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      {stars !== undefined && (
        <span className="github-stars">
          <span aria-hidden>★</span> {stars.toLocaleString()}
        </span>
      )}
    </a>
  );
}
