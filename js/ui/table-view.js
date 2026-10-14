// The felt: builds the table and center-props layout, then draws chips, pucks and markers.
import { money } from '../engine/table.js';
import {
  POINTS, PLACE_PAYS, TRUE_ODDS, LAY_ODDS, HARD_PAYS, ATS_NUMBERS,
  ratioText, numberBetPays, hopPays, atsPays,
} from '../engine/rules.js';

const CHIP_COLORS = [[1000, 'c1000'], [500, 'c500'], [100, 'c100'], [25, 'c25'], [5, 'c5'], [1, 'c1']];
const BOX_LABELS = { 4: '4', 5: '5', 6: 'SIX', 8: '8', 9: 'NINE', 10: '10' };
const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

export function chipColor(amount) {
  return CHIP_COLORS.find(([v]) => amount >= v)?.[1] ?? 'c1';
}

export function shortMoney(n) {
  return n >= 1000 ? `${+(n / 1000).toFixed(n % 1000 ? 1 : 0)}K` : String(n);
}

function chipHTML(amount, cls = '') {
  return `<span class="chip ${chipColor(amount)} ${cls}" aria-hidden="true">${shortMoney(amount)}</span>`;
}

export function dieHTML(n, cls = '') {
  let cells = '';
  for (let i = 1; i <= 9; i++) cells += `<i${PIPS[n].includes(i) ? ' class="pip"' : ''}></i>`;
  return `<span class="die ${cls}" aria-hidden="true">${cells}</span>`;
}

const pair = (a, b, cls = 'mini') => `<span class="pair">${dieHTML(a, cls)}${dieHTML(b, cls)}</span>`;

export function buildFelt(el, rules) {
  const bar = rules.barNumber === 12 ? pair(6, 6) : pair(1, 1);
  const boxes = POINTS.map((n) => `
    <div class="box" data-number="${n}" style="grid-area:n${n}">
      <button class="spot zone lay" data-key="lay:${n}" aria-label="Lay ${n}, pays ${ratioText(LAY_ODDS[n])} less 5% vig">
        <span class="zone-label">LAY</span><span class="chips"></span></button>
      <button class="spot zone place" data-key="place:${n}" aria-label="Place ${n}, pays ${ratioText(PLACE_PAYS[n])}">
        <span class="box-num${n === 6 || n === 9 ? ' word' : ''}">${BOX_LABELS[n]}</span><span class="chips"></span></button>
      <button class="spot zone buy" data-key="buy:${n}" aria-label="Buy ${n}, pays ${ratioText(TRUE_ODDS[n])} less 5% vig">
        <span class="zone-label">BUY</span><span class="chips"></span></button>
      <span class="box-line come" data-line="come:${n}"></span>
      <span class="box-line dc" data-line="dontCome:${n}"></span>
      <span class="puck-slot"></span>
    </div>`).join('');

  el.innerHTML = `
    <div class="felt-grid${rules.bigBets ? '' : ' no-big'}">
      <button class="spot dc-spot" data-key="dontCome" style="grid-area:dc" aria-label="Don't Come, bar ${rules.barNumber}">
        <span class="label">DON'T COME</span><span class="sub">BAR ${bar}</span>
        <span class="chips"></span><span class="puck-slot"></span></button>
      ${boxes}
      <button class="spot come-spot" data-key="come" style="grid-area:come" aria-label="Come">
        <span class="label">COME</span><span class="chips"></span></button>
      <button class="spot field-spot" data-key="field" style="grid-area:field"
        aria-label="Field: 3, 4, 9, 10, 11 pay even money, 2 pays 2 to 1, 12 pays ${rules.field12Pays} to 1">
        <span class="field-nums"><b class="ring">2</b><span>3</span><span>4</span><span>9</span><span>10</span><span>11</span><b class="ring">12</b></span>
        <span class="label">FIELD</span>
        <span class="sub">2 pays double · 12 pays ${rules.field12Pays === 3 ? 'triple' : 'double'}</span>
        <span class="chips"></span></button>
      <div class="dp-row" style="grid-area:dp">
        <button class="spot dp-spot" data-key="dontPass" aria-label="Don't Pass, bar ${rules.barNumber}">
          <span class="label">DON'T PASS BAR</span>${bar}<span class="chips"></span></button>
        <button class="spot odds-spot" data-odds="dontPass" aria-label="Lay odds on Don't Pass">
          <span class="zone-label">LAY ODDS</span><span class="chips"></span></button>
      </div>
      ${rules.bigBets ? `<div class="big-spot" style="grid-area:big">
        <button class="spot big6" data-key="big:6" aria-label="Big 6, even money"><span class="label">BIG</span><span class="big-num">6</span><span class="chips"></span></button>
        <button class="spot big8" data-key="big:8" aria-label="Big 8, even money"><span class="label">BIG</span><span class="big-num">8</span><span class="chips"></span></button>
      </div>` : ''}
      <div class="pass-row" style="grid-area:pass">
        <button class="spot pass-spot" data-key="pass" aria-label="Pass Line">
          <span class="label">PASS LINE</span><span class="chips"></span></button>
        <button class="spot odds-spot" data-odds="pass" aria-label="Odds on the Pass Line">
          <span class="zone-label">ODDS</span><span class="chips"></span></button>
      </div>
    </div>`;
}

export function buildProps(el, rules) {
  const prop = (key, inner, label, cls = '') =>
    `<button class="spot prop ${cls}" data-key="${key}" aria-label="${label}">${inner}<span class="chips"></span></button>`;
  const pays = (text) => `<span class="pays">${text}</span>`;

  const hardways = [6, 10, 8, 4].map((n) => prop(`hard:${n}`,
    `${pair(n / 2, n / 2)}<span class="name">HARD ${n}</span>${pays(`${HARD_PAYS[n][0]} to 1`)}`,
    `Hard ${n}, pays ${HARD_PAYS[n][0]} to 1`)).join('');
  const numbers = [[3, 1, 2, 'ACE-DEUCE'], [2, 1, 1, 'ACES'], [12, 6, 6, 'BOXCARS'], [11, 5, 6, 'YO']]
    .map(([n, a, b, name]) => prop(`num:${n}`,
      `${pair(a, b)}<span class="name">${name}</span>${pays(`${numberBetPays(rules, n)} to 1`)}`,
      `${name} ${n}, one roll, pays ${numberBetPays(rules, n)} to 1`)).join('');
  const hops = [];
  for (let a = 1; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      hops.push(prop(`hop:${a}-${b}`, `${pair(a, b)}${pays(`${hopPays(rules, a, b)}:1`)}`,
        `Hop ${a} and ${b}, one roll, pays ${hopPays(rules, a, b)} to 1`, 'hop'));
    }
  }
  const tracker = (id, nums) => `<span class="tracker" id="${id}">${nums.map((n) => `<i data-n="${n}">${n}</i>`).join('')}</span>`;
  const ats = (kind, name) => prop(kind,
    `<span class="name">${name.toUpperCase()}</span>${pays(`${atsPays(rules, kind)} to 1`)}`,
    `${name}: ${ATS_NUMBERS[kind].join(', ')} before a 7, pays ${atsPays(rules, kind)} to 1`);

  const atsOn = rules.atsPayTable !== 'off';
  const side = rules.fireBet || atsOn;
  el.innerHTML = `
    <div class="sheet-head"><h2>Center Action</h2><button class="icon-btn sheet-close" data-close aria-label="Close">✕</button></div>
    <div class="prop-group">
      ${prop('any7', `<span class="name">ANY SEVEN</span>${pays('4 to 1')}`, 'Any Seven, one roll, pays 4 to 1', 'wide seven')}
      <div class="prop-grid">${hardways}</div>
    </div>
    <div class="prop-group">
      <div class="prop-grid">${numbers}</div>
      ${prop('anyCraps', `<span class="name">ANY CRAPS</span>${pays('7 to 1')}`, 'Any Craps: 2, 3 or 12, one roll, pays 7 to 1', 'wide craps')}
    </div>
    <div class="prop-group">
      <div class="prop-grid three">
        ${prop('ce', `<span class="name">C &amp; E</span>${pays('2 units')}`, 'Craps and Eleven, 2 units')}
        ${prop('horn', `<span class="name">HORN</span>${pays('4 units')}`, 'Horn: 2, 3, 11, 12, 4 units')}
        ${prop('world', `<span class="name">WORLD</span>${pays('5 units')}`, 'World: horn plus any seven, 5 units')}
      </div>
      <div class="horn-high"><span class="hh-label">HORN HIGH</span>
        ${[2, 3, 11, 12].map((n) => prop(`hornHigh:${n}`, `<span class="name">${n}</span>`, `Horn high ${n}, 5 units`, 'hh')).join('')}
      </div>
      <details class="hops"><summary>Hop bets <small>easy ${hopPays(rules, 1, 2)}:1 · hard ${hopPays(rules, 1, 1)}:1</small></summary>
        <div class="hop-grid">${hops.join('')}</div></details>
    </div>
    ${side ? `<div class="prop-group side-group">
      <h2 class="side-title">Side Bets</h2>
      ${rules.fireBet ? prop('fire', `<span class="name">FIRE BET</span>${pays('4 pts 24 · 5 pts 249 · 6 pts 999 to 1')}${tracker('fire-tracker', POINTS)}`,
        'Fire Bet: different points made by this shooter, pays 24, 249 or 999 to 1', 'wide fire') : ''}
      ${atsOn ? `<div class="prop-grid three">${ats('small', 'Small')}${ats('tall', 'Tall')}${ats('all', 'All')}</div>
      <p class="ats-row">Rolled since last 7: ${tracker('ats-tracker', ATS_NUMBERS.all)}</p>` : ''}
    </div>` : ''}`;
  el.classList.toggle('no-side', !side);
}

// The element a bet lives on (for chips, issue outlines and win/lose markers).
function spotEl(key, part = 'bet') {
  // Only table spots: My Bets rows and the spot menu reuse data-key on their buttons.
  if (part === 'odds' && (key === 'pass' || key === 'dontPass')) return document.querySelector(`.spot[data-odds="${key}"]`);
  return document.querySelector(`.spot[data-key="${key}"]`) ?? document.querySelector(`[data-line="${key}"]`)?.closest('.box');
}

export function renderTable(table, issues) {
  document.querySelectorAll('.spot .chips, .box-line, .puck-slot').forEach((c) => { c.innerHTML = ''; });
  document.querySelectorAll('.issue-error, .issue-warn').forEach((s) => s.classList.remove('issue-error', 'issue-warn'));

  for (const bet of Object.values(table.bets)) {
    const def = table.def(bet);
    const working = table.isWorking(bet);
    if ((bet.type === 'come' || bet.type === 'dontCome') && bet.number) {
      const oddsCls = `odds${bet.type === 'come' && !working ? ' off' : ''}`;
      const what = bet.type === 'come' ? 'odds' : 'lay odds';
      document.querySelector(`[data-line="${bet.key}"]`).innerHTML = `
        <button class="line-chip" data-odds="${bet.key}" aria-label="${def.label(bet)} ${money(bet.amount)}${bet.odds ? ` with ${money(bet.odds)} ${what}` : ''}. Tap to add ${what}.">
          ${chipHTML(bet.amount)}${bet.odds ? chipHTML(bet.odds, oddsCls) : ''}</button>`;
      continue;
    }
    let cls = '';
    if (def.toggle === 'bet') cls = working ? (bet.working === true ? 'on' : '') : 'off';
    spotEl(bet.key).querySelector('.chips').innerHTML = chipHTML(bet.amount, cls);
    if (bet.odds && (bet.type === 'pass' || bet.type === 'dontPass')) {
      spotEl(bet.key, 'odds').querySelector('.chips').innerHTML = chipHTML(bet.odds, 'odds');
    }
  }

  for (const key of ['pass', 'dontPass']) {
    const bet = table.bets[key];
    spotEl(key, 'odds').classList.toggle('unavailable', !(bet && table.oddsInfo(bet)));
  }

  const puck = table.point
    ? [document.querySelector(`.box[data-number="${table.point}"] .puck-slot`), '<span class="puck on">ON</span>']
    : [document.querySelector('.dc-spot .puck-slot'), '<span class="puck off">OFF</span>'];
  puck[0].innerHTML = puck[1];

  for (const issue of issues) spotEl(issue.key, issue.part)?.classList.add(`issue-${issue.level}`);

  const made = new Set(table.shooter.pointsMade);
  document.querySelectorAll('#fire-tracker i').forEach((i) => i.classList.toggle('lit', made.has(+i.dataset.n)));
  const rolled = new Set(table.atsNumbers);
  document.querySelectorAll('#ats-tracker i').forEach((i) => i.classList.toggle('lit', rolled.has(+i.dataset.n)));
}

// Floating +$/−$ labels on each spot that won or lost this roll.
export function showMarkers(results) {
  for (const r of results) {
    if (r.outcome === 'move') continue;
    const el = spotEl(r.key);
    if (!el) continue;
    const m = document.createElement('span');
    m.className = `marker ${r.outcome}`;
    m.textContent = r.outcome === 'win' ? `+${money(r.win)}` : r.outcome === 'lose' ? `−${money(r.lost)}` : 'Push';
    el.append(m);
    setTimeout(() => m.remove(), 2500); // matches the float-up animation
  }
}

// Briefly light up the number box and/or field for the total rolled.
export function flashRoll(total) {
  const els = [document.querySelector(`.box[data-number="${total}"]`)];
  if ([2, 3, 4, 9, 10, 11, 12].includes(total)) els.push(document.querySelector('.field-spot'));
  for (const el of els.filter(Boolean)) {
    el.classList.remove('hit');
    void el.offsetWidth; // restart the animation
    el.classList.add('hit');
  }
}
