// Exact house-edge proofs. Each bet is run through the real engine on all 36 dice
// outcomes, following every state it can reach until it resolves, and the exact
// expected value is compared with the published casino figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrapsTable } from '../js/engine/table.js';
import { POINTS, maxOdds, maxLay, DEFAULT_RULES } from '../js/engine/rules.js';

const BANKROLL = 1_000_000;

// Expected dollars won (negative = lost) per decision for the bets on `table`.
// States that loop back on each other are solved with Gauss-Seidel iteration.
function exactEV(table) {
  // Only track the Fire / All-Tall-Small history when one of those bets is up.
  const types = Object.values(table.bets).map((b) => b.type);
  const ats = types.some((t) => ['small', 'tall', 'all'].includes(t));
  const fire = types.includes('fire');
  const sorted = (a) => [...a].sort((x, y) => x - y);
  const pointMatters = !types.every((t) => ['small', 'tall', 'all'].includes(t));
  const keyOf = (t) => JSON.stringify([
    pointMatters ? t.point : null,
    ats ? sorted(t.atsNumbers) : null,
    fire ? sorted(t.shooter.pointsMade) : null,
    Object.values(t.bets),
  ]);
  const states = [];
  const index = new Map();
  const add = (t) => {
    const k = keyOf(t);
    if (!index.has(k)) {
      index.set(k, states.length);
      states.push({ t, trans: [] });
    }
    return index.get(k);
  };
  add(table);
  for (let i = 0; i < states.length; i++) {
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        const t = CrapsTable.restore(states[i].t.snapshot());
        const res = t.roll(d1, d2);
        if (res.results.some((r) => r.outcome !== 'move')) {
          states[i].trans.push({ reward: t.bankroll + t.totalOnTable() - BANKROLL });
        } else {
          states[i].trans.push({ next: add(t) });
        }
      }
    }
  }
  const V = new Float64Array(states.length);
  for (let iter = 0; iter < 1e5; iter++) {
    let delta = 0;
    for (let i = 0; i < states.length; i++) {
      let v = 0;
      for (const tr of states[i].trans) v += tr.next === undefined ? tr.reward : V[tr.next];
      v /= 36;
      delta = Math.max(delta, Math.abs(v - V[i]));
      V[i] = v;
    }
    if (delta < 1e-14) break;
  }
  return V[0];
}

function setup(rules, bets, { point = null, on = false } = {}) {
  const t = new CrapsTable(rules, BANKROLL);
  const needsPoint = ([key]) => key === 'come' || key === 'dontCome';
  for (const [key, amount] of bets.filter((b) => !needsPoint(b))) assert.ok(t.placeBet(key, amount).ok, key);
  if (point) t.point = point;
  for (const [key, amount] of bets.filter(needsPoint)) assert.ok(t.placeBet(key, amount).ok, key);
  if (on) for (const [key] of bets) if (t.def(t.bets[key]).toggle === 'bet' && !t.isWorking(t.bets[key])) t.toggleWorking(key);
  return t;
}

const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: got ${actual}, expected ${expected}`);

// [label, rules, bets, options, expected EV in dollars]
const CASES = [
  ['Pass Line 1.41%', {}, [['pass', 10]], {}, -10 * 7 / 495],
  ['Don\'t Pass 1.36%', {}, [['dontPass', 10]], {}, -10 * 3 / 220],
  ['Don\'t Pass bar 2', { barNumber: 2 }, [['dontPass', 10]], {}, -10 * 3 / 220],
  ['Come', {}, [['come', 10]], { point: 6 }, -10 * 7 / 495],
  ['Don\'t Come', {}, [['dontCome', 10]], { point: 6 }, -10 * 3 / 220],
  ['Place 4 6.67%', {}, [['place:4', 5]], { on: true }, -5 / 15],
  ['Place 5 4.00%', {}, [['place:5', 5]], { on: true }, -5 / 25],
  ['Place 6 1.52%', {}, [['place:6', 6]], { on: true }, -6 / 66],
  ['Place 8 1.52%', {}, [['place:8', 6]], { on: true }, -6 / 66],
  ['Place 9 4.00%', {}, [['place:9', 5]], { on: true }, -5 / 25],
  ['Place 10 6.67%', {}, [['place:10', 5]], { on: true }, -5 / 15],
  ['Buy 4, vig on win 1.67%', {}, [['buy:4', 20]], { on: true }, -20 / 60],
  ['Buy 4, vig up front 4.76% of $21', { buyVig: 'upfront' }, [['buy:4', 20]], { on: true }, -1],
  ['Buy 6, vig on win', {}, [['buy:6', 20]], { on: true }, -5 / 11],
  ['Lay 4, vig on win 1.67%', {}, [['lay:4', 40]], {}, -2 / 3],
  ['Lay 4, vig up front 2.44% of $41', { layVig: 'upfront' }, [['lay:4', 40]], {}, -1],
  ['Lay 5, vig on win', {}, [['lay:5', 30]], {}, -0.6],
  ['Lay 6, vig on win', {}, [['lay:6', 24]], {}, -6 / 11],
  ['Big 6 9.09%', {}, [['big:6', 10]], {}, -10 / 11],
  ['Hard 4 11.11%', {}, [['hard:4', 1]], { on: true }, -1 / 9],
  ['Hard 6 9.09%', {}, [['hard:6', 1]], { on: true }, -1 / 11],
  ['Hard 8 9.09%', {}, [['hard:8', 1]], { on: true }, -1 / 11],
  ['Hard 10 11.11%', {}, [['hard:10', 1]], { on: true }, -1 / 9],
  ['Field, 12 pays 3:1 2.78%', {}, [['field', 5]], {}, -5 / 36],
  ['Field, 12 pays 2:1 5.56%', { field12Pays: 2 }, [['field', 5]], {}, -10 / 36],
  ['Any Seven 16.67%', {}, [['any7', 1]], {}, -1 / 6],
  ['Any Craps 11.11%', {}, [['anyCraps', 1]], {}, -1 / 9],
  ['Aces 30 to 1 13.89%', {}, [['num:2', 1]], {}, -5 / 36],
  ['Boxcars 30 for 1 16.67%', { propsPay: 'for' }, [['num:12', 1]], {}, -1 / 6],
  ['Ace-Deuce 15 to 1 11.11%', {}, [['num:3', 1]], {}, -1 / 9],
  ['Yo 15 for 1 16.67%', { propsPay: 'for' }, [['num:11', 1]], {}, -1 / 6],
  ['Horn 12.5%', {}, [['horn', 4]], {}, -0.5],
  ['Horn High Yo 12.22%', {}, [['hornHigh:11', 5]], {}, -22 / 36],
  ['Horn High 12 12.78%', {}, [['hornHigh:12', 5]], {}, -23 / 36],
  ['World 13.33%', {}, [['world', 5]], {}, -24 / 36],
  ['C & E 11.11%', {}, [['ce', 2]], {}, -8 / 36],
  ['Easy hop 11.11%', {}, [['hop:1-4', 1]], {}, -4 / 36],
  ['Hard hop 13.89%', {}, [['hop:2-2', 1]], {}, -5 / 36],
];

for (const [label, rules, bets, opts, expected] of CASES) {
  test(`exact EV: ${label}`, () => close(exactEV(setup(rules, bets, opts)), expected, label));
}

// Wizard of Odds: P(exactly 4 / 5 / 6 points) for the Fire Bet; 24/249/999 to 1 → 20.76%.
test('exact EV: Fire Bet 20.76%', () => {
  const [p4, p5, p6] = [0.00879817844040312, 0.00163993313895325, 0.000162434749269826];
  close(exactEV(setup({}, [['fire', 1]])), 25 * p4 + 250 * p5 + 1000 * p6 - 1, 'Fire Bet');
});

// Wizard of Odds: P(Small) = P(Tall) = 20049/760760, P(All) = 126538525259/24067258815600.
test('exact EV: Small and Tall 7.76%, All 7.46%', () => {
  const pSide = 20049 / 760760;
  const pAll = 126538525259 / 24067258815600;
  close(exactEV(setup({}, [['small', 1]])), 35 * pSide - 1, 'Small');
  close(exactEV(setup({}, [['tall', 1]])), 35 * pSide - 1, 'Tall');
  close(exactEV(setup({}, [['all', 1]])), 176 * pAll - 1, 'All');
});

test('exact EV: odds add nothing to the house edge (0%), on every point, both sides', () => {
  for (const n of POINTS) {
    const flatPass = exactEV(setup({}, [['pass', 10]], { point: n }));
    const t = setup({}, [['pass', 10]], { point: n });
    assert.ok(t.placeOdds('pass', maxOdds(DEFAULT_RULES, n, 10)).ok);
    close(exactEV(t), flatPass, `pass odds on ${n}`);

    const flatDont = exactEV(setup({}, [['dontPass', 10]], { point: n }));
    const u = setup({}, [['dontPass', 10]], { point: n });
    assert.ok(u.placeOdds('dontPass', maxLay(DEFAULT_RULES, n, 10)).ok);
    close(exactEV(u), flatDont, `lay odds on ${n}`);
  }
});
