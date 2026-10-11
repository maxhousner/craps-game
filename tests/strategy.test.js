// Strategy runner and simulator tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrapsTable } from '../js/engine/table.js';
import { createRunner, validateStrategy, describePlan, properAmount } from '../js/sim/strategy.js';
import { runSession, summarize, sessionSeed, OUTCOMES } from '../js/sim/simulate.js';
import { PRESETS } from '../js/sim/presets.js';

const preset = (id) => PRESETS.find((p) => p.id === id);
const SETTINGS = { rules: {}, bankroll: 1000, length: { unit: 'rolls', value: 200 }, stopWin: 0, stopLoss: 0 };

// Decide, roll fixed dice, record: one turn of the runner.
function turn(table, runner, d1, d2) {
  runner.decide(table);
  const res = table.roll(d1, d2);
  runner.record(res, table);
  return res;
}

test('pass + max odds: line bet on the come-out, 3-4-5x odds once the point is set', () => {
  const t = new CrapsTable({}, 10000);
  const r = createRunner(preset('pass-odds'));
  r.decide(t);
  assert.equal(t.bets.pass.amount, 10);
  t.roll(2, 2);
  r.decide(t);
  assert.equal(t.bets.pass.odds, 30);
  t.roll(2, 3); // no decision
  r.decide(t);
  assert.equal(t.bets.pass.odds, 30); // unchanged, not stacked again
});

test('3-Point Molly keeps two come bets working, each with odds', () => {
  const t = new CrapsTable({}, 10000);
  const r = createRunner(preset('molly'));
  turn(t, r, 3, 3); // point 6
  turn(t, r, 4, 4); // come → 8
  turn(t, r, 2, 3); // come → 5
  r.decide(t);
  assert.equal(t.bets.pass.odds, 50);
  assert.equal(t.bets['come:8'].odds, 50);
  assert.equal(t.bets['come:5'].odds, 40);
  assert.equal(t.bets.come, undefined, 'no third come bet');
});

test('skip the point: a place bet on the point number comes down', () => {
  const t = new CrapsTable({}, 10000);
  const r = createRunner(preset('pass-across'));
  turn(t, r, 3, 3); // point 6
  r.decide(t);
  assert.equal(t.bets['place:6'], undefined);
  assert.equal(t.bets['place:8'].amount, 6); // $5 rounds to the proper $6
  assert.equal(t.bets['place:5'].amount, 5);
});

test('press every other hit: collect, press, collect, press; reset after a seven-out', () => {
  const t = new CrapsTable({}, 10000);
  const r = createRunner(preset('place-68-press'));
  t.point = 5;
  const amounts = [];
  for (let i = 0; i < 4; i++) {
    turn(t, r, 4, 2);
    r.decide(t);
    amounts.push(t.bets['place:6'].amount);
  }
  assert.deepEqual(amounts, [12, 24, 24, 48]);
  turn(t, r, 3, 4); // seven-out
  turn(t, r, 2, 3); // new point 5
  r.decide(t);
  assert.equal(t.bets['place:6'].amount, 12);
});

test('regression: $24 drops to $12 after the first hit and stays there', () => {
  const t = new CrapsTable({}, 10000);
  const r = createRunner(preset('regression'));
  t.point = 4;
  r.decide(t);
  assert.equal(t.bets['place:8'].amount, 24);
  turn(t, r, 5, 3);
  r.decide(t);
  assert.equal(t.bets['place:8'].amount, 12);
  turn(t, r, 6, 2);
  r.decide(t);
  assert.equal(t.bets['place:8'].amount, 12);
});

test('Martingale doubles after losses, resets after a win, and starts over at the cap', () => {
  const t = new CrapsTable({}, 100000);
  const plan = { bet: 'field', amount: 5, when: 'always', progression: { onWin: 'reset', onLoss: 'double', max: 20 } };
  const r = createRunner({ name: 'm', plans: [plan] });
  const seen = [];
  for (const [a, b] of [[3, 3], [3, 3], [1, 1], [2, 3], [2, 3], [2, 3], [2, 3]]) {
    r.decide(t);
    seen.push(t.bets.field.amount);
    const res = t.roll(a, b);
    r.record(res, t);
    if (t.point) t.point = null; // keep it simple: the field doesn't care
  }
  assert.deepEqual(seen, [5, 10, 20, 5, 10, 20, 5]);
});

test('Paroli presses after wins and starts over after three in a row', () => {
  const t = new CrapsTable({}, 10000);
  const r = createRunner(preset('pass-paroli'));
  const seen = [];
  for (let i = 0; i < 4; i++) {
    r.decide(t);
    seen.push(t.bets.pass.amount);
    r.record(t.roll(3, 4), t); // come-out 7 wins
  }
  assert.deepEqual(seen, [10, 20, 40, 10]);
});

test('ladder and half-press progressions step through their amounts', () => {
  const t = new CrapsTable({}, 10000);
  const ladder = createRunner({ name: 'l', plans: [{ bet: 'place', numbers: [6], amount: 12, when: 'point', progression: { onWin: 'ladder', ladder: [18, 24, 30] } }] });
  t.point = 4;
  const seen = [];
  for (let i = 0; i < 4; i++) {
    turn(t, ladder, 3, 3);
    ladder.decide(t);
    seen.push(t.bets['place:6'].amount);
  }
  assert.deepEqual(seen, [18, 24, 30, 30]);

  const u = new CrapsTable({}, 10000);
  const half = createRunner({ name: 'h', plans: [{ bet: 'place', numbers: [8], amount: 12, when: 'point', progression: { onWin: 'halfPress' } }] });
  u.point = 4;
  turn(u, half, 4, 4);
  half.decide(u);
  assert.equal(u.bets['place:8'].amount, 18);
});

test('place bets can be set to work on the come-out', () => {
  const t = new CrapsTable({}, 10000);
  const r = createRunner({ name: 'c', plans: [{ bet: 'place', numbers: [6], amount: 12, when: 'always', comeOutOn: true }] });
  r.decide(t);
  assert.equal(t.isWorking(t.bets['place:6']), true);
  assert.equal(t.roll(3, 3).results[0].win, 14);
});

test('amounts are raised to the table minimum and rounded to proper units', () => {
  const t = new CrapsTable({ tableMin: 10 }, 10000);
  assert.equal(properAmount(t, 'pass', 5), 10);
  assert.equal(properAmount(t, 'place:6', 10), 12);
  assert.equal(properAmount(t, 'horn', 5), 4);
  const u = new CrapsTable({ allowImproper: true }, 10000);
  assert.equal(properAmount(u, 'place:6', 5), 5);
});

test('validation catches missing names, duplicate bets and place/buy on the same number', () => {
  assert.deepEqual(validateStrategy(preset('molly')), []);
  const bad = validateStrategy({
    name: '',
    plans: [
      { bet: 'place', numbers: [6, 8], amount: 12 },
      { bet: 'place', numbers: [8], amount: 6 },
      { bet: 'buy', numbers: [6], amount: 20 },
      { bet: 'come', amount: 10, count: 9 },
    ],
  });
  assert.equal(bad.length, 4);
  assert.match(describePlan(preset('place-68-press').plans[0]), /press every 2nd win, max \$96/);
});

test('every preset is valid and plays 50 sessions under several house-rule setups', () => {
  const ruleSets = [
    {},
    { tableMin: 10, oddsMultiple: '2', field12Pays: 2 },
    { tableMin: 25, allowImproper: true, propsPay: 'for', barNumber: 2 },
    { buyVig: 'upfront', layVig: 'upfront', oddsMultiple: '100', tableMin: 1 },
  ];
  for (const p of PRESETS) {
    assert.deepEqual(validateStrategy(p), [], p.name);
    for (const rules of ruleSets) {
      for (let i = 0; i < 50; i++) runSession(p, { ...SETTINGS, rules }, sessionSeed(7, i));
    }
  }
});

test('sessions are repeatable and every strategy sees the same dice', () => {
  const a = runSession(preset('molly'), SETTINGS, 1234, { log: true });
  const b = runSession(preset('molly'), SETTINGS, 1234, { log: true });
  assert.deepEqual(a.log.map((e) => [e.d1, e.d2]), b.log.map((e) => [e.d1, e.d2]));
  assert.equal(a.net, b.net);
  const c = runSession(preset('iron-cross'), SETTINGS, 1234, { log: true });
  assert.deepEqual(c.log.slice(0, 50).map((e) => [e.d1, e.d2]), a.log.slice(0, 50).map((e) => [e.d1, e.d2]));
});

test('session money adds up: final result = sum of every roll\'s wins and losses', () => {
  for (const id of ['molly', 'pass-buy-4-10', 'dark-molly', 'iron-cross', 'place-68-press']) {
    for (const rules of [{}, { buyVig: 'upfront', layVig: 'upfront' }]) {
      for (let i = 0; i < 30; i++) {
        const s = runSession(preset(id), { ...SETTINGS, rules }, sessionSeed(99, i), { log: true });
        const sum = s.log.reduce((acc, e) => acc + e.net, 0);
        assert.equal(s.net, sum, `${id} session ${i}`);
      }
    }
  }
});

test('stop-loss, stop-win, bust and shooter limits end sessions the right way', () => {
  const stops = { ...SETTINGS, stopWin: 50, stopLoss: 50 };
  const seenOutcomes = new Set();
  for (let i = 0; i < 200; i++) {
    const s = runSession(preset('pass-odds'), stops, sessionSeed(3, i));
    seenOutcomes.add(s.outcome);
    if (s.outcome === 'stop-loss') assert.ok(s.net <= -50);
    if (s.outcome === 'stop-win') assert.ok(s.net >= 50);
  }
  assert.ok(seenOutcomes.has('stop-win') && seenOutcomes.has('stop-loss'));

  const broke = runSession(preset('field-martingale'), { ...SETTINGS, bankroll: 40, length: { unit: 'rolls', value: 5000 } }, 5);
  assert.equal(broke.outcome, 'bust');

  const shooters = runSession(preset('pass-odds'), { ...SETTINGS, length: { unit: 'shooters', value: 5 } }, 11);
  assert.equal(shooters.shooters, 5);
});

test('simulated Pass Line house edge is within 4 standard errors of 1.41%', () => {
  const n = 4000;
  const net = new Float64Array(n);
  const action = new Float64Array(n);
  const plan = { name: 'pass', plans: [{ bet: 'pass', amount: 10, odds: 'none' }] };
  for (let i = 0; i < n; i++) {
    const s = runSession(plan, { ...SETTINGS, bankroll: 100000 }, sessionSeed(2024, i));
    net[i] = s.net;
    action[i] = s.action;
  }
  const stats = summarize({ net, action, rolls: new Uint32Array(n), maxDrawdown: new Float64Array(n), low: new Float64Array(n), outcome: new Uint8Array(n) });
  // Each $10 decision is ±1 unit, so the standard error is 1/sqrt(decisions). 4 SE catches
  // accounting bugs (double counting, missed losses) without failing on an unlucky stretch.
  const se = 1 / Math.sqrt(stats.action * n / 10);
  assert.ok(Math.abs(stats.edge - 7 / 495) < 4 * se, `edge ${stats.edge} vs ${7 / 495} (SE ${se})`);
  assert.equal(OUTCOMES[0], 'limit');
});
