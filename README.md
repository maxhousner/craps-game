# Craps

A casino-accurate craps game that runs in the browser on desktop and phone. It's built for practicing and studying craps strategies.

- **Every bet:** Pass/Don't Pass, Come/Don't Come, odds (taking and laying), place, buy, lay, put, field, Big 6/8, hardways, every one-roll prop (horn, horn high, world, C&E, hop bets), Fire Bet and All/Tall/Small.
- **Exact casino payouts.** Vegas defaults (3-4-5x odds, field 12 pays triple, 5% vig on wins), adjustable in Settings to match your casino.
- **Proper units enforced** the way a dealer would ($6 on the 6/8). An optional setting allows any amount and rounds payouts down like a real table.
- **Fair dice** from the browser's cryptographic random number generator.
- Session stats, roll history and saved progress.

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
