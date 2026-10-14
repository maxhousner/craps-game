// Strategies as data, and the runner that plays them on a CrapsTable.
// Used by the simulator (thousands of sessions) and by autoplay on the game table.
//
// A strategy is { name, notes?, plans: [plan, ...] }. Each plan manages one kind of bet:
//   { bet: 'pass', amount: 10, odds: 'max' }
//   { bet: 'come', amount: 10, count: 2, odds: 'max', oddsOnComeOut: false }
//   { bet: 'place', numbers: [6, 8], amount: 12, when: 'point', skipPoint: false, comeOutOn: false }
//   { bet: 'field', amount: 5, when: 'always' }
//   ...plus an optional progression on any plan except side bets:
//   { onWin: 'same' | 'press' | 'halfPress' | 'addUnit' | 'reset' | 'regress' | 'ladder',
//     every: 1, regressTo: 6, ladder: [12, 18, 24], resetAfter: 0,
//     onLoss: 'reset' | 'same' | 'double' | 'addUnit', max: 0 }

import { POINTS, roundUpTo, lcm } from '../engine/rules.js';
import { BET_TYPES, parseKey } from '../engine/bets.js';
import { money } from '../engine/table.js';

export const BET_KINDS = {
  pass: { label: 'Pass Line', group: 'line' },
  dontPass: { label: 'Don\'t Pass', group: 'line' },
  come: { label: 'Come', group: 'come' },
  dontCome: { label: 'Don\'t Come', group: 'come' },
  place: { label: 'Place', group: 'number', numbers: POINTS },
  buy: { label: 'Buy', group: 'number', numbers: POINTS },
  lay: { label: 'Lay', group: 'number', numbers: POINTS },
  hard: { label: 'Hardways', group: 'number', numbers: [4, 6, 8, 10] },
  big: { label: 'Big 6 / 8', group: 'number', numbers: [6, 8] },
  field: { label: 'Field', group: 'oneRoll' },
  any7: { label: 'Any Seven', group: 'oneRoll' },
  anyCraps: { label: 'Any Craps', group: 'oneRoll' },
  num: { label: '2 / 3 / 11 / 12', group: 'oneRoll', numbers: [2, 3, 11, 12] },
  horn: { label: 'Horn', group: 'oneRoll' },
  world: { label: 'World', group: 'oneRoll' },
  ce: { label: 'C & E', group: 'oneRoll' },
  fire: { label: 'Fire Bet', group: 'side' },
  small: { label: 'Small', group: 'side' },
  tall: { label: 'Tall', group: 'side' },
  all: { label: 'All', group: 'side' },
};

// The table keys a plan manages.
export function planKeys(plan) {
  const { group, numbers } = BET_KINDS[plan.bet];
  if (group === 'number' || numbers) return (plan.numbers ?? []).map((n) => `${plan.bet}:${n}`);
  return [plan.bet];
}

// Plain-English problems with a strategy (empty list = OK to run).
export function validateStrategy(s) {
  const errors = [];
  if (!s.name?.trim()) errors.push('Give the strategy a name.');
  if (!s.plans?.length) errors.push('Add at least one bet.');
  const seen = new Map();
  for (const plan of s.plans ?? []) {
    const kind = BET_KINDS[plan.bet];
    if (!kind) {
      errors.push(`Unknown bet "${plan.bet}".`);
      continue;
    }
    if (!(Number.isInteger(plan.amount) && plan.amount >= 1)) errors.push(`${kind.label}: the amount must be a whole number of dollars.`);
    if (kind.numbers && !plan.numbers?.length) errors.push(`${kind.label}: pick at least one number.`);
    if (kind.group === 'come' && !(plan.count >= 1 && plan.count <= 6)) errors.push(`${kind.label}: keep 1 to 6 bets working.`);
    for (const key of planKeys(plan)) {
      const twin = key.startsWith('place:') ? key.replace('place', 'buy') : key.startsWith('buy:') ? key.replace('buy', 'place') : null;
      if (seen.has(key)) errors.push(`${labelFor(key)} is in two bet rows. Each bet can only be in one.`);
      else if (twin && seen.has(twin)) errors.push(`The ${key.split(':')[1]} can be placed or bought, not both.`);
      seen.set(key, true);
    }
  }
  return errors;
}

function labelFor(key) {
  const [bet, n] = key.split(':');
  return n ? `${BET_KINDS[bet].label.replace(/s$/, '')} ${n}` : BET_KINDS[bet].label;
}

// A note naming the strategy's bets that these house rules don't offer (the runner skips them), or ''.
export function unofferedNote(strategy, rules) {
  const off = strategy.plans.filter((p) => BET_TYPES[p.bet] && !BET_TYPES[p.bet].offered(rules)).map((p) => BET_KINDS[p.bet].label);
  if (!off.length) return '';
  return off.length === 1
    ? `${off[0]} isn't offered under these house rules, so it's skipped.`
    : `${off.join(' and ')} aren't offered under these house rules, so they're skipped.`;
}

const ORDINAL = (n) => (n === 1 ? '' : n === 2 ? '2nd ' : n === 3 ? '3rd ' : `${n}th `);

function describeProgression(p, plan) {
  if (!p) return '';
  const parts = [];
  const every = p.every > 1 ? `every ${ORDINAL(p.every)}win` : 'every win';
  if (p.onWin === 'press') parts.push(`press ${every}`);
  else if (p.onWin === 'halfPress') parts.push(`half-press ${every}`);
  else if (p.onWin === 'addUnit') parts.push(`add ${money(plan.amount)} ${every}`);
  else if (p.onWin === 'reset') parts.push('back to base after a win');
  else if (p.onWin === 'regress') parts.push(`drop to ${money(p.regressTo)} after the first win`);
  else if (p.onWin === 'ladder') parts.push(`ladder ${[plan.amount, ...(p.ladder ?? [])].map(money).join(' → ')}`);
  if (p.resetAfter) parts.push(`start over after ${p.resetAfter} wins in a row`);
  if (p.onLoss === 'double') parts.push('double after a loss');
  else if (p.onLoss === 'addUnit') parts.push(`add ${money(plan.amount)} after a loss`);
  else if (p.onLoss === 'same') parts.push('same bet after a loss');
  if (p.max) parts.push(`max ${money(p.max)}`);
  return parts.join(', ');
}

const ODDS_TEXT = (odds, lay) => (!odds || odds === 'none' ? '' : odds === 'max' ? ` + max ${lay ? 'lay ' : ''}odds` : ` + ${odds}x ${lay ? 'lay ' : ''}odds`);
const WHEN_TEXT = { always: 'every roll', point: 'while a point is on', comeOut: 'on come-out rolls' };

// One line of plain English per plan, for strategy cards and the autoplay picker.
export function describePlan(plan) {
  const kind = BET_KINDS[plan.bet];
  const amt = money(plan.amount);
  let text;
  switch (kind.group) {
    case 'line':
      text = `${kind.label} ${amt}${ODDS_TEXT(plan.odds, plan.bet === 'dontPass')}`;
      break;
    case 'come':
      text = `Up to ${plan.count} ${kind.label} bet${plan.count > 1 ? 's' : ''} ${amt}${ODDS_TEXT(plan.odds, plan.bet === 'dontCome')}`;
      if (plan.oddsOnComeOut) text += ', odds working on the come-out';
      break;
    case 'number':
      text = `${kind.label} ${plan.numbers.join(', ')} · ${amt} each ${plan.when === 'always' ? 'from the come-out' : 'after the point'}`;
      if (plan.skipPoint) text += ', skipping the point';
      if (plan.comeOutOn) text += ', working on the come-out';
      break;
    case 'oneRoll':
      text = `${plan.numbers ? `${plan.numbers.join(', ')} (one roll)` : kind.label} ${amt} ${WHEN_TEXT[plan.when ?? 'always']}`;
      break;
    default:
      text = `${kind.label} ${amt}${plan.bet === 'fire' ? ' for each new shooter' : ' after each 7'}`;
  }
  const prog = describeProgression(plan.progression, plan);
  return prog ? `${text} · ${prog}` : text;
}

// Round to an amount the table accepts: proper units (unless allowed off), table min and max.
export function properAmount(table, key, amount) {
  if (amount <= 0) return 0;
  const L = table.limits({ key, ...parseKey(key) });
  const step = table.rules.allowImproper ? L.multiple : lcm(L.unit, L.multiple);
  const x = Math.max(Math.round(amount / step) * step, roundUpTo(L.min, step));
  return Math.min(x, Math.floor(L.max / step) * step);
}

// Odds behind a line bet for a plan's odds setting ('none' | 'max' | multiple of the flat bet).
// On the don't side, "2x" means lay enough to win 2x the flat bet.
function oddsTarget(table, bet, setting) {
  const info = table.oddsInfo(bet);
  if (!info || !setting || setting === 'none') return 0;
  let target = info.max;
  if (setting !== 'max') {
    const [n, d] = info.ratio;
    target = Math.min(info.max, info.take ? setting * bet.amount : Math.ceil((setting * bet.amount * d) / n));
  }
  return Math.floor(target / info.unit) * info.unit;
}

export function createRunner(strategy) {
  // Work out each plan's table keys and press state once, not on every roll.
  const plans = strategy.plans.map((plan) => {
    const { group } = BET_KINDS[plan.bet];
    return {
      plan,
      group,
      keys: planKeys(plan).map((key) => [Number(key.split(':')[1]), key]),
      comeKeys: group === 'come' ? POINTS.map((n) => `${plan.bet}:${n}`) : [],
      states: new Map(), // progress key → { amount, wins, regressed }
    };
  });
  const owners = new Map(); // table key → [plan info, progress key]
  for (const info of plans) {
    if (info.group === 'line' || info.group === 'come') {
      owners.set(info.plan.bet, [info, 'flat']);
      for (const key of info.comeKeys) owners.set(key, [info, 'flat']);
    } else {
      for (const [, key] of info.keys) owners.set(key, [info, key]);
    }
  }
  const stateOf = (info, key) => {
    let state = info.states.get(key);
    if (!state) info.states.set(key, (state = { amount: info.plan.amount, wins: 0, regressed: false }));
    return state;
  };

  // Move the bet at `key` to `target` dollars. Returns false if the bankroll ran short.
  function ensure(table, key, target, log) {
    const cur = table.bets[key]?.amount ?? 0;
    if (target === cur) return true;
    if (target > cur) {
      const res = table.placeBet(key, target - cur);
      if (res.ok) log?.(cur ? `${table.label(key)} ${money(cur)} → ${money(target)}` : `${table.label(key)} ${money(target)}`);
      return res.ok || !res.error.includes('bankroll');
    }
    const res = table.removeBet(key, target === 0 ? undefined : cur - target);
    if (res.ok) log?.(target ? `${table.label(key)} ${money(cur)} → ${money(target)}` : `Take down ${table.label(key)}`);
    return true;
  }

  function ensureOdds(table, key, target, log) {
    const bet = table.bets[key];
    if (!bet || target === bet.odds) return true;
    if (target > bet.odds) {
      const res = table.placeOdds(key, target - bet.odds);
      if (res.ok) log?.(`Odds on ${table.label(key)} ${money(target)}`);
      return res.ok || !res.error.includes('bankroll');
    }
    table.removeOdds(key, bet.odds - target);
    return true;
  }

  // Place / adjust this roll's bets. Returns { short } (true if the bankroll couldn't cover a bet).
  function decide(table, log = null) {
    let short = false;
    const ok = (result) => {
      if (!result) short = true;
    };
    const point = table.point;
    for (const info of plans) {
      const { plan, group } = info;
      if (group === 'line') {
        if (point == null) ok(ensure(table, plan.bet, properAmount(table, plan.bet, stateOf(info, 'flat').amount), log));
        else if (table.bets[plan.bet]) ok(ensureOdds(table, plan.bet, oddsTarget(table, table.bets[plan.bet], plan.odds), log));
      } else if (group === 'come') {
        const onNumbers = info.comeKeys.filter((key) => table.bets[key]);
        if (point != null && !table.bets[plan.bet] && onNumbers.length < plan.count) {
          ok(ensure(table, plan.bet, properAmount(table, plan.bet, stateOf(info, 'flat').amount), log));
        }
        for (const key of onNumbers) {
          ok(ensureOdds(table, key, oddsTarget(table, table.bets[key], plan.odds), log));
          if (plan.oddsOnComeOut && table.bets[key].odds && !table.isWorking(table.bets[key])) table.toggleWorking(key);
        }
      } else if (group === 'number') {
        const active = plan.when === 'always' || point != null;
        for (const [n, key] of info.keys) {
          if (plan.skipPoint && point === n) {
            ensure(table, key, 0, log);
            continue;
          }
          if (active) ok(ensure(table, key, properAmount(table, key, stateOf(info, key).amount), log));
          const bet = table.bets[key];
          if (plan.comeOutOn && bet && !table.isWorking(bet)) table.toggleWorking(key);
        }
      } else if (group === 'oneRoll') {
        const when = plan.when ?? 'always';
        const active = when === 'always' || (when === 'point' ? point != null : point == null);
        for (const [, key] of info.keys) {
          ok(ensure(table, key, active ? properAmount(table, key, stateOf(info, key).amount) : 0, log));
        }
      } else if (!table.bets[plan.bet]) {
        // Side bets: Fire at the start of each shooter, All/Tall/Small after each 7.
        const open = plan.bet === 'fire' ? table.shooter.rolls === 0 && point == null : table.atsNumbers.length === 0;
        if (open) ok(ensure(table, plan.bet, properAmount(table, plan.bet, plan.amount), log));
      }
    }
    return { short };
  }

  // Update presses / progressions from a roll's results.
  function record(rollResult, table) {
    for (const r of rollResult.results) {
      if (r.outcome !== 'win' && r.outcome !== 'lose') continue;
      const owner = owners.get(r.key);
      if (!owner) continue;
      const [info, progKey] = owner;
      const { plan } = info;
      if (!plan.progression || info.group === 'side') continue;
      const state = stateOf(info, progKey);
      step(plan.progression, state, plan.amount, r.outcome);
      state.amount = properAmount(table, progKey === 'flat' ? plan.bet : progKey, state.amount);
    }
  }

  return { decide, record };
}

// One progression step after a win or loss.
function step(p, s, base, outcome) {
  const max = p.max || Infinity;
  if (outcome === 'win') {
    s.wins++;
    if (p.resetAfter && s.wins >= p.resetAfter) {
      s.amount = base;
      s.wins = 0;
      return;
    }
    if (s.wins % (p.every || 1) !== 0) return;
    const presses = s.wins / (p.every || 1);
    switch (p.onWin) {
      case 'press': s.amount *= 2; break;
      case 'halfPress': s.amount *= 1.5; break;
      case 'addUnit': s.amount += base; break;
      case 'reset': s.amount = base; break;
      case 'regress':
        if (!s.regressed) s.amount = p.regressTo ?? base;
        s.regressed = true;
        break;
      case 'ladder': s.amount = p.ladder?.[Math.min(presses, p.ladder.length) - 1] ?? s.amount; break;
      default: break;
    }
    s.amount = Math.min(s.amount, max);
    return;
  }
  s.wins = 0;
  s.regressed = false;
  if (p.onLoss === 'double') s.amount = s.amount * 2 > max ? base : s.amount * 2; // Martingale: start over at the cap
  else if (p.onLoss === 'addUnit') s.amount = Math.min(s.amount + base, max);
  else if (p.onLoss !== 'same') s.amount = base;
}
