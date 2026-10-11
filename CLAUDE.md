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
- `tests/`: `node --test` suites

## Rules that are easy to break
- Money is whole dollars. Payouts use `pay()` (rounds down). Proper units are enforced unless `allowImproper` is set.
- Bet keys are strings: `pass`, `come:6`, `place:8`, `hop:1-4`, `hornHigh:11`, etc. `parseKey()` validates them.
- `exactEV` in `tests/house-edge.test.js` checks every bet against published house edges. Run it after any payout change.
- Build order is base game → help docs → simulator. Each needs the user's sign-off first.
