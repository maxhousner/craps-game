# Craps

A casino-accurate craps game that runs in the browser on desktop and phone. It's built for practicing and studying craps strategies.

- **Every bet:** Pass/Don't Pass, Come/Don't Come, odds (taking and laying), place, buy, lay, put, field, Big 6/8, hardways, every one-roll prop (horn, horn high, world, C&E, hop bets), Fire Bet and All/Tall/Small.
- **Exact casino payouts.** Vegas defaults (3-4-5x odds, field 12 pays triple, 5% vig on wins), adjustable in Settings to match your casino.
- **Proper units enforced** the way a dealer would ($6 on the 6/8). An optional setting allows any amount and rounds payouts down like a real table.
- **Fair dice** from the browser's cryptographic random number generator.
- Session stats, roll history and saved progress.
- **Strategy simulator** (`simulate.html`): run up to 4 strategies through thousands of sessions on the same dice. You get average result, spread of outcomes, chance to finish ahead, house edge paid, worst drop, bust rate, charts, roll-by-roll replays and CSV export. It comes with 18 popular strategies, plus a builder with presses, regressions, ladders, Martingale and Paroli.
- **Autoplay**: watch any strategy bet and roll on the real table at the speed you choose.
- **Built-in guide** (`help.html`): how craps works, a clickable table map, every bet in plain English, working/off rules, proper units, a house-edge comparison and a glossary. Long-press any spot in the game and tap *What's this?* for the short version.

## Play locally

```sh
npm start        # or: python3 -m http.server 8080
```

Then open http://localhost:8080.

## Tests

```sh
npm test
```

Besides scripted-dice tests for every bet, the suite computes each bet's exact house edge by running the game engine over every possible dice outcome. It then checks the result against published figures (Pass 1.41%, Don't Pass 1.36%, Place 6 1.52%, Field 2.78%, Fire Bet 20.76%, and so on).
