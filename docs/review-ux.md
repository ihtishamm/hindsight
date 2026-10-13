# What makes a game review feel good

Before the redesign we studied Chess.com Game Review (its public landing page
and help articles; the review itself needs a login), the Lichess analysis
board and game page, Aimchess, and FotMob's match stats. We captured the pages
with REA and read the relevant Lichess source. These are the lessons we
applied, and where.

## Layout and hierarchy

- **Report first, moves second.** Chess.com opens on a summary (accuracy,
  then counts per move type, game rating and phases) and offers a single
  "Start review" call to action. Hindsight's side panel now opens on a **Report**
  tab, and "Start review" switches to **Analysis** at move 1. Clicking a count
  row, or stepping with the arrow keys, also switches to Analysis.
- **Mirrored comparison rows.** FotMob shows each stat as
  `home value · label · away value`, with bars growing out from the centre.
  The report uses that pattern for game rating, phase accuracy and the
  tactics/strategy bars. White is always on the left and Black on the right,
  matching the accuracy boxes.
- **One headline number per player.** Accuracy gets the biggest type, in
  boxes shaded like the pieces. Everything else is smaller and secondary.
- **Phases where Lichess puts them.** Lichess shows opening, middlegame and
  endgame accuracy under the players and marks the phase boundaries on the
  eval graph. We do both.
- **Profile above the games list.** Aimchess and the sites' own profile pages
  lead with ratings per time control and recent form. Our account panel shows
  the avatar, a rating chip for each time control, W/L/D form chips and a
  rating sparkline, then filters, then the list.

## Revealing stats

- Headline accuracy counts up over about 0.9 s with an ease-out curve, so it
  lands fast and settles. Black starts 120 ms after White.
- The report's sections fade up in sequence, 110 ms apart: rating, phases,
  style, counts. It reads like a scoreboard filling in.
- Each classification count ticks up 45 ms after the one above it.
- All of this is skipped under `prefers-reduced-motion`.

## Sound

- Move sounds are soft and woody (light-wood impacts with the harsh highs filtered out, kept
  well below full volume), with a fast attack, a decay of about
  0.15 s and no musical tail, like a piece set down on a board. Captures are
  heavier, castling is a double knock, and check adds a faint glassy tick.
- The report arrives with one soft "notify" chime, not a fanfare.
- Sources are Kenney's *Impact Sounds* and *Interface Sounds* (CC0).
  `scripts/build-sounds.mjs` layers, EQs, trims and level-matches them into
  `public/sounds/*.wav`. Lichess's sound sets are AGPL, which would complicate
  a GPL project. The sounds are WAV rather than MP3 because MP3 encoder
  padding delays the click.
