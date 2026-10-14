// Plain-English help for every bet. Used by help.html and the in-game "What's this?" option.
// Figures are for the Vegas defaults; every house edge here is checked in tests/house-edge.test.js.

export const SECTIONS = [
  {
    id: 'line-bets',
    title: 'Line bets and odds',
    intro: 'These are the core of craps. They follow the shooter through the come-out roll and the point. Together with odds they\'re the lowest-edge bets in the casino.',
  },
  {
    id: 'number-bets',
    title: 'Number bets',
    intro: 'Bets on whether a particular number (4, 5, 6, 8, 9 or 10) rolls before a 7. You choose the number yourself, so there\'s no waiting for a come-out.',
  },
  {
    id: 'center-bets',
    title: 'Field and center action',
    intro: 'Most of these are one-roll bets, decided by the very next roll. They pay big, but they carry the highest house edges on the table.',
  },
  {
    id: 'side-bets',
    title: 'Side bets',
    intro: 'Optional long-shot bets that track a whole series of rolls. They aren\'t on every casino table.',
  },
];

export const TOPICS = [
  // ---------- Line bets ----------
  {
    id: 'pass',
    section: 'line-bets',
    title: 'Pass Line',
    summary: 'The basic bet in craps. You\'re betting <em>with</em> the shooter: that they roll a 7 or 11 on the come-out, or set a point and roll it again before a 7.',
    facts: [
      ['When you can bet', 'Any time, but it belongs on the come-out roll (puck OFF). Betting it after a point is set makes it a <a href="#put">put bet</a>, which skips the come-out\'s advantage.'],
      ['Wins', 'Come-out 7 or 11 (8 of 36 rolls). After a point is set, the point rolling again before a 7.'],
      ['Loses', 'Come-out 2, 3 or 12, called "craps" (4 of 36 rolls). After a point is set, a 7 ("seven out").'],
      ['Pays', '1 to 1 (even money).'],
      ['House edge', '1.41%'],
      ['Can it come down?', 'Not once a point is set. It\'s a <a href="#working">contract bet</a>: you can add to it, but once the dice roll it can\'t go below what was on it. Chips you add can come back off until the next roll. Adding <a href="#odds">odds</a> is the better way to add. Before the point, yes.'],
    ],
    tip: 'Add <a href="#odds">odds</a> as soon as a point is set. Odds have no house edge, so with full 3-4-5x odds your overall edge drops from 1.41% to about 0.37%.',
  },
  {
    id: 'dont-pass',
    section: 'line-bets',
    title: 'Don\'t Pass',
    summary: 'The opposite of the Pass Line. You\'re betting <em>against</em> the shooter, which players call the "dark side".',
    facts: [
      ['When you can bet', 'Only on the come-out roll.'],
      ['Wins', 'Come-out 2 or 3. After a point is set, a 7 before the point.'],
      ['Loses', 'Come-out 7 or 11. After a point is set, the point rolling again.'],
      ['Pushes', 'A come-out 12 is a tie ("bar 12"): nothing is won or lost. Some casinos bar the 2 instead (see Settings). The bar is where the house gets its edge.'],
      ['Pays', '1 to 1.'],
      ['House edge', '1.36%'],
      ['Can it come down?', 'Yes, any time, but you can\'t put it back once a point is set. After the point, your bet is the favorite (on a 4 or 10 you win 2 times out of 3), so taking it down only helps the house.'],
    ],
    tip: 'Lay odds behind it. At a 3-4-5x table you can lay 6x your bet on every point, which brings the combined edge down to about 0.27%.',
  },
  {
    id: 'come',
    section: 'line-bets',
    title: 'Come',
    summary: 'A Pass Line bet that starts in the middle of a round. The roll after you make it acts as its own come-out.',
    facts: [
      ['When you can bet', 'Only after a point is set (puck ON).'],
      ['Wins', 'Next roll 7 or 11. Any of 4, 5, 6, 8, 9 or 10 instead moves ("travels") the bet to that number, and it then wins if that number rolls again before a 7.'],
      ['Loses', 'Next roll 2, 3 or 12. After it moves, a 7.'],
      ['Pays', '1 to 1, plus true odds on any odds you add.'],
      ['House edge', '1.41%'],
      ['On the come-out', 'The come bet itself always works. <strong>Odds on come bets are OFF during a come-out roll</strong> unless you turn them on. If a 7 rolls then, you lose the come bet but get the odds back.'],
      ['Can it come down?', 'Not once it\'s on a number (contract bet). Its odds can come down any time.'],
    ],
    tip: 'To add odds, tap a come bet\'s chip inside its number box. A popular strategy, the "3-Point Molly", is a Pass Line bet plus two come bets, all with odds.',
  },
  {
    id: 'dont-come',
    section: 'line-bets',
    title: 'Don\'t Come',
    summary: 'A Don\'t Pass bet that starts in the middle of a round.',
    facts: [
      ['When you can bet', 'Only after a point is set.'],
      ['Wins', 'Next roll 2 or 3. Any of 4, 5, 6, 8, 9 or 10 instead moves the bet behind that number, and it then wins if a 7 rolls before that number.'],
      ['Loses', 'Next roll 7 or 11. After it moves, that number rolling again.'],
      ['Pushes', 'A 12 on its first roll (bar 12).'],
      ['Pays', '1 to 1, plus true odds on any lay odds.'],
      ['House edge', '1.36%'],
      ['On the come-out', 'Don\'t come bets and their lay odds work on every roll.'],
      ['Can it come down?', 'Yes, any time, but it can\'t be put back.'],
    ],
    tip: 'To lay odds, tap the don\'t come chip in the top strip of its number box.',
  },
  {
    id: 'odds',
    section: 'line-bets',
    title: 'Odds (taking and laying)',
    summary: 'The only bet in the casino with <strong>no house edge</strong>. Once a line bet has a point, you can add odds behind it, and the odds pay exactly what the risk is worth.',
    facts: [
      ['When you can bet', 'Behind a Pass Line or Don\'t Pass bet once a point is set, or behind a come / don\'t come bet once it has moved to a number. Use the ODDS strips next to the line bets, or tap a come chip.'],
      ['Taking odds (pass / come)', '4 or 10 pays 2 to 1 · 5 or 9 pays 3 to 2 · 6 or 8 pays 6 to 5.'],
      ['Laying odds (don\'t side)', '4 or 10 pays 1 to 2 · 5 or 9 pays 2 to 3 · 6 or 8 pays 5 to 6. You risk more than you win because the 7 is more likely than the point.'],
      ['Limits (3-4-5x)', 'Up to 3x your line bet on the 4/10, 4x on the 5/9 and 5x on the 6/8. Each one pays exactly 6x your line bet when it wins. On the don\'t side you can lay 6x on every number.'],
      ['Proper units', 'Taking: any amount on the 4/10, even amounts on the 5/9, $5 units on the 6/8. Laying: $2 units on the 4/10, $3 on the 5/9, $6 on the 6/8.'],
      ['House edge', '0%'],
      ['Can it come down?', 'Yes, any time.'],
    ],
    tip: 'Because odds have no edge, many players bet the table minimum on the line and put the rest of their money into odds.',
  },
  {
    id: 'put',
    section: 'line-bets',
    title: 'Put bet',
    summary: 'A Pass Line or Come bet placed straight onto a number, skipping its come-out roll. You can add odds right away.',
    facts: [
      ['When you can bet', 'After a point is set. A Pass Line bet made while the puck is ON is a put bet on the point. To put any number, long-press its box and choose "Put".'],
      ['Wins', 'The number before a 7.'],
      ['Loses', 'A 7.'],
      ['Pays', '1 to 1, plus true odds on the odds.'],
      ['House edge', 'High on its own, because you give up the come-out\'s 7/11 wins: 9.09% on the 6/8, 20% on the 5/9, 33.3% on the 4/10. Odds dilute it. With full 3-4-5x odds a put on the 5, 6, 8 or 9 has the same edge as placing that number.'],
      ['Can it come down?', 'No (contract bet). Its odds can.'],
    ],
    tip: 'Put bets only beat place bets at tables that allow more than 3-4-5x odds.',
  },

  // ---------- Number bets ----------
  {
    id: 'place',
    section: 'number-bets',
    title: 'Place bets',
    summary: 'A bet that one number (4, 5, 6, 8, 9 or 10) rolls before a 7. It stays up after winning, so it can keep paying.',
    facts: [
      ['When you can bet', 'Any time. Tap the middle of a number box.'],
      ['Wins', 'Your number before a 7. You\'re paid and the bet stays up.'],
      ['Loses', 'A 7.'],
      ['Pays', '4 or 10: 9 to 5 · 5 or 9: 7 to 5 · 6 or 8: 7 to 6.'],
      ['House edge', '6 or 8: 1.52% · 5 or 9: 4.00% · 4 or 10: 6.67%.'],
      ['Proper units', '$5 units on the 4, 5, 9 and 10; $6 units on the 6 and 8. A $5 Place 6 would pay $5.83, so it isn\'t allowed unless you turn on non-proper bets.'],
      ['On the come-out', 'OFF by default. Turn them on in My Bets or the long-press menu.'],
      ['Can it come down?', 'Yes, any time, or turn it off.'],
    ],
    tip: 'The 6 and 8 are some of the best bets that aren\'t line bets. Don\'t place the 4 or 10: buying them costs much less. Common combos are "$22 inside" ($5 on the 5 and 9, $6 on the 6 and 8) and "$32 across" (all six numbers).',
  },
  {
    id: 'buy',
    section: 'number-bets',
    title: 'Buy bets',
    summary: 'Like a place bet, but it pays true odds in exchange for a 5% commission called the vig.',
    facts: [
      ['When you can bet', 'Any time. Tap the BUY strip at the bottom of a number box. A number can be placed or bought, not both.'],
      ['Wins / loses', 'Same as a place bet: your number before a 7 wins and stays up; a 7 loses.'],
      ['Pays', '4 or 10: 2 to 1 · 5 or 9: 3 to 2 · 6 or 8: 6 to 5, minus the vig.'],
      ['Vig', '5% of the bet, rounded down, minimum $1. By default it\'s charged only when the bet wins; some casinos charge it up front (see Settings).'],
      ['House edge', 'Vig on wins: 4/10 1.67% · 5/9 2.00% · 6/8 2.27%. Vig up front: 4.76% on any number.'],
      ['On the come-out', 'OFF by default, like place bets.'],
      ['Can it come down?', 'Yes, any time. Up-front vig is refunded.'],
    ],
    tip: 'Buy the 4 and 10 instead of placing them (1.67% vs 6.67%). Because the vig rounds down, a $25 or $35 buy still costs just $1. When vig is charged only on wins, buying the 5 and 9 at $20 or more (2.00%) also beats placing them (4.00%). Keep placing the 6 and 8.',
  },
  {
    id: 'lay',
    section: 'number-bets',
    title: 'Lay bets',
    summary: 'A bet that a 7 rolls before a particular number. It\'s the don\'t-side version of a buy bet.',
    facts: [
      ['When you can bet', 'Any time. Tap the LAY strip at the top of a number box.'],
      ['Wins', 'A 7 before your number. The bet stays up after winning.'],
      ['Loses', 'Your number.'],
      ['Pays', '4 or 10: 1 to 2 · 5 or 9: 2 to 3 · 6 or 8: 5 to 6, minus 5% of the win.'],
      ['Proper units', '$2 on the 4/10, $3 on the 5/9, $6 on the 6/8. A $40 lay on the 4 wins $20 and pays $1 vig.'],
      ['House edge', 'Vig on wins: 4/10 1.67% · 5/9 2.00% · 6/8 2.27%. Vig up front: 2.44% · 3.23% · 4.00%.'],
      ['On the come-out', 'Working on every roll.'],
      ['Can it come down?', 'Yes, any time.'],
    ],
    tip: 'Don\'t-side players lay the 4 and 10 because those are the hardest numbers to roll.',
  },
  {
    id: 'big',
    section: 'number-bets',
    title: 'Big 6 and Big 8',
    summary: 'A bet that a 6 (or 8) rolls before a 7, paid at even money.',
    facts: [
      ['When you can bet', 'Any time, where it\'s offered. Many layouts no longer have it; Settings can take it off this table.'],
      ['Wins', 'A 6 (or 8) before a 7.'],
      ['Loses', 'A 7.'],
      ['Pays', '1 to 1.'],
      ['House edge', '9.09%'],
      ['On the come-out', 'Working on every roll.'],
    ],
    tip: 'This wins on exactly the same rolls as a Place 6 or 8, which pays 7 to 6 with a 1.52% edge. Always place the number instead. Atlantic City banned the Big 6/8 for this reason.',
  },

  // ---------- Field and center ----------
  {
    id: 'field',
    section: 'center-bets',
    title: 'Field',
    summary: 'A one-roll bet that the next roll is 2, 3, 4, 9, 10, 11 or 12.',
    facts: [
      ['Wins', '3, 4, 9, 10 and 11 pay 1 to 1. The 2 pays 2 to 1 and the 12 pays 3 to 1 (only 2 to 1 at some casinos; see Settings).'],
      ['Loses', '5, 6, 7 or 8.'],
      ['House edge', '2.78% when 12 pays 3 to 1 · 5.56% when 12 pays 2 to 1.'],
    ],
    tip: 'It looks like more numbers win (7 of 11), but 5, 6, 7 and 8 come up 20 out of 36 rolls. A winning field bet stays on the table and plays again unless you take it down.',
  },
  {
    id: 'hardways',
    section: 'center-bets',
    title: 'Hardways',
    summary: 'A bet that a 4, 6, 8 or 10 rolls as a pair ("the hard way") before it rolls any other way ("easy") or a 7.',
    facts: [
      ['Example', 'Hard 6 wins on 3-3. It loses on 1-5, 2-4 or any 7.'],
      ['Pays', 'Hard 4 or 10: 7 to 1 · Hard 6 or 8: 9 to 1.'],
      ['House edge', 'Hard 6 or 8: 9.09% · Hard 4 or 10: 11.11%.'],
      ['On the come-out', 'OFF by default.'],
      ['Can it come down?', 'Yes, any time. A winning hardway stays up.'],
    ],
  },
  {
    id: 'any-seven',
    section: 'center-bets',
    title: 'Any Seven',
    summary: 'A one-roll bet that the next roll is a 7.',
    facts: [
      ['Pays', '4 to 1. Some layouts print this as "5 for 1", which is the same thing.'],
      ['House edge', '16.67%, the worst bet on the table.'],
    ],
  },
  {
    id: 'any-craps',
    section: 'center-bets',
    title: 'Any Craps',
    summary: 'A one-roll bet that the next roll is 2, 3 or 12.',
    facts: [
      ['Pays', '7 to 1 ("8 for 1").'],
      ['House edge', '11.11%'],
    ],
    tip: 'Some players use it on the come-out to protect a large Pass Line bet against craps.',
  },
  {
    id: 'prop-numbers',
    section: 'center-bets',
    title: 'Aces, Ace-Deuce, Yo, Boxcars',
    summary: 'One-roll bets on a single total: Aces (2), Ace-Deuce (3), Yo (11) or Boxcars (12).',
    facts: [
      ['Pays', '2 or 12: 30 to 1 (one way to roll each) · 3 or 11: 15 to 1 (two ways each).'],
      ['House edge', '2 or 12: 13.89% · 3 or 11: 11.11%. On "for 1" layouts (30 for 1, 15 for 1) both are 16.67%.'],
      ['"To 1" vs "for 1"', '"30 for 1" includes your own dollar in the payout, so it\'s really 29 to 1. You can pick either in Settings.'],
    ],
    tip: 'The 11 is called "yo" or "yo-leven" so it isn\'t misheard as "seven".',
  },
  {
    id: 'horn',
    section: 'center-bets',
    title: 'Horn',
    summary: 'Four one-roll bets in one: equal units on the 2, 3, 11 and 12. Always bet in multiples of 4.',
    facts: [
      ['Wins', 'The number that rolls pays its normal rate, and the other three units lose. A $4 horn when a 3 rolls: +$15 − $3 = +$12. On a 2 or 12: +$30 − $3 = +$27.'],
      ['Loses', 'Anything else.'],
      ['House edge', '12.5%'],
    ],
  },
  {
    id: 'horn-high',
    section: 'center-bets',
    title: 'Horn High',
    summary: 'A horn bet with one extra unit on the number you choose (5 units total). A "$5 horn high yo" is $1 each on the 2, 3 and 12 and $2 on the 11.',
    facts: [
      ['Wins / loses', 'Like a horn bet, but the high number pays on two units.'],
      ['House edge', 'High 3 or 11: 12.22% · High 2 or 12: 12.78%.'],
    ],
  },
  {
    id: 'world',
    section: 'center-bets',
    title: 'World (Whirl)',
    summary: 'A horn bet plus Any Seven: 5 equal units on the 2, 3, 7, 11 and 12. Bet in multiples of 5.',
    facts: [
      ['Wins', '2, 3, 11 or 12 pay that number\'s rate, minus the other four units.'],
      ['Pushes', 'A 7. The seven unit wins 4 to 1, which exactly covers the other four.'],
      ['House edge', '13.33%'],
    ],
  },
  {
    id: 'ce',
    section: 'center-bets',
    title: 'C & E (Craps and Eleven)',
    summary: 'Half on Any Craps, half on the 11, for one roll. Bet in multiples of 2.',
    facts: [
      ['Wins', '2, 3 or 12 nets 3 to 1 on the whole bet. 11 nets 7 to 1.'],
      ['Loses', 'Anything else.'],
      ['House edge', '11.11%'],
    ],
  },
  {
    id: 'hop',
    section: 'center-bets',
    title: 'Hop bets',
    summary: 'A one-roll bet on an exact pair of dice, like 2-4 or 5-5. Called "hopping" a number.',
    facts: [
      ['Pays', 'Easy hops (two different dice, 2 ways to roll) pay 15 to 1. Hard hops (a pair, 1 way) pay 30 to 1.'],
      ['House edge', 'Easy 11.11% · hard 13.89%.'],
      ['Example', 'Hop 1-4 wins on 1-4 or 4-1, but not on 2-3, which is also a 5.'],
    ],
    tip: 'Open "Hop bets" in the center action strip to see all 21 combinations.',
  },

  // ---------- Side bets ----------
  {
    id: 'fire',
    section: 'side-bets',
    title: 'Fire Bet',
    summary: 'A $1–$5 side bet that the shooter makes several <em>different</em> points before sevening out.',
    facts: [
      ['When you can bet', 'Only before a new shooter\'s first roll. Not every casino offers it; Settings can take it off this table.'],
      ['Pays', 'When the shooter sevens out: 4 different points 24 to 1, 5 points 249 to 1. All 6 points pays 999 to 1 the moment the sixth is made.'],
      ['Loses', 'Fewer than 4 different points. Making the same point twice only counts once.'],
      ['Chances', '4 points: about 1 in 114 · 5 points: 1 in 610 · all 6: 1 in 6,156.'],
      ['House edge', '20.76%'],
      ['Can it come down?', 'Not once the shooter has rolled.'],
    ],
    tip: 'The lit numbers in the Fire Bet box show which points this shooter has made.',
  },
  {
    id: 'ats',
    section: 'side-bets',
    title: 'All / Tall / Small',
    summary: 'Side bets that every number in a group rolls before a 7, in any order.',
    facts: [
      ['Small', '2, 3, 4, 5 and 6 → pays 34 to 1 (about 1 in 38).'],
      ['Tall', '8, 9, 10, 11 and 12 → pays 34 to 1 (about 1 in 38).'],
      ['All', 'All ten (2–6 and 8–12) → pays 175 to 1 (about 1 in 190).'],
      ['When you can bet', 'Only after a 7 (or at the start), before any other number rolls. Not every casino offers these; Settings can take them off this table.'],
      ['Loses', 'Any 7, including a come-out 7.'],
      ['House edge', 'Small or Tall 7.76% · All 7.46%. With the 30/30/150 pay table: 18.30% and 20.61%.'],
      ['Can it come down?', 'Not once a number has rolled.'],
    ],
    tip: 'The "Rolled since last 7" row under these bets shows your progress.',
  },
];

const TYPE_TOPIC = {
  pass: 'pass', dontPass: 'dont-pass', come: 'come', dontCome: 'dont-come',
  place: 'place', buy: 'buy', lay: 'lay', big: 'big', hard: 'hardways', field: 'field',
  any7: 'any-seven', anyCraps: 'any-craps', num: 'prop-numbers', horn: 'horn', hornHigh: 'horn-high',
  world: 'world', ce: 'ce', hop: 'hop', fire: 'fire', small: 'ats', tall: 'ats', all: 'ats',
};

// Topic id for a table spot. Spots marked data-odds are the odds strips and come chips.
export function topicFor(key, isOdds = false) {
  return isOdds ? 'odds' : TYPE_TOPIC[String(key).split(':')[0]];
}

export function topic(id) {
  return TOPICS.find((t) => t.id === id);
}

// Facts show in this order on every card. null marks where bet-specific labels (Small, Tall, All, ...) go.
const FACT_ORDER = ['When you can bet', 'Wins', 'Wins / loses', null, 'Loses', 'Pushes', 'Pays', '"To 1" vs "for 1"',
  'Vig', 'Chances', 'Proper units', 'House edge', 'On the come-out', 'Can it come down?', 'Example'];
function factRank(label) {
  const i = FACT_ORDER.indexOf(label);
  return i === -1 ? FACT_ORDER.indexOf(null) : i;
}

// `anchor` gives the card its id (help page only); `extra` is inserted after the summary.
export function topicHTML(t, { anchor = false, extra = '' } = {}) {
  return `
    <section class="topic"${anchor ? ` id="${t.id}"` : ''}>
      <h3>${t.title}</h3>
      <p class="summary">${t.summary}</p>
      ${extra}
      <dl class="facts">${[...t.facts].sort((a, b) => factRank(a[0]) - factRank(b[0])).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${t.tip ? `<p class="topic-tip"><strong>Tip:</strong> ${t.tip}</p>` : ''}
    </section>`;
}
