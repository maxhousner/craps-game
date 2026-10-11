# Craps Game

Casino-accurate craps for practicing strategies. Static site for GitHub Pages.

## Stack
Plain HTML/CSS/JS with ES modules. No frameworks, CDNs, build step or dependencies. Tests use Node's built-in runner.

## Commands
- Run: `npm start` (or `python3 -m http.server 8080`), then open http://localhost:8080. Modules don't load from file://.
- Test: `npm test` (scripted-dice tests plus exact house-edge proofs, ~5s)
- Dev aid: add `?dev` to the URL for a "force next roll" control.

## Key folders
- `js/engine/`: pure game logic, no DOM. Shared by the game, tests and the future simulator.
  - `rules.js`: house-rule defaults, payout ratios, odds limits, vig, rounding
  - `bets.js`: one entry per bet type (`canPlace`, `removable`, `defaultWorking`, `resolve`)
  - `table.js`: `CrapsTable`: bankroll, puck, shooter, `placeBet`/`removeBet`/`placeOdds`/`roll`, `issues()`/`fix()`
  - `dice.js`: crypto dice for play; seeded dice for tests and simulations
- `js/ui/`: felt layout and rendering (`table-view.js`), controls/My Bets/spot menu (`controls.js`), `settings.js`, `stats.js`
- `js/main.js`: wires UI ↔ engine, undo snapshots, save/load (`localStorage` key `craps-game:v1`)
- `help.html` + `js/help.js` + `css/help.css`: the guide page. The table map reuses `buildFelt`/`buildProps`.
- `js/help-content.js`: the one source for bet write-ups (`TOPICS`, `topicFor(key)`). Feeds both the guide and the in-game "What's this?" in the spot menu. Update it whenever rules or payouts change.
- `js/sim/`: strategy simulator (phase 3)
  - `strategy.js`: strategy data format (see header comment), `createRunner` (places a strategy's bets before each roll, tracks presses), `validateStrategy`, `describePlan`
  - `presets.js`: popular strategies; `library.js`: saved strategies (`localStorage` key `craps-game:strategies`)
  - `simulate.js`: `runSession` (seeded dice; session i uses `sessionSeed(seed, i)` so every strategy sees the same rolls), `summarize`, `bands`
  - `worker.js`: Web Worker; `sim-page.js` splits sessions across several workers and merges the results
  - `editor.js`: strategy builder dialog
- `simulate.html` + `js/sim-page.js` + `css/sim.css`: simulator page. Charts in `js/ui/charts.js` (SVG, validated palette in `sim-page.js`)
- `js/ui/autoplay.js` + autoplay loop in `main.js`: runs a strategy on the real table
- `tests/`: `node --test` suites

## Rules that are easy to break
- Money is whole dollars. Payouts use `pay()` (rounds down). Proper units are enforced unless `allowImproper` is set.
- Bet keys are strings: `pass`, `come:6`, `place:8`, `hop:1-4`, `hornHigh:11`, etc. `parseKey()` validates them.
- `exactEV` in `tests/house-edge.test.js` checks every bet against published house edges. Run it after any payout change.
- Strategy names are user-entered: escape them with `esc()` (`js/ui/html.js`) in HTML, and use `textContent` in chart tooltips.
- The simulator is CPU-heavy: keep `roll()`, `problems()` and the runner's `decide()` allocation-light (benchmark: ~2 µs per roll).
- Build order was base game → help docs → simulator, each with the user's sign-off.
