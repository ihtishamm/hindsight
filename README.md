# Hindsight: free chess game review

Hindsight is 20/20, and now your chess can be too. Hindsight is a free, open-source game review
that runs entirely in your browser. Stockfish 17.1 (WebAssembly) analyses every position on your
own machine, so there's no server, no account
and no review limit.

## Features

- **Unlimited reviews.** Paste a PGN, or look up any **Lichess** or **Chess.com** username.
- **Player profiles:** avatar, rating for each time control, recent form and a rating trend.
- **Games list** that pages back through the whole archive (month by month on Chess.com), with
  filters for time control, colour, result, rated/casual, opening and date range.
- **Move classifications:** Brilliant, Great, Best, Excellent, Good, Book, Forced,
  Inaccuracy, Mistake, Miss and Blunder, based on an expected-points model.
- **Game report:** accuracy for both players (the Lichess algorithm), accuracy per phase
  (opening, middlegame, endgame), an estimated game rating, tactics vs strategy scores with
  a verdict, and counts for each label. Click a row to jump to that kind of move.
- **Eval bar** and a clickable **evaluation graph** with key moments marked.
- **Best-move arrows.** A green arrow shows what you should have played; an optional blue arrow
  shows the engine's next move.
- **Coach explanations** for every move: hanging pieces, missed tactics, allowed mates,
  material won, and the better line.
- **Retry** any inaccuracy or mistake as a mini-puzzle, or **explore** freely with live
  multi-line analysis.
- Smooth piece **animations**, count-up stats, crisp wooden **move sounds** (move, capture,
  check, castle, promote, game end), and keyboard navigation (← → ↑ ↓, `f` to flip).
- **Share links.** The Share button copies a link that opens the same review at the same move
  and board orientation. The game travels inside the link (compressed PGN in the `#` part of the
  URL, never sent to a server), and the address bar always follows the move you're on.
- Game-end sounds and king badges for a win, a loss or a draw.
- Recent reviews are cached in your browser and reopen instantly (shared links too).
- Light, dark or system theme, and a mobile layout.

## Run it

```sh
npm install        # also copies the Stockfish WASM build into public/engine
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ — host it anywhere
```

The single-threaded engine build needs no cross-origin-isolation headers, so `dist/` works on
any static host (GitHub Pages, Netlify, Cloudflare Pages…).

## Tests

```sh
npm test             # unit tests, including Lichess's own accuracy test cases
npm run test:engine  # full review of Morphy's Opera Game with the real engine (Node)
```

## How it works

[`docs/how-game-review-works.md`](docs/how-game-review-works.md) explains how evals become
win chances, how moves are labelled, and how accuracy, phases and the game rating are computed.
It compares Lichess and Chess.com, with sources. [`docs/review-ux.md`](docs/review-ux.md)
covers the UX research behind the review screen.

| Path | What it is |
|---|---|
| `src/analysis/winChance.ts` | Eval → winning chances / expected points |
| `src/analysis/accuracy.ts` | Per-move and game accuracy |
| `src/analysis/classify.ts` | Brilliant…Blunder rules |
| `src/analysis/explain.ts` | Coach-style explanations |
| `src/analysis/phases.ts` | Opening / middlegame / endgame split (port of scalachess `Divider`) |
| `src/analysis/insights.ts` | Phase accuracy, game rating, tactics vs strategy |
| `src/importers.ts` | Chess.com and Lichess profiles and game archives |
| `src/share.ts` | Share links: compact PGN, deflate + base64url in the URL fragment |
| `src/analysis/review.ts` | Runs the engine over a game and assembles the review |
| `src/engine/engine.ts` | UCI wrapper around Stockfish in a Web Worker |
| `src/sound.ts` | Move sounds (Web Audio playback of `public/sounds`) |
| `scripts/build-sounds.mjs` | Builds the sounds from Kenney's CC0 packs |

## Credits & license

- [Stockfish](https://stockfishchess.org) via [stockfish.js](https://github.com/nmrugg/stockfish.js) (GPLv3)
- [chessground](https://github.com/lichess-org/chessground) board (GPLv3) and cburnett pieces
- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2)
- Sounds built from [Kenney](https://kenney.nl)'s Impact Sounds and Interface Sounds (CC0)
- Opening names from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0)
- Win-chance and accuracy formulas from [Lichess](https://github.com/lichess-org/lila)

Hindsight is licensed under **GPL-3.0-or-later**. It is an independent project, not affiliated
with Chess.com or Lichess.
