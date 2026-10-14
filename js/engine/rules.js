// House rules, payout ratios, and money helpers.
// All money is whole dollars (integers). Ratios are [pays, per]: [7, 6] means $7 paid per $6 bet.

export const POINTS = [4, 5, 6, 8, 9, 10];

export const DEFAULT_RULES = Object.freeze({
  tableMin: 5,
  tableMax: 5000,
  oddsMultiple: '345', // '1' | '2' | '3' | '345' | '5' | '10' | '20' | '100'
  field12Pays: 3, // 2 or 3 (the 2 always pays 2:1)
  barNumber: 12, // the don't-side push on the come-out: 12 or 2
  buyVig: 'win', // 'win' = 5% charged only when the bet wins, 'upfront' = charged when placed
  layVig: 'win',
  propsPay: 'to', // 'to' = 30 to 1 / 15 to 1, 'for' = 30 for 1 / 15 for 1 (one less)
  allowImproper: false, // allow bets that aren't in proper units (payouts round down)
  atsPayTable: '34-175', // All/Tall/Small: '34-175', '30-150' or 'off' (not offered)
  fireBet: true, // false = the table doesn't offer the Fire Bet
  bigBets: true, // false = no Big 6 / Big 8 (illegal in Atlantic City, gone from many layouts)
  startingBankroll: 1000,
});

export const ODDS_OPTIONS = ['1', '2', '3', '345', '5', '10', '20', '100'];

export const PLACE_PAYS = { 4: [9, 5], 5: [7, 5], 6: [7, 6], 8: [7, 6], 9: [7, 5], 10: [9, 5] };
export const TRUE_ODDS = { 4: [2, 1], 5: [3, 2], 6: [6, 5], 8: [6, 5], 9: [3, 2], 10: [2, 1] };
export const LAY_ODDS = { 4: [1, 2], 5: [2, 3], 6: [5, 6], 8: [5, 6], 9: [2, 3], 10: [1, 2] };
export const HARD_PAYS = { 4: [7, 1], 6: [9, 1], 8: [9, 1], 10: [7, 1] };
export const FIRE_PAYS = { 4: 24, 5: 249, 6: 999 };
export const ATS_NUMBERS = {
  small: [2, 3, 4, 5, 6],
  tall: [8, 9, 10, 11, 12],
  all: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
};

// Casino payout: anything that isn't a whole dollar is rounded down ("breakage").
export function pay(amount, [n, d]) {
  return Math.floor((amount * n) / d);
}

export function exactPay(amount, [n, d]) {
  return (amount * n) / d;
}

// Smallest bet that pays a whole dollar. Every ratio above is in lowest terms.
export function unitOf([, d]) {
  return d;
}

// 5% commission, rounded down, minimum $1 (a $25 buy pays $1).
export function vig(base) {
  return Math.max(1, Math.floor(base / 20));
}

export function roundUpTo(x, step) {
  return Math.ceil(x / step) * step;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export const lcm = (a, b) => (a * b) / gcd(a, b);

export function oddsMultiplier(rules, number) {
  if (rules.oddsMultiple === '345') return { 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3 }[number];
  return Number(rules.oddsMultiple);
}

// Max odds behind a pass/come bet, rounded up to an amount that pays evenly.
export function maxOdds(rules, number, flat) {
  return roundUpTo(oddsMultiplier(rules, number) * flat, unitOf(TRUE_ODDS[number]));
}

// Max lay behind a don't bet: whatever wins the same as max odds would.
export function maxLay(rules, number, flat) {
  const [n, d] = LAY_ODDS[number];
  const win = oddsMultiplier(rules, number) * flat;
  return roundUpTo(Math.ceil((win * d) / n), d);
}

// "for 1" layouts pay one less on the long-shot props (2, 3, 11, 12 and hops).
function longShot(rules, toOne) {
  return rules.propsPay === 'for' ? toOne - 1 : toOne;
}

export function numberBetPays(rules, total) {
  return longShot(rules, total === 2 || total === 12 ? 30 : 15);
}

export function hopPays(rules, a, b) {
  return longShot(rules, a === b ? 30 : 15);
}

export function fieldPays(rules, total) {
  if (total === 2) return 2;
  if (total === 12) return rules.field12Pays;
  return [3, 4, 9, 10, 11].includes(total) ? 1 : 0;
}

export function atsPays(rules, kind) {
  const [side, all] = rules.atsPayTable === '30-150' ? [30, 150] : [34, 175];
  return kind === 'all' ? all : side;
}

export function ratioText([n, d]) {
  return `${n} to ${d}`;
}
