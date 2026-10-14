// Session stats and the recent-rolls strip.
import { money } from '../engine/table.js';

const WAYS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

export function newStats(bankroll) {
  return {
    start: bankroll, rolls: 0, shooters: 1, pointsSet: 0, pointsMade: 0, sevenOuts: 0,
    counts: Array(13).fill(0), action: 0, bestRoll: 0, worstRoll: 0,
  };
}

export function recordRoll(s, res) {
  s.rolls++;
  s.counts[res.total]++;
  if (res.pointSet) s.pointsSet++;
  if (res.pointMade) s.pointsMade++;
  if (res.sevenOut) {
    s.sevenOuts++;
    s.shooters++;
  }
  s.action += res.results.reduce((a, r) => a + (r.outcome === 'win' || r.outcome === 'lose' ? r.stake : 0), 0);
  s.bestRoll = Math.max(s.bestRoll, res.net);
  s.worstRoll = Math.min(s.worstRoll, res.net);
}

export function signed(n) {
  if (n > 0) return `+${money(n)}`;
  if (n < 0) return `−${money(-n)}`;
  return money(0);
}

export function signClass(n) {
  if (n > 0) return 'pos';
  if (n < 0) return 'neg';
  return '';
}

export function renderStats(el, s, table) {
  const pl = table.bankroll + table.totalOnTable() - s.start;
  const max = Math.max(1, ...s.counts);
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
  const bars = Object.keys(WAYS).map((n) => {
    const c = s.counts[n];
    const expected = (WAYS[n] / 36) * s.rolls;
    return `
      <div class="freq" title="${n}: rolled ${c} times, expected ${expected.toFixed(1)}">
        <span class="freq-bar${n === '7' ? ' seven' : ''}" style="height:${(100 * c) / max}%"></span>
        <span class="freq-exp" style="bottom:${Math.min(100, (100 * expected) / max)}%"></span>
        <span class="freq-n">${n}</span><span class="freq-c">${c}</span>
      </div>`;
  }).join('');
  el.innerHTML = `
    <h2>Session</h2>
    <dl class="stat-grid">
      <div><dt>Profit / loss</dt><dd class="${signClass(pl)}">${signed(pl)}</dd></div>
      <div><dt>Rolls</dt><dd>${s.rolls}</dd></div>
      <div><dt>Shooters</dt><dd>${s.shooters}</dd></div>
      <div><dt>Points made</dt><dd>${s.pointsMade} / ${s.pointsSet} <small>${pct(s.pointsMade, s.pointsSet)}</small></dd></div>
      <div><dt>Seven-outs</dt><dd>${s.sevenOuts}</dd></div>
      <div><dt>Rolls per shooter</dt><dd>${s.shooters ? (s.rolls / s.shooters).toFixed(1) : '—'}</dd></div>
      <div><dt>Total action</dt><dd>${money(s.action)}</dd></div>
      <div><dt>Best / worst roll</dt><dd><span class="pos">${signed(s.bestRoll)}</span> / <span class="neg">${signed(s.worstRoll)}</span></dd></div>
    </dl>
    <h3>How often each number rolled <small>(line = expected)</small></h3>
    <div class="freq-chart">${bars}</div>`;
}

export function renderHistory(el, history) {
  el.innerHTML = history.map((h) => {
    const cls = [
      h.total === 7 ? 'seven' : '',
      h.pointMade ? 'made' : '',
      h.pointSet ? 'set' : '',
      h.d1 === h.d2 ? 'hard' : '',
    ].join(' ');
    let what = '';
    if (h.sevenOut) what = ', seven out';
    else if (h.pointMade) what = ', point made';
    else if (h.pointSet) what = ', point set';
    return `<li class="h ${cls}" title="${h.d1} + ${h.d2}${what}" aria-label="${h.total} (${h.d1} and ${h.d2})${what}">${h.total}</li>`;
  }).join('');
}
