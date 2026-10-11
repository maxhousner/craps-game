// Scripted-dice tests: every bet's win / lose / push / move, plus table rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrapsTable } from '../js/engine/table.js';

const table = (rules = {}, bankroll = 10000) => new CrapsTable(rules, bankroll);
const place = (t, key, amount) => assert.deepEqual(t.placeBet(key, amount), { ok: true }, `${key} $${amount}`);
const odds = (t, key, amount) => assert.deepEqual(t.placeOdds(key, amount), { ok: true }, `odds ${key} $${amount}`);
const result = (res, key) => res.results.find((r) => r.key === key);
const withPoint = (n, rules) => {
  const t = table(rules);
  t.point = n;
  return t;
};

test('pass line: come-out naturals win and stay up, craps loses', () => {
  const t = table();
  place(t, 'pass', 10);
  assert.equal(result(t.roll(3, 4), 'pass').win, 10);
  assert.equal(result(t.roll(5, 6), 'pass').win, 10);
  assert.equal(t.bets.pass.amount, 10);
  assert.equal(result(t.roll(1, 1), 'pass').outcome, 'lose');
  assert.equal(t.bets.pass, undefined);
  assert.equal(t.bankroll, 10000 + 20 - 10);
});

test('pass line: point made pays flat 1:1 plus true odds; odds come down, flat stays', () => {
  const t = table();
  place(t, 'pass', 10);
  t.roll(2, 2); // point 4
  assert.equal(t.point, 4);
  odds(t, 'pass', 30);
  const res = t.roll(3, 1);
  assert.equal(result(res, 'pass').win, 10 + 60);
  assert.equal(t.point, null);
  assert.equal(t.bets.pass.amount, 10);
  assert.equal(t.bets.pass.odds, 0);
  assert.equal(t.bankroll, 10000 - 10 + 70);
});

test('pass line: seven-out loses flat and odds', () => {
  const t = table();
  place(t, 'pass', 10);
  t.roll(4, 4);
  odds(t, 'pass', 50);
  const res = t.roll(3, 4);
  assert.equal(result(res, 'pass').lost, 60);
  assert.ok(res.sevenOut);
  assert.equal(t.shooter.number, 2);
  assert.equal(t.bankroll, 10000 - 60);
});

test('pass line is a contract bet once the point is set, except chips added since the last roll', () => {
  const t = table();
  place(t, 'pass', 10);
  t.roll(3, 3);
  assert.equal(t.removeBet('pass').ok, false);
  place(t, 'pass', 5); // a put increase
  assert.equal(t.removeBet('pass', 5).ok, true); // undo before the roll
  assert.equal(t.removeBet('pass', 5).ok, false);
  odds(t, 'pass', 25);
  assert.equal(t.removeOdds('pass').ok, true); // odds can always come down
});

test('don\'t pass: 2 and 3 win, bar 12 pushes, 7 and 11 lose', () => {
  const t = table();
  place(t, 'dontPass', 10);
  assert.equal(result(t.roll(1, 2), 'dontPass').win, 10);
  assert.equal(result(t.roll(6, 6), 'dontPass').outcome, 'push');
  assert.equal(t.bets.dontPass.amount, 10);
  assert.equal(result(t.roll(5, 6), 'dontPass').outcome, 'lose');
});

test('don\'t pass: bar 2 rule pushes the 2 and pays the 12', () => {
  const t = table({ barNumber: 2 });
  place(t, 'dontPass', 10);
  assert.equal(result(t.roll(1, 1), 'dontPass').outcome, 'push');
  assert.equal(result(t.roll(6, 6), 'dontPass').win, 10);
});

test('don\'t pass: can\'t be made after the point, can be taken down, lay odds pay on the 7', () => {
  const t = table();
  place(t, 'dontPass', 10);
  t.roll(2, 3); // point 5
  assert.equal(t.placeBet('dontPass', 5).ok, false);
  odds(t, 'dontPass', 60); // 6x on 3-4-5x: wins $40
  assert.equal(t.placeOdds('dontPass', 3).ok, false);
  const res = t.roll(3, 4);
  assert.equal(result(res, 'dontPass').win, 10 + 40);
  assert.equal(t.bets.dontPass.odds, 0);

  const u = table();
  place(u, 'dontPass', 10);
  u.roll(3, 3);
  odds(u, 'dontPass', 60);
  assert.equal(u.removeBet('dontPass').ok, true);
  assert.equal(u.bankroll, 10000);
});

test('reducing a don\'t bet caps its lay odds at the new max', () => {
  const t = table();
  place(t, 'dontPass', 20);
  t.roll(2, 2); // point 4: max lay = 2 × (3 × 20) = 120
  odds(t, 'dontPass', 120);
  assert.equal(t.removeBet('dontPass', 10).ok, true);
  assert.equal(t.bets.dontPass.odds, 60);
  assert.equal(t.bankroll, 10000 - 10 - 60);
});

test('come: only with a point; moves to the number; pays with odds when it repeats', () => {
  const t = table();
  assert.equal(t.placeBet('come', 10).ok, false);
  place(t, 'pass', 10);
  t.roll(2, 2); // point 4
  place(t, 'come', 10);
  const moved = t.roll(5, 1);
  assert.equal(result(moved, 'come:6').outcome, 'move');
  assert.equal(t.bets.come, undefined);
  odds(t, 'come:6', 50);
  assert.equal(t.removeBet('come:6').ok, false);
  const res = t.roll(4, 2);
  assert.equal(result(res, 'come:6').win, 10 + 60);
  assert.equal(t.bets['come:6'], undefined);
});

test('come: pending bet wins on 11 (stays), loses on craps, wins and comes down on a seven-out', () => {
  const t = withPoint(8);
  place(t, 'come', 10);
  assert.equal(result(t.roll(5, 6), 'come').win, 10);
  assert.equal(t.bets.come.amount, 10);
  assert.equal(result(t.roll(1, 2), 'come').outcome, 'lose');
  place(t, 'come', 10);
  const res = t.roll(3, 4);
  assert.equal(result(res, 'come').win, 10);
  assert.equal(t.bets.come, undefined);
});

test('come odds are off on the come-out by default: returned on a 7, returned when the number hits', () => {
  const t = table();
  place(t, 'pass', 10);
  t.roll(2, 2); // point 4
  place(t, 'come', 10);
  t.roll(4, 2); // come to 6
  odds(t, 'come:6', 50);
  place(t, 'come', 10);
  t.roll(5, 3); // come to 8
  odds(t, 'come:8', 50);
  t.roll(1, 3); // point 4 made → come-out
  assert.equal(t.point, null);
  assert.equal(t.isWorking(t.bets['come:6']), false);
  const before = t.bankroll;
  const res = t.roll(3, 4); // come-out 7
  assert.equal(result(res, 'come:6').lost, 10);
  assert.equal(result(res, 'come:6').returned, 50);
  assert.equal(result(res, 'come:8').lost, 10);
  assert.equal(t.bankroll, before + 10 /* pass wins */ + 100);
});

test('come odds turned on for the come-out win at true odds', () => {
  const t = table();
  place(t, 'pass', 10);
  t.roll(2, 2);
  place(t, 'come', 10);
  t.roll(4, 2);
  odds(t, 'come:6', 50);
  t.roll(2, 2); // point made → come-out
  t.toggleWorking('come:6');
  assert.equal(t.isWorking(t.bets['come:6']), true);
  const res = t.roll(5, 1);
  assert.equal(result(res, 'come:6').win, 10 + 60);
});

test('come-out roll on a come number with odds off: flat wins, odds returned', () => {
  const t = withPoint(4);
  place(t, 'come', 10);
  t.roll(4, 2);
  odds(t, 'come:6', 25);
  t.point = null; // come-out
  const before = t.bankroll;
  const res = t.roll(3, 3);
  assert.equal(result(res, 'come:6').win, 10);
  assert.equal(t.bankroll, before + 10 + 10 + 25);
});

test('a new come bet travelling to a number pays off the old come bet there', () => {
  const t = withPoint(4);
  place(t, 'come', 10);
  t.roll(4, 2);
  place(t, 'come', 15);
  const res = t.roll(5, 1);
  assert.equal(res.results.find((r) => r.key === 'come:6' && r.outcome === 'win').win, 10);
  assert.equal(t.bets['come:6'].amount, 15);
});

test('put bet goes straight on a number and can take odds', () => {
  const t = table();
  assert.equal(t.placeBet('come:6', 10).ok, false);
  t.point = 5;
  place(t, 'come:6', 10);
  odds(t, 'come:6', 50);
  const res = t.roll(3, 3);
  assert.equal(result(res, 'come:6').win, 10 + 60);
});

test('don\'t come: bar 12 push, moves behind the number, 7 pays flat and lay odds', () => {
  const t = withPoint(5);
  place(t, 'dontCome', 10);
  assert.equal(result(t.roll(6, 6), 'dontCome').outcome, 'push');
  assert.equal(result(t.roll(1, 2), 'dontCome').win, 10);
  t.roll(4, 6); // to 10
  assert.ok(t.bets['dontCome:10']);
  assert.equal(t.placeBet('dontCome:10', 5).ok, false);
  odds(t, 'dontCome:10', 60);
  const res = t.roll(3, 4);
  assert.equal(result(res, 'dontCome:10').win, 10 + 30);
});

test('place bets: off on the come-out by default, pay 9:5 / 7:5 / 7:6, stay up', () => {
  const t = table();
  place(t, 'place:6', 12);
  place(t, 'place:5', 10);
  place(t, 'place:4', 10);
  assert.equal(t.roll(3, 3).results.length, 0); // come-out: off; point is now 6
  assert.equal(result(t.roll(4, 1), 'place:5').win, 14);
  assert.equal(result(t.roll(2, 2), 'place:4').win, 18);
  assert.equal(result(t.roll(5, 1), 'place:6').win, 14); // also the point
  assert.equal(t.bets['place:6'].amount, 12);
  const res = t.roll(3, 4); // come-out 7: place bets off
  assert.equal(result(res, 'place:6'), undefined);
  t.toggleWorking('place:6');
  t.roll(2, 2); // point 4
  assert.equal(result(t.roll(4, 3), 'place:6').outcome, 'lose');
});

test('place and buy can\'t share a number', () => {
  const t = table();
  place(t, 'place:4', 10);
  assert.equal(t.placeBet('buy:4', 20).ok, false);
});

test('buy 4 for $20: pays 2:1 less $1 vig on the win', () => {
  const t = withPoint(5);
  place(t, 'buy:4', 20);
  assert.equal(t.bankroll, 10000 - 20);
  assert.equal(result(t.roll(2, 2), 'buy:4').win, 39);
});

test('buy with vig up front: charged when placed, refunded if taken down, lost on a 7', () => {
  const t = withPoint(5, { buyVig: 'upfront' });
  place(t, 'buy:10', 25);
  assert.equal(t.bankroll, 10000 - 26); // $25 buy → $1 vig
  place(t, 'buy:10', 15);
  assert.equal(t.bankroll, 10000 - 42); // $40 → $2 vig
  assert.equal(result(t.roll(5, 5), 'buy:10').win, 78);
  t.removeBet('buy:10');
  assert.equal(t.bankroll, 10000 + 78);
  place(t, 'buy:10', 40);
  assert.equal(result(t.roll(3, 4), 'buy:10').lost, 42);
});

test('lay 4 for $40: wins $20 less $1 vig on a 7; lays work on the come-out', () => {
  const t = table();
  place(t, 'lay:4', 40);
  assert.equal(result(t.roll(3, 4), 'lay:4').win, 19);
  place(t, 'lay:6', 30);
  assert.equal(result(t.roll(5, 2), 'lay:6').win, 24);
  assert.equal(result(t.roll(1, 3), 'lay:4').outcome, 'lose');
});

test('big 6/8 pay even money and work on the come-out', () => {
  const t = table();
  place(t, 'big:8', 10);
  assert.equal(result(t.roll(4, 4), 'big:8').win, 10); // come-out roll
  assert.equal(result(t.roll(5, 2), 'big:8').outcome, 'lose');
});

test('hardways: win hard, lose easy or 7, off on the come-out', () => {
  const t = withPoint(5);
  place(t, 'hard:6', 5);
  place(t, 'hard:4', 5);
  assert.equal(result(t.roll(3, 3), 'hard:6').win, 45);
  assert.equal(result(t.roll(3, 1), 'hard:4').outcome, 'lose');
  assert.equal(result(t.roll(4, 2), 'hard:6').outcome, 'lose');
  place(t, 'hard:8', 1);
  t.point = null;
  assert.equal(result(t.roll(3, 4), 'hard:8'), undefined);
});

test('field pays 1:1, 2:1 on the 2, and the 12 per house rule', () => {
  const t = table();
  place(t, 'field', 10);
  assert.equal(result(t.roll(1, 1), 'field').win, 20);
  assert.equal(result(t.roll(6, 6), 'field').win, 30);
  assert.equal(result(t.roll(4, 5), 'field').win, 10);
  assert.equal(result(t.roll(2, 3), 'field').outcome, 'lose');
  const u = table({ field12Pays: 2 });
  place(u, 'field', 10);
  assert.equal(result(u.roll(6, 6), 'field').win, 20);
});

test('one-roll props pay "to 1" by default and "for 1" when set', () => {
  const t = table();
  place(t, 'any7', 5);
  place(t, 'anyCraps', 5);
  place(t, 'num:2', 1);
  place(t, 'num:11', 1);
  let res = t.roll(1, 1);
  assert.equal(result(res, 'anyCraps').win, 35);
  assert.equal(result(res, 'num:2').win, 30);
  assert.equal(result(res, 'any7').outcome, 'lose');
  assert.equal(result(res, 'num:11').outcome, 'lose');
  const u = table({ propsPay: 'for' });
  place(u, 'num:12', 1);
  assert.equal(result(u.roll(6, 6), 'num:12').win, 29);
  place(u, 'num:3', 1);
  assert.equal(result(u.roll(1, 2), 'num:3').win, 14);
  place(u, 'any7', 1);
  assert.equal(result(u.roll(3, 4), 'any7').win, 4);
});

test('horn, horn high, world and C&E combination math', () => {
  const t = table();
  place(t, 'horn', 4);
  place(t, 'hornHigh:11', 5);
  place(t, 'world', 5);
  place(t, 'ce', 2);
  let res = t.roll(1, 2); // 3
  assert.equal(result(res, 'horn').win, 12);
  assert.equal(result(res, 'hornHigh:11').win, 11);
  assert.equal(result(res, 'world').win, 11);
  assert.equal(result(res, 'ce').win, 6);
  res = t.roll(5, 6); // 11
  assert.equal(result(res, 'hornHigh:11').win, 27);
  assert.equal(result(res, 'ce').win, 14);
  res = t.roll(3, 4); // 7
  assert.equal(result(res, 'world').outcome, 'push');
  assert.equal(result(res, 'horn').outcome, 'lose');
  assert.equal(t.bets.world.amount, 5);
});

test('horn bets must be in full units', () => {
  const t = table();
  place(t, 'horn', 5);
  assert.equal(t.canRoll(), false);
  assert.match(t.issues()[0].message, /\$4 units/);
  t.fix('horn');
  assert.equal(t.bets.horn.amount, 4);
});

test('hop bets: easy 15:1 either way round, hard 30:1', () => {
  const t = table();
  place(t, 'hop:1-4', 1);
  place(t, 'hop:3-3', 1);
  let res = t.roll(4, 1);
  assert.equal(result(res, 'hop:1-4').win, 15);
  assert.equal(result(res, 'hop:3-3').outcome, 'lose');
  place(t, 'hop:3-3', 1);
  assert.equal(result(t.roll(3, 3), 'hop:3-3').win, 30);
  assert.equal(t.placeBet('hop:4-1', 1).ok, false); // keys are low-high
});

test('proper units are enforced by default: $5 Place 6 blocks the roll until fixed', () => {
  const t = table();
  place(t, 'place:6', 5);
  assert.equal(t.canRoll(), false);
  const [issue] = t.issues();
  assert.equal(issue.level, 'error');
  assert.match(issue.message, /Place 6 pays 7 to 6\. Bet in \$6 units/);
  assert.throws(() => t.roll(3, 3));
  t.fix('place:6');
  assert.equal(t.bets['place:6'].amount, 6);
  assert.equal(t.canRoll(), true);
});

test('fix rounds to the nearest proper amount, ties round up', () => {
  const t = table();
  place(t, 'place:8', 7);
  t.fix('place:8');
  assert.equal(t.bets['place:8'].amount, 6);
  place(t, 'place:8', 4); // $10
  t.fix('place:8');
  assert.equal(t.bets['place:8'].amount, 12);
  place(t, 'place:8', 3); // $15: 12 and 18 are equally close
  t.fix('place:8');
  assert.equal(t.bets['place:8'].amount, 18);
});

test('with non-proper bets allowed: a hint but no block, and the payout rounds down', () => {
  const t = table({ allowImproper: true });
  place(t, 'place:6', 5);
  const [issue] = t.issues();
  assert.equal(issue.level, 'warn');
  assert.match(issue.message, /pays \$5 instead of \$5\.83/);
  assert.equal(t.canRoll(), true);
  t.point = 4;
  assert.equal(result(t.roll(3, 3), 'place:6').win, 5);
});

test('improper odds are flagged too', () => {
  const t = table();
  place(t, 'pass', 5);
  t.roll(3, 2); // point 5
  odds(t, 'pass', 5);
  assert.equal(t.canRoll(), false);
  assert.equal(t.issues()[0].part, 'odds');
  t.fix('pass', 'odds');
  assert.equal(t.bets.pass.odds, 6);
});

test('table minimum: below-minimum bets block the roll; place 6/8 minimum is $6', () => {
  const t = table();
  place(t, 'pass', 1);
  assert.match(t.issues()[0].message, /Pass Line minimum is \$5/);
  t.fix('pass');
  assert.equal(t.bets.pass.amount, 5);
  assert.equal(t.limits({ type: 'place', number: 6 }).min, 6);
  assert.equal(t.limits({ type: 'place', number: 5 }).min, 5);
});

test('3-4-5x odds maximums, and odd multiples round up to an amount that pays evenly', () => {
  const t = table();
  const bet = { type: 'pass', amount: 5 };
  for (const [point, max] of [[4, 15], [5, 20], [6, 25], [8, 25], [9, 20], [10, 15]]) {
    t.point = point;
    assert.equal(t.oddsInfo(bet).max, max, `odds on ${point}`);
  }
  const dp = { type: 'dontPass', amount: 5 };
  for (const point of [4, 5, 6, 8, 9, 10]) {
    t.point = point;
    assert.equal(t.oddsInfo(dp).max, 30, `lay on ${point}`);
  }
  const u = table({ oddsMultiple: '3' });
  u.point = 5;
  assert.equal(u.oddsInfo(bet).max, 16);
});

test('table maximum is enforced when placing', () => {
  const t = table({}, 100000);
  assert.equal(t.placeBet('field', 5001).ok, false);
  assert.equal(t.placeBet('fire', 6).ok, false);
});

test('fire bet: pays 24:1 for 4 different points on the seven-out; only before the first roll', () => {
  const t = table();
  place(t, 'fire', 1);
  for (const [a, b] of [[2, 2], [3, 1], [2, 3], [4, 1], [3, 3], [4, 2], [4, 4], [6, 2], [2, 2], [1, 3]]) t.roll(a, b);
  assert.deepEqual(t.shooter.pointsMade, [4, 5, 6, 8]);
  assert.equal(t.placeBet('fire', 1).ok, false);
  t.roll(3, 3); // point 6
  const res = t.roll(3, 4);
  assert.equal(result(res, 'fire').win, 24);
  assert.equal(t.placeBet('fire', 1).ok, true); // new shooter
});

test('fire bet: all six points pays 999:1 the moment the sixth is made', () => {
  const t = table();
  place(t, 'fire', 1);
  for (const n of [4, 5, 6, 8, 9]) {
    const d = n <= 7 ? [1, n - 1] : [6, n - 6];
    t.roll(...d);
    t.roll(...d);
  }
  t.roll(5, 5);
  const res = t.roll(4, 6);
  assert.equal(result(res, 'fire').win, 999);
});

test('fire bet loses with fewer than 4 points', () => {
  const t = table();
  place(t, 'fire', 5);
  t.roll(2, 2);
  t.roll(2, 2);
  t.roll(3, 3);
  assert.equal(result(t.roll(3, 4), 'fire').lost, 5);
});

test('all/tall/small: pays when every number in the group rolls before a 7', () => {
  const t = table();
  place(t, 'small', 1);
  place(t, 'tall', 1);
  t.roll(1, 1);
  assert.equal(t.placeBet('all', 1).ok, false);
  t.roll(1, 2);
  t.roll(2, 2);
  t.roll(2, 3);
  const res = t.roll(3, 3);
  assert.equal(result(res, 'small').win, 34);
  assert.equal(result(t.roll(3, 4), 'tall').outcome, 'lose');
  assert.equal(t.placeBet('all', 1).ok, true);
  const u = table({ atsPayTable: '30-150' });
  place(u, 'tall', 1);
  for (const d of [[4, 4], [4, 5], [5, 5], [5, 6], [6, 6]]) u.roll(...d);
  assert.equal(u.bankroll, 10000 + 30);
});

test('house rules can only change with no bets on the table', () => {
  const t = table();
  place(t, 'field', 5);
  assert.equal(t.setRules({ field12Pays: 2 }).ok, false);
  t.removeBet('field');
  assert.equal(t.setRules({ field12Pays: 2 }).ok, true);
  assert.equal(t.rules.field12Pays, 2);
});

test('working toggle: lays and big 6/8 can be turned off', () => {
  const t = table();
  place(t, 'lay:10', 40);
  t.toggleWorking('lay:10');
  assert.equal(result(t.roll(3, 4), 'lay:10'), undefined);
  t.toggleWorking('lay:10');
  assert.equal(t.bets['lay:10'].working, null);
  assert.equal(t.toggleWorking('field').ok, false);
});

test('snapshot / restore round-trips the whole table', () => {
  const t = table();
  place(t, 'pass', 10);
  t.roll(2, 3);
  odds(t, 'pass', 20);
  place(t, 'place:6', 12);
  const u = CrapsTable.restore(JSON.parse(JSON.stringify(t.snapshot())));
  assert.deepEqual(u.snapshot(), t.snapshot());
  assert.equal(result(u.roll(3, 2), 'pass').win, 40);
});

test('bankroll is never overdrawn', () => {
  const t = table({}, 20);
  assert.equal(t.placeBet('pass', 25).ok, false);
  place(t, 'pass', 20);
  assert.equal(t.placeBet('field', 5).ok, false);
});
