// The craps table: bankroll, puck, shooter, bets, and the roll.
// Pure game logic with no page code, shared by the game, the simulator, and the tests.

import { BET_TYPES, parseKey } from './bets.js';
import {
  DEFAULT_RULES, POINTS, TRUE_ODDS, LAY_ODDS,
  maxOdds, maxLay, unitOf, roundUpTo, pay, exactPay, ratioText,
} from './rules.js';

const ok = () => ({ ok: true });
const fail = (error) => ({ ok: false, error });
export const money = (n) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const cents = (n) => `$${n.toFixed(2)}`;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a * b) / gcd(a, b);

export class CrapsTable {
  constructor(rules = {}, bankroll) {
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.bankroll = bankroll ?? this.rules.startingBankroll;
    this.point = null;
    this.bets = {}; // key → { key, type, number, dice?, amount, odds, working, fresh, vigPaid }
    this.shooter = { number: 1, rolls: 0, pointsMade: [] };
    this.atsNumbers = []; // numbers rolled since the last 7, for All/Tall/Small
    this.rollCount = 0;
  }

  static restore(data) {
    const t = Object.assign(new CrapsTable(), structuredClone(data));
    t.rules = { ...DEFAULT_RULES, ...data.rules }; // saves from before a rule was added get its default
    return t;
  }

  snapshot() {
    const { rules, bankroll, point, bets, shooter, atsNumbers, rollCount } = this;
    return structuredClone({ rules, bankroll, point, bets, shooter, atsNumbers, rollCount });
  }

  def(bet) {
    return BET_TYPES[bet.type];
  }

  label(betOrKey) {
    const bet = typeof betOrKey === 'string' ? { key: betOrKey, ...parseKey(betOrKey) } : betOrKey;
    return this.def(bet).label(bet);
  }

  // For come bets on a number this is whether the odds work; the flat always works.
  isWorking(bet) {
    return bet.working ?? this.def(bet).defaultWorking(this, bet);
  }

  totalOnTable() {
    return Object.values(this.bets).reduce((s, b) => s + b.amount + b.odds + b.vigPaid, 0);
  }

  // Min / max / proper-unit info for a bet's flat amount.
  limits(bet) {
    const def = this.def(bet);
    const ratio = def.ratio?.(this.rules, bet) ?? null;
    const unit = ratio ? unitOf(ratio) : 1;
    const multiple = def.multiple;
    const baseMin = roundUpTo(def.min(this.rules), multiple);
    const min = this.rules.allowImproper ? baseMin : roundUpTo(baseMin, unit); // $6 on the 6/8 at a $5 table
    return { min, baseMin, max: def.max(this.rules), unit, multiple, ratio };
  }

  // Odds info for a line bet, or null if it can't take odds right now.
  oddsInfo(bet) {
    const def = this.def(bet);
    const number = def.odds ? def.oddsNumber(this, bet) : null;
    if (!number) return null;
    const take = def.odds === 'take';
    const ratio = take ? TRUE_ODDS[number] : LAY_ODDS[number];
    const max = take ? maxOdds(this.rules, number, bet.amount) : maxLay(this.rules, number, bet.amount);
    return { number, ratio, unit: unitOf(ratio), max, take };
  }

  upfrontVig(bet, amount) {
    const f = this.def(bet).upfrontVig;
    return f ? f(this.rules, { ...bet, amount }) : 0;
  }

  setRules(rules) {
    if (Object.keys(this.bets).length) return fail('Take down all bets before changing house rules.');
    this.rules = { ...this.rules, ...rules };
    return ok();
  }

  placeBet(key, amount) {
    if (!Number.isInteger(amount) || amount <= 0) return fail('Bets are made in whole dollars.');
    const spec = parseKey(key);
    if (!spec) return fail('That isn\'t a bet on this table.');
    const def = BET_TYPES[spec.type];
    const bet = this.bets[key] ?? { key, ...spec, amount: 0, odds: 0, working: null, fresh: 0, vigPaid: 0 };
    const why = def.canPlace(this, bet);
    if (why) return fail(why);
    const conflict = (def.conflicts?.(bet) ?? []).find((k) => this.bets[k]);
    if (conflict) return fail(`Take down your ${this.label(conflict)} first. A number can be placed or bought, not both.`);
    const newAmount = bet.amount + amount;
    const { max } = this.limits(bet);
    if (newAmount > max) return fail(`${def.label(bet)} maximum is ${money(max)}.`);
    const vigDelta = this.upfrontVig(bet, newAmount) - bet.vigPaid;
    if (amount + vigDelta > this.bankroll) return fail('Not enough bankroll for that bet.');
    this.bankroll -= amount + vigDelta;
    bet.amount = newAmount;
    bet.fresh += amount;
    bet.vigPaid += vigDelta;
    this.bets[key] = bet;
    return ok();
  }

  // amount defaults to the whole bet (odds come down with it).
  removeBet(key, amount) {
    const bet = this.bets[key];
    if (!bet) return fail('There\'s no bet there.');
    const def = this.def(bet);
    const take = amount ?? bet.amount;
    const allowed = def.removable(this, bet);
    if (take > allowed) {
      return fail(allowed === 0 ? def.locked(this, bet) : `Only ${money(allowed)} of that bet can come down.`);
    }
    const newAmount = bet.amount - take;
    if (newAmount === 0) {
      this.bankroll += bet.amount + bet.odds + bet.vigPaid;
      delete this.bets[key];
      return ok();
    }
    const vigRefund = bet.vigPaid - this.upfrontVig(bet, newAmount);
    this.bankroll += take + vigRefund;
    bet.amount = newAmount;
    bet.fresh = Math.max(0, bet.fresh - take);
    bet.vigPaid -= vigRefund;
    // Odds can't be more than the max for the smaller flat bet.
    const info = this.oddsInfo(bet);
    if (info && bet.odds > info.max) {
      this.bankroll += bet.odds - info.max;
      bet.odds = info.max;
    }
    return ok();
  }

  placeOdds(key, amount) {
    if (!Number.isInteger(amount) || amount <= 0) return fail('Bets are made in whole dollars.');
    const bet = this.bets[key];
    if (!bet) return fail('Make the line bet first, then add odds.');
    const def = this.def(bet);
    if (!def.odds) return fail(`${def.label(bet)} doesn't take odds.`);
    const info = this.oddsInfo(bet);
    if (!info) {
      return fail(bet.type === 'come' || bet.type === 'dontCome'
        ? 'Odds go on once the bet moves to a number.'
        : 'Odds can be added once a point is set.');
    }
    if (bet.odds + amount > info.max) {
      return fail(`Max ${info.take ? 'odds' : 'lay'} on the ${info.number} is ${money(info.max)}.`);
    }
    if (amount > this.bankroll) return fail('Not enough bankroll for that bet.');
    this.bankroll -= amount;
    bet.odds += amount;
    return ok();
  }

  removeOdds(key, amount) {
    const bet = this.bets[key];
    if (!bet || !bet.odds) return fail('There are no odds on that bet.');
    const take = amount ?? bet.odds;
    if (take > bet.odds) return fail('That\'s more than the odds on the bet.');
    bet.odds -= take;
    this.bankroll += take;
    return ok();
  }

  toggleWorking(key) {
    const bet = this.bets[key];
    if (!bet) return fail('There\'s no bet there.');
    const def = this.def(bet);
    if (!def.toggle) return fail(`${def.label(bet)} is always working.`);
    const next = !this.isWorking(bet);
    bet.working = next === def.defaultWorking(this, bet) ? null : next;
    return ok();
  }

  // Problems with bets on the table. 'error' blocks the roll; 'warn' is a hint only.
  issues() {
    const out = [];
    for (const bet of Object.values(this.bets)) {
      const label = this.label(bet);
      const L = this.limits(bet);
      const add = (part, level, message) => out.push({ key: bet.key, part, level, message });
      // A $5 Place 6 gets the proper-units hint rather than "minimum is $6".
      if (bet.amount < L.baseMin) add('bet', 'error', `${label} minimum is ${money(L.min)}.`);
      else if (bet.amount % L.multiple) add('bet', 'error', `${label} is bet in ${money(L.multiple)} units (one per number).`);
      else if (bet.amount % L.unit) add('bet', ...this.improper(label, bet.amount, L.ratio));
      const info = this.oddsInfo(bet);
      if (info && bet.odds % info.unit) {
        add('odds', ...this.improper(`${info.take ? 'Odds' : 'Lay odds'} on ${label}`, bet.odds, info.ratio));
      }
    }
    return out;
  }

  improper(label, amount, ratio) {
    if (this.rules.allowImproper) {
      return ['warn', `Not proper units: ${money(amount)} on ${label} pays ${money(pay(amount, ratio))} instead of ${cents(exactPay(amount, ratio))}.`];
    }
    return ['error', `${label} pays ${ratioText(ratio)}. Bet in ${money(unitOf(ratio))} units.`];
  }

  canRoll() {
    return this.issues().every((i) => i.level !== 'error');
  }

  // Round a flagged bet (or its odds) to the nearest proper amount; remove it if nothing fits.
  fix(key, part = 'bet') {
    const bet = this.bets[key];
    if (!bet) return fail('There\'s no bet there.');
    if (part === 'odds') {
      const info = this.oddsInfo(bet);
      if (!info) return fail('That bet has no odds to fix.');
      for (const target of nearest(bet.odds, info.unit, 0, info.max)) {
        if (target === bet.odds) return ok();
        const res = target > bet.odds ? this.placeOdds(key, target - bet.odds) : this.removeOdds(key, bet.odds - target);
        if (res.ok) return ok();
      }
      return this.removeOdds(key);
    }
    const L = this.limits(bet);
    for (const target of nearest(bet.amount, lcm(L.unit, L.multiple), L.min, L.max)) {
      if (target === bet.amount) return ok();
      const res = target > bet.amount ? this.placeBet(key, target - bet.amount) : this.removeBet(key, bet.amount - target);
      if (res.ok) return ok();
    }
    return this.removeBet(key);
  }

  roll(d1, d2) {
    if (!this.canRoll()) throw new Error('Fix the flagged bets before rolling.');
    const total = d1 + d2;
    const dice = { d1, d2, total };
    const pointBefore = this.point;
    const ctx = {
      sevenOut: pointBefore != null && total === 7,
      pointMade: pointBefore != null && total === pointBefore,
    };
    ctx.newPoint = ctx.pointMade && !this.shooter.pointsMade.includes(total);

    const results = [];
    const moves = [];
    for (const bet of Object.values(this.bets)) {
      const def = this.def(bet);
      if (def.toggle === 'bet' && !this.isWorking(bet)) continue;
      const res = def.resolve(this, bet, dice, ctx);
      if (!res) continue;
      if (res.outcome === 'move') {
        moves.push([bet, res.to]);
        continue;
      }
      const r = {
        key: bet.key, label: def.label(bet), outcome: res.outcome, stake: bet.amount + bet.odds,
        win: res.win ?? 0, lost: res.lost ?? 0, returned: res.returned ?? 0,
      };
      this.bankroll += r.win + r.returned;
      if (res.down) delete this.bets[bet.key];
      else if (res.clearOdds) bet.odds = 0;
      results.push(r);
    }
    // Moves happen after resolving, so an old come bet on the same number is paid first.
    for (const [bet, to] of moves) {
      delete this.bets[bet.key];
      const moved = { ...bet, key: `${bet.type}:${to}`, number: to, odds: 0, working: null };
      this.bets[moved.key] = moved;
      results.push({ key: moved.key, from: bet.key, label: this.label(moved), outcome: 'move', to, win: 0, lost: 0, returned: 0 });
    }

    this.rollCount++;
    this.shooter.rolls++;
    if (pointBefore == null) {
      if (POINTS.includes(total)) this.point = total;
    } else if (ctx.pointMade) {
      if (ctx.newPoint) this.shooter.pointsMade.push(total);
      this.point = null;
    } else if (ctx.sevenOut) {
      this.point = null;
      this.shooter = { number: this.shooter.number + 1, rolls: 0, pointsMade: [] };
    }
    if (total === 7) this.atsNumbers = [];
    else if (!this.atsNumbers.includes(total)) this.atsNumbers.push(total);
    for (const bet of Object.values(this.bets)) bet.fresh = 0;

    return {
      d1, d2, total,
      pointBefore,
      point: this.point,
      pointSet: pointBefore == null && this.point != null,
      ...ctx,
      results,
      net: results.reduce((s, r) => s + r.win - r.lost, 0),
    };
  }
}

// Multiples of `step` in [min, max], nearest to `amount` first (ties round up).
function nearest(amount, step, min, max) {
  const lo = Math.floor(amount / step) * step;
  const hi = Math.ceil(amount / step) * step;
  const order = amount - lo < hi - amount ? [lo, hi] : [hi, lo];
  const floor = roundUpTo(min, step);
  return [...new Set(order.map((x) => Math.max(x, floor)))].filter((x) => x <= max);
}
