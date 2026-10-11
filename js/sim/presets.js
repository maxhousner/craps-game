// Ready-made strategies. Amounts assume a $5 table; the runner raises them to the
// table minimum and rounds to proper units when the house rules call for it.

export const PRESETS = [
  {
    id: 'pass-odds',
    name: 'Pass Line + max odds',
    notes: 'The classic low-edge play: a line bet backed by as much free odds as the table allows.',
    plans: [{ bet: 'pass', amount: 10, odds: 'max' }],
  },
  {
    id: 'dont-lay',
    name: 'Don\'t Pass + max lay odds',
    notes: 'The dark-side version of the classic. Wins more often, wins less when it does.',
    plans: [{ bet: 'dontPass', amount: 10, odds: 'max' }],
  },
  {
    id: 'molly',
    name: '3-Point Molly',
    notes: 'Pass Line plus up to two Come bets, all with odds, so three numbers are working.',
    plans: [
      { bet: 'pass', amount: 10, odds: 'max' },
      { bet: 'come', amount: 10, count: 2, odds: 'max', oddsOnComeOut: false },
    ],
  },
  {
    id: 'dark-molly',
    name: 'Dark-side Molly',
    notes: 'Don\'t Pass plus up to two Don\'t Come bets, all with lay odds.',
    plans: [
      { bet: 'dontPass', amount: 10, odds: 'max' },
      { bet: 'dontCome', amount: 10, count: 2, odds: 'max' },
    ],
  },
  {
    id: 'place-68',
    name: 'Place 6 & 8',
    notes: 'The two best place bets, collecting every win.',
    plans: [{ bet: 'place', numbers: [6, 8], amount: 12, when: 'point' }],
  },
  {
    id: 'place-68-press',
    name: 'Place 6 & 8, press every other hit',
    notes: 'Collect the first win, press the second, and so on, up to $96 a number.',
    plans: [{ bet: 'place', numbers: [6, 8], amount: 12, when: 'point', progression: { onWin: 'press', every: 2, onLoss: 'reset', max: 96 } }],
  },
  {
    id: 'regression',
    name: 'Regression: $24 on 6 & 8, then $12',
    notes: 'Start big, then cut the bets in half after the first hit to lock in a profit.',
    plans: [{ bet: 'place', numbers: [6, 8], amount: 24, when: 'point', progression: { onWin: 'regress', regressTo: 12, onLoss: 'reset' } }],
  },
  {
    id: 'inside',
    name: '$22 Inside',
    notes: 'Place the 5, 6, 8 and 9 ($5 / $6 / $6 / $5) after the point.',
    plans: [{ bet: 'place', numbers: [5, 6, 8, 9], amount: 5, when: 'point' }],
  },
  {
    id: 'across',
    name: '$32 Across',
    notes: 'Place all six numbers after the point.',
    plans: [{ bet: 'place', numbers: [4, 5, 6, 8, 9, 10], amount: 5, when: 'point' }],
  },
  {
    id: 'pass-across',
    name: 'Pass Line + place the other numbers',
    notes: 'Pass Line with odds covers the point; place bets cover every other number.',
    plans: [
      { bet: 'pass', amount: 10, odds: 'max' },
      { bet: 'place', numbers: [4, 5, 6, 8, 9, 10], amount: 5, when: 'point', skipPoint: true },
    ],
  },
  {
    id: 'iron-cross',
    name: 'Iron Cross',
    notes: 'Field plus Place 5, 6 and 8: every number but the 7 wins something.',
    plans: [
      { bet: 'field', amount: 5, when: 'point' },
      { bet: 'place', numbers: [5, 6, 8], amount: 5, when: 'point' },
    ],
  },
  {
    id: 'pass-buy-4-10',
    name: 'Pass Line + buy the 4 & 10',
    notes: 'Buying the outside numbers at $25 costs only $1 vig each.',
    plans: [
      { bet: 'pass', amount: 10, odds: 'max' },
      { bet: 'buy', numbers: [4, 10], amount: 25, when: 'point', skipPoint: true },
    ],
  },
  {
    id: 'place-hard-68',
    name: 'Place 6 & 8 + hard 6 & 8',
    notes: 'Place bets with hardway "kickers" on the same numbers.',
    plans: [
      { bet: 'place', numbers: [6, 8], amount: 12, when: 'point' },
      { bet: 'hard', numbers: [6, 8], amount: 2, when: 'point' },
    ],
  },
  {
    id: 'pass-martingale',
    name: 'Pass Line Martingale',
    notes: 'Double the bet after every loss, back to $10 after a win. Starts over if the next double would pass $640.',
    plans: [{ bet: 'pass', amount: 10, odds: 'none', progression: { onWin: 'reset', onLoss: 'double', max: 640 } }],
  },
  {
    id: 'field-martingale',
    name: 'Field Martingale',
    notes: 'Bet the field every roll, doubling after each loss.',
    plans: [{ bet: 'field', amount: 5, when: 'always', progression: { onWin: 'reset', onLoss: 'double', max: 640 } }],
  },
  {
    id: 'pass-paroli',
    name: 'Pass Line Paroli',
    notes: 'Double after each win, up to three wins in a row, then start over.',
    plans: [{ bet: 'pass', amount: 10, odds: 'none', progression: { onWin: 'press', resetAfter: 3, onLoss: 'reset' } }],
  },
  {
    id: 'doey-dont',
    name: 'Doey-Don\'t',
    notes: 'Pass and Don\'t Pass together with odds on the pass side. The two line bets cancel out except on a come-out 12.',
    plans: [
      { bet: 'pass', amount: 10, odds: 'max' },
      { bet: 'dontPass', amount: 10, odds: 'none' },
    ],
  },
  {
    id: 'craps-hedge',
    name: 'Pass Line + Any Craps hedge',
    notes: 'A $3 Any Craps bet on each come-out cushions a $25 Pass Line bet against craps.',
    plans: [
      { bet: 'pass', amount: 25, odds: 'max' },
      { bet: 'anyCraps', amount: 3, when: 'comeOut' },
    ],
  },
];
