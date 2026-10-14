// Every bet on the table, one entry per type.
// resolve(table, bet, dice, ctx) returns null (no action) or a result:
//   { outcome: 'win', win }                 paid; the bet stays up
//   { outcome: 'win', win, returned, down } paid and the bet comes down
//   { outcome: 'lose', lost, returned }     bet comes down (returned = odds that were off)
//   { outcome: 'push' }                     no action, bet stays
//   { outcome: 'move', to }                 come / don't come bet travels to a number
// `table` is the state *before* the roll.

import {
  POINTS, PLACE_PAYS, TRUE_ODDS, LAY_ODDS, HARD_PAYS, FIRE_PAYS, ATS_NUMBERS,
  pay, vig, numberBetPays, hopPays, fieldPays, atsPays, ratioText,
} from './rules.js';

const win = (amount) => ({ outcome: 'win', win: amount });
const winDown = (b, amount) => ({ outcome: 'win', win: amount, returned: b.amount + b.odds, down: true });
const lose = (b, returned = 0) => ({
  outcome: 'lose', lost: b.amount + b.odds + b.vigPaid - returned, returned, down: true,
});
const push = () => ({ outcome: 'push' });

const pointOn = (t) => t.point != null;
const always = () => true;
const CRAPS = [2, 3, 12];
const HORN = [2, 3, 11, 12];
const PROP_NAMES = { 2: 'Aces', 3: 'Ace-Deuce', 11: 'Yo', 12: 'Boxcars' };

const pass = {
  label: () => 'Pass Line',
  pays: () => '1 to 1',
  min: (r) => r.tableMin,
  odds: 'take',
  oddsNumber: (t) => t.point,
  removable: (t, b) => (pointOn(t) ? b.fresh : b.amount), // after the point, only chips added since the last roll
  locked: () => 'The Pass Line is a contract bet once the point is set. It can\'t come down.',
  hitWin: (t, b) => (pointOn(t) ? b.amount + pay(b.odds, TRUE_ODDS[t.point]) : b.amount),
  resolve(t, b, { total }) {
    if (!pointOn(t)) {
      if (total === 7 || total === 11) return win(b.amount);
      if (CRAPS.includes(total)) return lose(b);
      return null;
    }
    if (total === t.point) {
      return { outcome: 'win', win: this.hitWin(t, b), returned: b.odds, clearOdds: true };
    }
    return total === 7 ? lose(b) : null;
  },
};

const dontPass = {
  label: () => 'Don\'t Pass',
  pays: (r) => `1 to 1 · bar ${r.barNumber}`,
  min: (r) => r.tableMin,
  odds: 'lay',
  oddsNumber: (t) => t.point,
  canPlace: (t) => (pointOn(t) ? 'Don\'t Pass can only be bet on the come-out roll.' : null),
  hitWin: (t, b) => (pointOn(t) ? b.amount + pay(b.odds, LAY_ODDS[t.point]) : b.amount),
  resolve(t, b, { total }) {
    if (!pointOn(t)) {
      if (total === t.rules.barNumber) return push();
      if (CRAPS.includes(total)) return win(b.amount);
      if (total === 7 || total === 11) return lose(b);
      return null;
    }
    if (total === 7) {
      return { outcome: 'win', win: this.hitWin(t, b), returned: b.odds, clearOdds: true };
    }
    return total === t.point ? lose(b) : null;
  },
};

// A come bet with a number is either a come bet that travelled there or a put bet.
const come = {
  label: (b) => (b.number ? `Come ${b.number}` : 'Come'),
  pays: () => '1 to 1',
  min: (r) => r.tableMin,
  numbers: [null, ...POINTS],
  odds: 'take',
  oddsNumber: (t, b) => b.number,
  toggle: 'odds', // On/Off applies to the odds; the flat bet always works
  defaultWorking: pointOn,
  canPlace(t, b) {
    if (pointOn(t)) return null;
    return b.number
      ? 'Put bets can only be made after a point is set.'
      : 'Come bets start once a point is set. On the come-out, bet the Pass Line.';
  },
  removable: (t, b) => (b.number ? b.fresh : b.amount),
  locked: (t, b) => `Come ${b.number} is a contract bet. It can't come down, but its odds can.`,
  hitWin: (t, b) => b.amount + (b.number ? pay(b.odds, TRUE_ODDS[b.number]) : 0),
  resolve(t, b, { total }) {
    if (!b.number) {
      if (total === 7) return winDown(b, b.amount); // only happens on a seven-out, so it comes down
      if (total === 11) return win(b.amount);
      if (CRAPS.includes(total)) return lose(b);
      return { outcome: 'move', to: total };
    }
    const oddsOn = t.isWorking(b);
    if (total === b.number) return winDown(b, b.amount + (oddsOn ? pay(b.odds, TRUE_ODDS[b.number]) : 0));
    if (total === 7) return oddsOn ? lose(b) : lose(b, b.odds);
    return null;
  },
};

const dontCome = {
  label: (b) => (b.number ? `Don't Come ${b.number}` : 'Don\'t Come'),
  pays: (r) => `1 to 1 · bar ${r.barNumber}`,
  min: (r) => r.tableMin,
  numbers: [null, ...POINTS],
  odds: 'lay',
  oddsNumber: (t, b) => b.number,
  canPlace(t, b) {
    if (b.number) return 'Don\'t Come bets have to start in the Don\'t Come box.';
    return pointOn(t) ? null : 'Don\'t Come bets start once a point is set. On the come-out, bet Don\'t Pass.';
  },
  hitWin: (t, b) => b.amount + (b.number ? pay(b.odds, LAY_ODDS[b.number]) : 0),
  resolve(t, b, { total }) {
    if (!b.number) {
      if (total === t.rules.barNumber) return push();
      if (CRAPS.includes(total)) return win(b.amount);
      if (total === 7 || total === 11) return lose(b);
      return { outcome: 'move', to: total };
    }
    if (total === 7) return winDown(b, this.hitWin(t, b));
    return total === b.number ? lose(b) : null;
  },
};

const place = {
  label: (b) => `Place ${b.number}`,
  pays: (r, b) => ratioText(PLACE_PAYS[b.number]),
  min: (r) => r.tableMin,
  numbers: POINTS,
  ratio: (r, b) => PLACE_PAYS[b.number],
  toggle: 'bet',
  defaultWorking: pointOn,
  conflicts: (b) => [`buy:${b.number}`],
  hitWin: (t, b) => pay(b.amount, PLACE_PAYS[b.number]),
  resolve(t, b, { total }) {
    if (total === b.number) return win(this.hitWin(t, b));
    return total === 7 ? lose(b) : null;
  },
};

// Buy: true odds, 5% of the bet as commission. With vig up front, a win pays
// the next decision's vig out of the winnings, so the credited win is the same.
const buy = {
  label: (b) => `Buy ${b.number}`,
  pays: (r, b) => `${ratioText(TRUE_ODDS[b.number])} less 5% vig`,
  min: (r) => r.tableMin,
  numbers: POINTS,
  ratio: (r, b) => TRUE_ODDS[b.number],
  toggle: 'bet',
  defaultWorking: pointOn,
  conflicts: (b) => [`place:${b.number}`],
  upfrontVig: (r, b) => (r.buyVig === 'upfront' ? vig(b.amount) : 0),
  hitWin: (t, b) => pay(b.amount, TRUE_ODDS[b.number]) - vig(b.amount),
  resolve(t, b, { total }) {
    if (total === b.number) return win(this.hitWin(t, b));
    return total === 7 ? lose(b) : null;
  },
};

// Lay: true odds against the number, 5% of the win as commission.
const lay = {
  label: (b) => `Lay ${b.number}`,
  pays: (r, b) => `${ratioText(LAY_ODDS[b.number])} less 5% vig`,
  min: (r) => r.tableMin,
  numbers: POINTS,
  ratio: (r, b) => LAY_ODDS[b.number],
  toggle: 'bet',
  defaultWorking: always,
  upfrontVig: (r, b) => (r.layVig === 'upfront' ? vig(pay(b.amount, LAY_ODDS[b.number])) : 0),
  hitWin(t, b) {
    const w = pay(b.amount, LAY_ODDS[b.number]);
    return w - vig(w);
  },
  resolve(t, b, { total }) {
    if (total === 7) return win(this.hitWin(t, b));
    return total === b.number ? lose(b) : null;
  },
};

const big = {
  label: (b) => `Big ${b.number}`,
  pays: () => '1 to 1',
  offered: (r) => r.bigBets,
  min: (r) => r.tableMin,
  numbers: [6, 8],
  toggle: 'bet',
  defaultWorking: always,
  hitWin: (t, b) => b.amount,
  resolve(t, b, { total }) {
    if (total === b.number) return win(this.hitWin(t, b));
    return total === 7 ? lose(b) : null;
  },
};

const hard = {
  label: (b) => `Hard ${b.number}`,
  pays: (r, b) => ratioText(HARD_PAYS[b.number]),
  numbers: [4, 6, 8, 10],
  toggle: 'bet',
  defaultWorking: pointOn,
  hitWin: (t, b) => pay(b.amount, HARD_PAYS[b.number]),
  resolve(t, b, { d1, d2, total }) {
    if (total === b.number && d1 === d2) return win(this.hitWin(t, b));
    return total === b.number || total === 7 ? lose(b) : null;
  },
};

// One-roll bets: net(rules, bet, dice) returns the win, 0 for a push, or null for a loss.
function oneRoll(spec) {
  return {
    ...spec,
    resolve(t, b, dice) {
      const w = spec.net(t.rules, b, dice);
      if (w == null) return lose(b);
      return w === 0 ? push() : win(w);
    },
  };
}

const field = oneRoll({
  label: () => 'Field',
  pays: (r) => `1 to 1 · 2 pays 2 to 1 · 12 pays ${r.field12Pays} to 1`,
  min: (r) => r.tableMin,
  net(r, b, { total }) {
    const k = fieldPays(r, total);
    return k ? b.amount * k : null;
  },
});

const any7 = oneRoll({
  label: () => 'Any Seven',
  pays: () => '4 to 1',
  hitWin: (t, b) => b.amount * 4,
  net: (r, b, { total }) => (total === 7 ? b.amount * 4 : null),
});

const anyCraps = oneRoll({
  label: () => 'Any Craps',
  pays: () => '7 to 1',
  hitWin: (t, b) => b.amount * 7,
  net: (r, b, { total }) => (CRAPS.includes(total) ? b.amount * 7 : null),
});

const num = oneRoll({
  label: (b) => `${PROP_NAMES[b.number]} (${b.number})`,
  pays: (r, b) => `${numberBetPays(r, b.number)} to 1`,
  numbers: HORN,
  hitWin: (t, b) => b.amount * numberBetPays(t.rules, b.number),
  net: (r, b, { total }) => (total === b.number ? b.amount * numberBetPays(r, total) : null),
});

// Horn: one unit each on 2, 3, 11 and 12. The winning unit is paid, the other three lose.
const horn = oneRoll({
  label: () => 'Horn',
  pays: (r) => `2 & 12 net ${numberBetPays(r, 2) - 3}u · 3 & 11 net ${numberBetPays(r, 3) - 3}u`,
  multiple: 4,
  net(r, b, { total }) {
    if (!HORN.includes(total)) return null;
    const u = b.amount / 4;
    return u * numberBetPays(r, total) - 3 * u;
  },
});

// Horn High: a horn bet with an extra unit on one number (5 units).
const hornHigh = oneRoll({
  label: (b) => `Horn High ${b.number}`,
  pays: () => 'Horn with 2 units on the high number',
  multiple: 5,
  numbers: HORN,
  net(r, b, { total }) {
    if (!HORN.includes(total)) return null;
    const u = b.amount / 5;
    const units = total === b.number ? 2 : 1;
    return u * units * numberBetPays(r, total) - (5 - units) * u;
  },
});

// World (Whirl): horn + any seven, 5 units. A 7 pays 4 to 1 on one unit, which offsets the rest: a push.
const world = oneRoll({
  label: () => 'World',
  pays: () => 'Horn + Any Seven · 7 pushes',
  multiple: 5,
  net(r, b, { total }) {
    const u = b.amount / 5;
    if (total === 7) return 0;
    return HORN.includes(total) ? u * numberBetPays(r, total) - 4 * u : null;
  },
});

// C&E: half on any craps, half on 11.
const ce = oneRoll({
  label: () => 'C & E',
  pays: (r) => `Craps net 3 to 1 · 11 net ${(numberBetPays(r, 11) - 1) / 2} to 1`,
  multiple: 2,
  net(r, b, { total }) {
    const u = b.amount / 2;
    if (CRAPS.includes(total)) return u * 7 - u;
    return total === 11 ? u * numberBetPays(r, 11) - u : null;
  },
});

const hop = oneRoll({
  label: (b) => `Hop ${b.dice[0]}-${b.dice[1]}`,
  pays: (r, b) => `${hopPays(r, ...b.dice)} to 1`,
  hitWin: (t, b) => b.amount * hopPays(t.rules, ...b.dice),
  net(r, b, { d1, d2 }) {
    const [a, c] = b.dice;
    const hit = (d1 === a && d2 === c) || (d1 === c && d2 === a);
    return hit ? b.amount * hopPays(r, a, c) : null;
  },
});

// Fire Bet: pays on the seven-out for 4+ different points made, or at once on the 6th.
const fire = {
  label: () => 'Fire Bet',
  offered: (r) => r.fireBet,
  pays: () => '4 pts 24 to 1 · 5 pts 249 to 1 · 6 pts 999 to 1',
  max: () => 5,
  canPlace: (t) => (t.shooter.rolls === 0 && !pointOn(t) ? null : 'The Fire Bet can only be made before a new shooter\'s first roll.'),
  removable: (t, b) => (t.shooter.rolls === 0 ? b.amount : 0),
  locked: () => 'The Fire Bet can\'t come down once the shooter has rolled.',
  resolve(t, b, dice, ctx) {
    const made = t.shooter.pointsMade.length;
    if (ctx.sevenOut) return made >= 4 ? winDown(b, b.amount * FIRE_PAYS[made]) : lose(b);
    if (ctx.newPoint && made + 1 === 6) return winDown(b, b.amount * FIRE_PAYS[6]);
    return null;
  },
};

// All / Tall / Small: every number in the group rolls before a 7.
function ats(kind, name) {
  return {
    label: () => name,
    pays: (r) => `${atsPays(r, kind)} to 1`,
    offered: (r) => r.atsPayTable !== 'off',
    max: () => 25,
    canPlace: (t) => (t.atsNumbers.length === 0 ? null : 'All/Tall/Small can only be bet after a 7, before any other number rolls.'),
    removable: (t, b) => (t.atsNumbers.length === 0 ? b.amount : 0),
    locked: () => 'All/Tall/Small can\'t come down once numbers have rolled.',
    hitWin: (t, b) => b.amount * atsPays(t.rules, kind),
    resolve(t, b, { total }) {
      if (total === 7) return lose(b);
      const hit = new Set([...t.atsNumbers, total]);
      return ATS_NUMBERS[kind].every((n) => hit.has(n)) ? winDown(b, b.amount * atsPays(t.rules, kind)) : null;
    },
  };
}

const DEFAULTS = {
  offered: () => true, // false when the house rules leave this bet off the table
  min: () => 1,
  max: (r) => r.tableMax,
  multiple: 1,
  numbers: [null],
  canPlace: () => null,
  removable: (t, b) => b.amount,
  locked: (t, b) => `${b.key} can't come down right now.`,
  defaultWorking: always,
};

export const BET_TYPES = Object.fromEntries(
  Object.entries({
    pass, dontPass, come, dontCome, place, buy, lay, big, hard,
    field, any7, anyCraps, num, horn, hornHigh, world, ce, hop,
    fire, small: ats('small', 'Small'), tall: ats('tall', 'Tall'), all: ats('all', 'All'),
  }).map(([type, def]) => [type, { ...DEFAULTS, ...def }]),
);

// 'place:6' → { type: 'place', number: 6 }; 'hop:1-4' → { type: 'hop', number: null, dice: [1, 4] }
// Results are cached (the simulator parses the same few keys every roll); treat them as read-only.
const parsed = new Map();
export function parseKey(key) {
  if (!parsed.has(key)) parsed.set(key, parseKeyUncached(key));
  return parsed.get(key);
}

function parseKeyUncached(key) {
  const [type, arg] = String(key).split(':');
  const def = BET_TYPES[type];
  if (!def) return null;
  if (type === 'hop') {
    const dice = (arg ?? '').split('-').map(Number);
    const valid = dice.length === 2 && dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6) && dice[0] <= dice[1];
    return valid ? { type, number: null, dice } : null;
  }
  const number = arg === undefined ? null : Number(arg);
  return def.numbers.includes(number) ? { type, number } : null;
}
