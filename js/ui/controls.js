// Chip rack, dice, the stickman's call, the My Bets list, the spot menu, issues, toasts and sheets.
import { money } from '../engine/table.js';
import { parseKey } from '../engine/bets.js';
import { chipColor, shortMoney, dieHTML } from './table-view.js';
import { topic, topicFor, topicHTML } from '../help-content.js';

export const CHIP_VALUES = [1, 5, 25, 100, 500, 1000];

export function renderChipRack(el, selected) {
  el.innerHTML = CHIP_VALUES.map((v, i) => `
    <button class="rack-chip chip ${chipColor(v)}${v === selected ? ' selected' : ''}" data-chip="${v}"
      role="radio" aria-checked="${v === selected}" aria-label="$${v} chip (key ${i + 1})">${shortMoney(v)}</button>`).join('');
}

export function showDice(el, d1, d2) {
  el.innerHTML = dieHTML(d1, 'big') + dieHTML(d2, 'big');
}

// Tumble random faces for ~0.8s, then land on the real roll.
export function animateDice(el, d1, d2, fast) {
  if (fast || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showDice(el, d1, d2);
    return Promise.resolve();
  }
  const face = () => 1 + Math.floor(Math.random() * 6); // looks only; the real roll is already decided
  return new Promise((resolve) => {
    const start = performance.now();
    el.classList.add('rolling');
    const tick = () => {
      if (performance.now() - start < 800) {
        showDice(el, face(), face());
        setTimeout(tick, 70);
        return;
      }
      el.classList.remove('rolling');
      showDice(el, d1, d2);
      resolve();
    };
    tick();
  });
}

const WORDS = { 4: 'Four', 6: 'Six', 8: 'Eight', 10: 'Ten' };

export function stickmanCall({ d1, d2, total, pointBefore }, rules) {
  let name;
  if (WORDS[total]) name = d1 === d2 ? `${WORDS[total]} the hard way!` : `${WORDS[total]}, easy ${WORDS[total].toLowerCase()}.`;
  else {
    name = {
      2: 'Aces! Snake eyes.', 3: 'Ace-deuce, three.', 5: 'Five, no field five.', 7: 'Seven.',
      9: 'Nine, center field nine.', 11: 'Yo-leven!', 12: 'Twelve, boxcars!',
    }[total];
  }
  if (pointBefore == null) {
    if (total === 7 || total === 11) return `${name} Winner on the come-out, pay the line!`;
    if ([2, 3, 12].includes(total)) {
      const bar = total === rules.barNumber ? ` Bar ${total} on the don'ts.` : ' Pay the don\'ts.';
      return `${name} Craps, line away.${bar}`;
    }
    return `${name} The point is ${total}, mark it.`;
  }
  if (total === pointBefore) return `${name} Winner! Pay the line.`;
  if (total === 7) return 'Seven out! Line away, pay the don\'ts.';
  return name;
}

export function resultsText(results, table) {
  return results.map((r) => {
    if (r.outcome === 'move') return `${table.label(r.from)} → ${r.to}`;
    const label = table.label(r.key);
    if (r.outcome === 'push') return `${label} push`;
    return `${label} ${r.outcome === 'win' ? '+' : '−'}${money(r.outcome === 'win' ? r.win : r.lost)}`;
  }).join(' · ');
}

// An issue line with its Fix button, used in My Bets and above the chip rack.
const issueHTML = (i) => `
  <p class="issue ${i.level}">${i.message}
    <button data-action="fix" data-key="${i.key}" data-part="${i.part}">Fix</button></p>`;

const LOCK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
const attr = (text) => text.replaceAll('"', '&quot;');

// − $amount + for a bet or its odds. A side the rules lock (why.up / why.down) shows a padlock that
// explains itself when tapped; a side that's only at its limit is disabled.
function stepper(bet, part, label, amount, { up, down, why = {} }) {
  const btn = (action, text, aria, off = false) =>
    `<button class="step" data-action="${action}" data-key="${bet.key}" aria-label="${aria}"${off ? ' disabled' : ''}>${text}</button>`;
  const lock = (reason) => `<button class="step lock-btn" data-action="why" data-why="${attr(reason)}" aria-label="Locked: ${attr(reason)}">${LOCK_SVG}</button>`;
  const editable = up || down;
  const amt = editable
    ? `<button class="amt" data-action="edit" data-key="${bet.key}" data-part="${part}" data-value="${amount}" aria-label="${label} ${money(amount)}. Tap to type an amount.">${money(amount)}</button>`
    : `<span class="amt">${money(amount)}</span>`;
  return `<div class="stepper">
    ${down ? btn(`${part}-down`, '−', `Lower ${label} by ${money(down)}`) : why.down ? lock(why.down) : btn('', '−', `Lower ${label}`, true)}
    ${amt}
    ${up ? btn(`${part}-up`, '+', `Raise ${label} by ${money(up)}`) : why.up ? lock(why.up) : btn('', '+', `Raise ${label}`, true)}
  </div>`;
}

// One row in My Bets or the spot menu: the bet, what it pays, steppers for the bet and its odds, and locks.
function betRow(table, bet, issues) {
  const def = table.def(bet);
  const label = def.label(bet);
  const working = table.isWorking(bet);
  const info = table.oddsInfo(bet);
  const hit = def.hitWin?.(table, bet);
  const removable = def.removable(table, bet);
  const addWhy = table.canAdd(bet);
  const step = table.step(bet);
  let status = '';
  if (def.toggle === 'bet') status = working ? 'Working' : 'Off';
  if (def.toggle === 'odds' && bet.number && bet.odds) status = working ? 'Odds working' : 'Odds off';
  const tool = (action, text, aria, cls = '') =>
    `<button class="tool${cls}" data-action="${action}" data-key="${bet.key}" aria-label="${aria}">${text}</button>`;
  const lockedWhy = removable === 0 ? def.locked(table, bet) : null;
  const tag = addWhy && !removable ? 'Locked' : !addWhy && !removable ? 'Contract' : '';

  let oddsRow = '';
  if (info) {
    const word = info.take ? 'Odds' : 'Lay';
    const room = info.max - bet.odds;
    oddsRow = `
      <div class="step-row">
        <span class="step-label">${word}</span>
        ${stepper(bet, 'odds', `${word} on ${label}`, bet.odds, {
          up: room > 0 && Math.min(info.step, room), down: bet.odds && Math.min(info.step, bet.odds),
        })}
        ${room > 0 ? `<button class="tool" data-action="odds-max" data-key="${bet.key}" aria-label="Max ${word.toLowerCase()} on ${label}, ${money(info.max)}">Max</button>` : ''}
      </div>`;
  }
  return `
    <div class="bet-row${status && !working ? ' is-off' : ''}">
      <div class="bet-head">
        <span class="bet-name">${label}</span>
        <span class="bet-meta">${def.pays(table.rules, bet)}${hit != null ? ` · wins ${money(hit)}` : ''}${status ? ` · <b>${status}</b>` : ''}</span>
        <span class="bet-tools">
          ${def.toggle && (def.toggle === 'bet' || bet.odds) ? tool('toggle', working ? 'Turn off' : 'Turn on', `Turn ${label} ${working ? 'off' : 'on'}`) : ''}
          ${removable >= bet.amount ? tool('down', '✕', `Take down ${label}`, ' icon') : ''}
        </span>
      </div>
      <div class="step-row">
        <span class="step-label">Bet</span>
        ${stepper(bet, 'bet', label, bet.amount, {
          up: !addWhy && step, down: removable && Math.min(step, removable),
          why: { up: addWhy, down: lockedWhy },
        })}
        ${tag ? `<button class="lock-tag" data-action="why" data-why="${attr(tag === 'Contract' ? lockedWhy : `${lockedWhy} ${addWhy}`)}">${LOCK_SVG}${tag}</button>` : ''}
      </div>
      ${oddsRow}
      ${issues.filter((i) => i.key === bet.key).map(issueHTML).join('')}
    </div>`;
}

export function renderBetList(el, table, issues) {
  const bets = Object.values(table.bets);
  el.innerHTML = bets.length
    ? bets.map((b) => betRow(table, b, issues)).join('')
    : '<p class="empty">No bets yet. Pick a chip below, then tap a spot on the table.</p>';
}

// Long-press / right-click menu for one spot. A number box offers place, buy, lay and put.
// `help` entries are [topic id, bet key for the "at this table" payout (or null), button label].
export function renderSpotMenu(el, table, chip, spot, issues) {
  let title, adds, keys, help;
  if (spot.number) {
    const n = spot.number;
    title = `The ${n}`;
    adds = [[`place:${n}`, `Place ${n}`], [`buy:${n}`, `Buy ${n}`], [`lay:${n}`, `Lay ${n}`]];
    if (table.point) adds.push([`come:${n}`, `Put ${n}`]);
    keys = [`place:${n}`, `buy:${n}`, `lay:${n}`, `come:${n}`, `dontCome:${n}`];
    help = [['place', `place:${n}`, 'Place'], ['buy', `buy:${n}`, 'Buy'], ['lay', `lay:${n}`, 'Lay'], ['put', null, 'Put']];
  } else {
    title = table.label(spot.key);
    adds = [[spot.key, title]];
    keys = [spot.key];
    help = [[topicFor(spot.key, spot.odds), spot.odds ? null : spot.key, 'What\'s this?']];
  }
  const rows = keys.filter((k) => table.bets[k]).map((k) => betRow(table, table.bets[k], issues)).join('');
  const open = help.find(([id]) => id === spot.help);
  el.innerHTML = `
    <div class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="menu-help">${help.length > 1 ? '<span>What\'s this?</span>' : ''}
      ${help.map(([id, , label]) => `<button data-help="${id}" aria-pressed="${id === spot.help}">${label}</button>`).join('')}</div>
    ${open ? helpPanel(table, open) : ''}
    <div class="menu-adds">${adds.map(([k, text]) => `<button data-action="add" data-key="${k}">${text} <b>+${money(chip)}</b></button>`).join('')}</div>
    ${rows || '<p class="empty">No bet here yet.</p>'}`;
}

function helpPanel(table, [id, key]) {
  let atTable = '';
  if (key) {
    const bet = { key, ...parseKey(key) };
    atTable = `<p class="at-table">At this table it pays <strong>${table.def(bet).pays(table.rules, bet)}</strong>.</p>`;
  }
  // Links inside the write-ups point at sections of the guide page.
  const card = topicHTML(topic(id), { extra: atTable }).replaceAll('href="#', 'href="help.html#');
  return `<div class="help-pop">${card}<a class="guide-link" href="help.html#${id}">Read the full guide →</a></div>`;
}

export function renderIssues(el, issues) {
  el.hidden = issues.length === 0;
  const errors = issues.filter((i) => i.level === 'error').length;
  el.innerHTML = issues.map(issueHTML).join('')
    + (issues.length > 1 ? `<button class="fix-all" data-action="fix-all">Fix all${errors ? ` (${errors} blocking)` : ''}</button>` : '');
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export function openSheet(id) {
  closeSheets();
  document.getElementById(id).classList.add('open');
  document.getElementById('backdrop').hidden = false;
}

export function closeSheets() {
  document.querySelectorAll('.sheet.open').forEach((s) => s.classList.remove('open'));
  document.getElementById('backdrop').hidden = true;
}
