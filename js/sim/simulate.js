// Runs strategy sessions on seeded dice and summarizes the results.
// Pure logic: used by the Web Worker, the replay view, and the tests.

import { CrapsTable } from '../engine/table.js';
import { seededDice } from '../engine/dice.js';
import { createRunner } from './strategy.js';

export const ROLLS_PER_HOUR = 100; // a typical table pace
export const OUTCOMES = ['limit', 'stop-win', 'stop-loss', 'bust'];

// Session i gets its own dice stream, so every strategy sees the same rolls in session i.
export function sessionSeed(seed, i) {
  return (seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
}

export function rollLimit({ length }) {
  if (length.unit === 'rolls') return length.value;
  if (length.unit === 'hours') return Math.round(length.value * ROLLS_PER_HOUR);
  return Infinity;
}

// How many rolls the bankroll-over-time chart spans (about 9 rolls per shooter).
export function horizon(settings) {
  const limit = rollLimit(settings);
  return Number.isFinite(limit) ? limit : settings.length.value * 9;
}

function takeDownAll(table, log) {
  for (const bet of [...table.betList()]) {
    if (bet.odds) table.removeOdds(bet.key);
    const n = Math.min(table.def(bet).removable(table, bet), bet.amount);
    if (n > 0 && table.removeBet(bet.key, n).ok) log?.(`Take down ${table.label(bet.key)}`);
  }
}

/**
 * Play one session. settings = { rules, bankroll, length: { unit, value }, stopWin, stopLoss }.
 * When the session ends (limit, stop-win, stop-loss) new bets stop and anything that can come
 * down does; contract bets (a pass or come bet on a point) are played out first.
 * Options: checkpoints = number of evenly spaced points to record for the bankroll chart;
 * log = keep a roll-by-roll record for the replay view.
 */
export function runSession(strategy, settings, seed, { checkpoints = 0, log = false } = {}) {
  const dice = seededDice(seed);
  const table = new CrapsTable(settings.rules, settings.bankroll);
  const runner = createRunner(strategy);
  const start = settings.bankroll;
  const limit = rollLimit(settings);
  const shooterLimit = settings.length.unit === 'shooters' ? settings.length.value : Infinity;
  const safety = (Number.isFinite(limit) ? limit : shooterLimit * 200) + 10000;
  const span = horizon(settings);
  const path = checkpoints ? new Float32Array(checkpoints) : null;
  let next = 0;
  const entries = log ? [] : null;

  let rolls = 0;
  let shooters = 0;
  let action = 0;
  let peak = 0;
  let low = 0;
  let maxDrawdown = 0;
  let outcome = null;
  const worth = () => table.bankroll + table.totalOnTable() - start;

  while (rolls < safety) {
    const w = worth();
    if (!outcome) {
      if (rolls >= limit || shooters >= shooterLimit) outcome = 'limit';
      else if (settings.stopWin && w >= settings.stopWin) outcome = 'stop-win';
      else if (settings.stopLoss && w <= -settings.stopLoss) outcome = 'stop-loss';
    }
    const actions = log ? [] : null;
    const note = actions ? (a) => actions.push(a) : null;
    if (outcome) {
      takeDownAll(table, note);
      if (table.betList().length === 0) break;
    } else if (runner.decide(table, note).short && table.betList().length === 0) {
      outcome = 'bust';
      break;
    }

    const [d1, d2] = dice.roll();
    const res = table.roll(d1, d2);
    rolls++;
    if (res.sevenOut) shooters++;
    runner.record(res, table);
    for (const r of res.results) if (r.outcome === 'win' || r.outcome === 'lose') action += r.stake;
    const after = worth();
    peak = Math.max(peak, after);
    low = Math.min(low, after);
    maxDrawdown = Math.max(maxDrawdown, peak - after);
    if (path) while (next < checkpoints && rolls >= Math.round(((next + 1) * span) / checkpoints)) path[next++] = after;
    if (entries) {
      entries.push({ roll: rolls, d1, d2, pointBefore: res.pointBefore, point: res.point, actions, results: res.results, net: res.net, worth: after });
    }
  }

  const net = worth();
  if (path) while (next < checkpoints) path[next++] = net;
  return { net, rolls, shooters, action, peak, low, maxDrawdown, outcome: outcome ?? 'limit', path, log: entries };
}

function quantile(sorted, p) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (i - lo);
}

// Summary statistics for one strategy's sessions (typed arrays from the worker).
export function summarize({ net, action, rolls, maxDrawdown, low, outcome }) {
  const n = net.length;
  const sorted = Float64Array.from(net).sort();
  let sum = 0;
  let sumSq = 0;
  let sumAction = 0;
  let ahead = 0;
  let behind = 0;
  const outcomes = OUTCOMES.map(() => 0);
  for (let i = 0; i < n; i++) {
    sum += net[i];
    sumSq += net[i] * net[i];
    sumAction += action[i];
    if (net[i] > 0) ahead++;
    else if (net[i] < 0) behind++;
    outcomes[outcome[i]]++;
  }
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  const avg = (arr) => arr.reduce((s, x) => s + x, 0) / n;
  return {
    sessions: n,
    mean,
    sd,
    se: sd / Math.sqrt(n),
    median: quantile(sorted, 0.5),
    p5: quantile(sorted, 0.05),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    p95: quantile(sorted, 0.95),
    best: sorted[n - 1],
    worst: sorted[0],
    ahead: ahead / n,
    behind: behind / n,
    even: (n - ahead - behind) / n,
    action: sumAction / n,
    edge: sumAction ? -sum / sumAction : 0,
    rolls: avg(rolls),
    maxDrawdown: avg(maxDrawdown),
    low: avg(low),
    outcomes: Object.fromEntries(OUTCOMES.map((o, i) => [o, outcomes[i] / n])),
  };
}

// 10th / 50th / 90th percentile of bankroll at each checkpoint, for the fan chart.
export function bands(paths, sessions, k) {
  const column = new Float64Array(sessions);
  const out = [];
  for (let c = 0; c < k; c++) {
    for (let i = 0; i < sessions; i++) column[i] = paths[i * k + c];
    column.sort();
    out.push({ p10: quantile(column, 0.1), p50: quantile(column, 0.5), p90: quantile(column, 0.9) });
  }
  return out;
}

// Indexes of the best, median and worst sessions (for replay).
export function notableSessions(net) {
  const order = Array.from(net.keys()).sort((a, b) => net[a] - net[b]);
  return { worst: order[0], median: order[Math.floor(order.length / 2)], best: order[order.length - 1] };
}
