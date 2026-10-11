# Craps Game

Casino-accurate craps for practicing strategies. Static site for GitHub Pages.

## Stack
Plain HTML/CSS/JS with ES modules. No frameworks, CDNs, build step or dependencies. Tests use Node's built-in runner.

## Commands
- Run: `npm start` (or `python3 -m http.server 8080`), then open http://localhost:8080. Modules don't load from file://.
- Test: `npm test` (scripted-dice tests plus exact house-edge proofs, ~5s)
- Dev aid: add `?dev` to the URL for a "force next roll" control.
- Deploy: GitHub Pages serves `main` / (root) at https://maxhousner.github.io/craps-game/. Pushing `main` deploys.

## Key folders
- `js/engine/`: pure game logic, no DOM. Shared by the game, tests and the simulator.
  - `rules.js`: house-rule defaults, payout ratios, odds limits, vig, rounding
  - `bets.js`: one entry per bet type (`canPlace`, `removable`, `defaultWorking`, `hitWin`, `resolve`)
  - `table.js`: `CrapsTable`: bankroll, puck, shooter, `placeBet`/`removeBet`/`placeOdds`/`takeDownAll`/`roll`, `issues()`/`fix()`
  - `dice.js`: crypto dice for play; seeded dice for tests and simulations
- `js/ui/`: felt and center-action layout (`table-view.js`), controls/My Bets/spot menu (`controls.js`), `settings.js` (also `SAVE_KEY` and `savedRules()` for the other pages), `stats.js`, `to-top.js`
- `js/main.js`: wires UI ↔ engine, undo snapshots, save/load (`localStorage` key `craps-game:v1`)
- `css/styles.css` is shared by all three pages (tokens on `:root`, breakpoints 959/500/380px); `sim.css`/`help.css` add page rules. All pages share one header: logo + `nav.top-links` (Table · Simulator · Guide, `aria-current` on the current page). Update all three when adding a page.
- Game layout (≥960px): status bar (dice, meters, Autoplay) on top; felt + collapsible center-action strip (`.center`, 12-column grid) in the main column; Session stats + My Bets in the side column. Phones use sheets for Center Props and My Bets.
- `help.html` + `js/help.js` + `css/help.css`: the guide page. The table map and each bet card's mini map reuse `buildFelt`/`buildProps` (mini maps are clones with that bet's spots lit).
- `js/help-content.js`: the one source for bet write-ups (`TOPICS`, `topicFor(key)`). Feeds both the guide and the in-game "What's this?" in the spot menu. Update it whenever rules or payouts change. Facts render in `FACT_ORDER`.
- `js/sim/`: strategy simulator
  - `strategy.js`: strategy data format (see header comment), `createRunner` (places a strategy's bets before each roll, tracks presses), `validateStrategy`, `describePlan`
  - `presets.js`: popular strategies; `library.js`: saved strategies (`localStorage` key `craps-game:strategies`)
  - `simulate.js`: `runSession` (seeded dice; session i uses `sessionSeed(seed, i)` so every strategy sees the same rolls), `summarize`, `bands`, `newResultArrays`
  - `worker.js`: Web Worker; `sim-page.js` splits sessions across several workers and merges the results
  - `editor.js`: strategy builder dialog
- `simulate.html` + `js/sim-page.js` + `css/sim.css`: simulator page. Charts in `js/ui/charts.js` (SVG, validated palette in `sim-page.js`)
- `js/ui/autoplay.js` + autoplay loop in `main.js`: runs a strategy on the real table
- `tests/`: `node --test` suites

## Rules that are easy to break
- A bet's `resolve()` pays through its own `hitWin()` where they match, so My Bets' "wins $X" can't drift from the real payout (Come is the exception: its odds may be off).
- Money is whole dollars. Payouts use `pay()` (rounds down). Proper units are enforced unless `allowImproper` is set.
- Bet keys are strings: `pass`, `come:6`, `place:8`, `hop:1-4`, `hornHigh:11`, etc. `parseKey()` validates them.
- `exactEV` in `tests/house-edge.test.js` checks every bet against published house edges. Run it after any payout change.
- Strategy names are user-entered: escape them with `esc()` (`js/ui/html.js`) in HTML, and use `textContent` in chart tooltips.
- The simulator is CPU-heavy: keep `roll()`, `problems()` and the runner's `decide()` allocation-light (benchmark: ~2 µs per roll).
- Fonts are system stacks only (no web fonts/CDNs). `--font-table` must have lining (even-height) numerals; Georgia's old-style ones looked uneven.
- Check UI changes in a browser with the Playwright plugin at desktop and ~390px. Its output goes to `.playwright-mcp/` (gitignored); delete it when done. After editing CSS/JS, refetch with `fetch(url, {cache: 'reload'})` or hard-refresh, or the browser serves stale files.
