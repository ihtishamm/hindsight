# How chess game review works

Research notes behind Hindsight. Sources: the open-source Lichess code
([lichess-org/lila](https://github.com/lichess-org/lila)) and Chess.com's public help
articles. Chess.com's own implementation is closed. Everything below about Chess.com
comes from what its help center says, not from its code.

## 1. Engine eval → winning chances

A centipawn score isn't linear: +3 vs +4 matters far less than 0 vs +1. Both sites
map evals through a logistic curve fitted on real games.

**Lichess** (`ui/lib/src/ceval/winningChances.ts`, fitted in lila PR #11148):

```
winningChances(cp) = 2 / (1 + exp(-0.00368208 · cp)) − 1      // −1 … +1, cp clamped to ±1000
Win%               = 50 + 50 · winningChances(cp)
mate in n          → treated as cp = (21 − min(10, |n|)) · 100
```

**Chess.com** calls the same idea *Expected Points*: 1.00 = always winning,
0.00 = always losing, 0.50 = even. Its help article says the model uses both
the engine eval **and the player's rating**. The curve itself is not published.

Hindsight uses the Lichess curve as its expected-points model:
`EP = (1 + winningChances) / 2`. See `src/analysis/winChance.ts`.

## 2. Move classification

### Lichess (`modules/tree/src/main/Advice.scala`)
Lichess has only three negative labels, judged by the drop in winning chances
(the −1…+1 scale):

| drop ≥ | label |
|---|---|
| 0.3 | Blunder |
| 0.2 | Mistake |
| 0.1 | Inaccuracy |

Mate handling is separate. *MateCreated* means you walked into a forced mate:
it's a Blunder, or only an Inaccuracy/Mistake if you were already losing by
more than 7–10 pawns. *MateLost* means you had a forced mate and let it go.

### Chess.com ("How are moves classified?" help article)
Classification is by **expected points lost** relative to the engine's best move:

| Classification | EP lost |
|---|---|
| Best | 0.00 |
| Excellent | 0.00 – 0.02 |
| Good | 0.02 – 0.05 |
| Inaccuracy | 0.05 – 0.10 |
| Mistake | 0.10 – 0.20 |
| Blunder | 0.20 – 1.00 |

Special labels, as the article describes them:

- **Brilliant**: the best or nearly best move, and a good *piece sacrifice*.
  You must not be in a bad position after it, and you must not have been
  completely winning even without it. The bar is lower for newer players.
- **Great**: critical to the outcome. Examples: turning a losing position into an
  equal one, an equal one into a winning one, or finding the *only* good move.
- **Miss**: you failed to capitalise on the opponent's mistake.
- **Book**: an opening-theory move (not covered in that article).

### What Hindsight does (`src/analysis/classify.ts`)
1. **Book**: the position after the move is in the Lichess
   [chess-openings](https://github.com/lichess-org/chess-openings) dataset (CC0),
   and every move before it was book too.
2. **Forced**: it was the only legal move.
3. Otherwise, the base label comes from the Chess.com EP bands above.
4. If the move is Best or Excellent:
   - **Brilliant** if it sacrifices material. That means a static-exchange
     check finds a non-pawn piece the opponent can win, net of anything just
     captured, that wasn't already hanging. Two more conditions: the mover's EP
     after the move is ≥ 0.45, and the second-best move was not already ≥ 0.90.
   - **Great** if the second-best engine line is ≥ 0.15 EP worse (an "only
     move"), the mover wasn't already completely winning, and it isn't a simple
     recapture.
5. If the move is an Inaccuracy, Mistake or Blunder, it becomes **Miss** in
   either of two cases:
   - The opponent's previous move was a Mistake or Blunder, this move gives
     back ≥ 0.10 EP, and the mover ends up about where they were before the
     opponent's error.
   - There was a forced mate and the mover let it go while staying clearly better.

**Hindsight correction.** When the played move was the engine's own first
choice, the next position's search is effectively one ply deeper. Hindsight copies
that score back to the previous position, walking backwards through the game,
so a mate the engine found one move late still credits the move that set it
up. Without this, the depth-14 analysis of Morphy's Opera Game called 15.Bxd7+
a blunder.

## 3. Accuracy

**Lichess** (`modules/analyse/src/main/AccuracyPercent.scala`). Hindsight ports
this exactly, in `src/analysis/accuracy.ts`, and the Lichess unit tests pass
against the port.

Per move (Win% from the mover's perspective):

```
accuracy = 103.1668 · exp(−0.04354 · (Win%before − Win%after)) − 3.1669 + 1   // clamp 0…100; 100 if no loss
```

Per game, for each colour:
- window = clamp(moves / 10, 2, 8) positions
- each move's weight = standard deviation of Win% over its window, clamped to
  0.5…12, so moves in volatile phases count more
- game accuracy = (volatility-weighted mean + harmonic mean) / 2. The
  harmonic mean makes a single disaster hurt.

**Chess.com** uses *CAPS2*. The help article says only that it measures how
close you came to the engine's best play, and that most scores land between
about 50 and 95. The formula is proprietary, so Hindsight shows Lichess-style
accuracy and doesn't claim to reproduce Chess.com's numbers.

## 4. Phases, game rating, tactics vs strategy

**Phases** (`src/analysis/phases.ts`) port scalachess's `Divider.scala`, which
Lichess uses for its per-phase accuracy. The middlegame starts at the first
position where any of these holds:
- 10 or fewer major and minor pieces are left,
- either back rank holds fewer than 4 of its own pieces,
- the "mixedness" score passes 150. It is summed over every 2×2 region and
  rises when both colours' pieces share regions deep in enemy territory.

The endgame starts at 6 or fewer major and minor pieces. Hindsight adds one rule:
the opening ends by move 20 at the latest. Run against 75 real Lichess games,
the port reproduced the boundaries Lichess reports (`division=true` on the
games API) in all 75. Phase accuracy is the normal accuracy formula run over
that phase's moves only.

**Game rating** (`estimateRating` in `src/analysis/insights.ts`) is the rating
at which a given game accuracy is typical. To calibrate it, we sampled about
4,000 analysed Lichess blitz, rapid and classical games, spread evenly across
rating bands from 400 to 3000. For each band we took the median game
accuracy, made the curve monotonic and inverted it. Lichess accuracy uses the
same formula as ours, so the scales line up. A single game is a small sample:
at any given accuracy, the middle half of players spans about 800 rating
points. So when the PGN includes the player's rating (as imported games always
do), the estimate is pulled halfway towards it. Chess.com's "Game Rating" is
proprietary, so this is our own model.

| Median accuracy | 63 | 70 | 73 | 78 | 80 | 82 | 84 | 86 | 89 | 92 |
|---|---|---|---|---|---|---|---|---|---|---|
| Rating | 550 | 750 | 1000 | 1450 | 1700 | 1900 | 2100 | 2550 | 2800 | 2950 |

**Tactics vs strategy** (`styleScores`) splits each player's non-book moves
into two groups:
- *Tactical* positions are those where the best move beats the second-best by
  at least 10 expected points, or where the opponent's previous move was a
  mistake, blunder or miss.
- *Quiet* positions are those where the game was still undecided (15–85%
  expected points) and the position wasn't tactical.

Each score is the mean move accuracy in its group. It's shown only when there
are enough such moves (3 tactical, 5 quiet). The verdict line compares the
two scores.

## 5. Known differences from Chess.com
- Expected points are not rating-aware: Hindsight uses the Lichess curve for all
  ratings.
- Brilliant/Great thresholds are our own reading of Chess.com's prose rules.
- Accuracy is the Lichess formula, not CAPS2.
- Game rating is our own calibration (above), not Chess.com's.
- Analysis uses Stockfish 17.1 *lite*, single-threaded in the browser, at a
  depth you choose. Deeper searches give more stable labels.
