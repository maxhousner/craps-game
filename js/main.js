// Wires the page to the engine: actions, rolling, saving, keyboard and touch.
import { CrapsTable, money } from './engine/table.js';
import { cryptoRoll } from './engine/dice.js';
import { buildFelt, buildProps, renderTable, showMarkers, flashRoll } from './ui/table-view.js';
import {
  CHIP_VALUES, renderChipRack, animateDice, showDice, stickmanCall, resultsText,
  renderBetList, renderSpotMenu, renderIssues, toast, openSheet, closeSheets,
} from './ui/controls.js';
import { initSettings } from './ui/settings.js';
import { newStats, recordRoll, renderStats, renderHistory } from './ui/stats.js';
import { initAutoplay } from './ui/autoplay.js';
import { createRunner } from './sim/strategy.js';
import { esc } from './ui/html.js';

const SAVE_KEY = 'craps-game:v1';
const $ = (id) => document.getElementById(id);

let table, stats, history, prefs, chip, lastRoll;
let undoStack = []; // table snapshots taken before each action since the last roll
let rolling = false;
let menuSpot = null; // { key } or { number } while the spot menu is open
let auto = null; // autoplay: { strategy, runner, speed, limit, rolls, paused }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (data?.version === 1) {
      table = CrapsTable.restore(data.table);
      ({ stats, history, prefs, chip, lastRoll } = data);
      return;
    }
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  table = new CrapsTable();
  stats = newStats(table.bankroll);
  history = [];
  prefs = { fastRoll: false };
  chip = 5;
  lastRoll = null;
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, table: table.snapshot(), stats, history, prefs, chip, lastRoll }));
  } catch {
    // Private mode or full storage: the game still works, it just won't persist.
  }
}

function buildStatic() {
  buildFelt($('felt'), table.rules);
  buildProps($('props'), table.rules);
}

function render() {
  const issues = table.issues();
  const blocked = issues.some((i) => i.level === 'error');
  const pl = table.bankroll + table.totalOnTable() - stats.start;
  renderTable(table, issues);
  $('bankroll').textContent = money(table.bankroll);
  $('on-table').textContent = money(table.totalOnTable());
  $('session').textContent = `${pl > 0 ? '+' : pl < 0 ? '−' : ''}${money(Math.abs(pl))}`;
  $('session').className = pl > 0 ? 'pos' : pl < 0 ? 'neg' : '';
  $('point-label').textContent = table.point ?? 'OFF';
  renderChipRack($('chip-rack'), chip);
  renderBetList($('bet-list'), table, chip, issues);
  const count = Object.keys(table.bets).length;
  $('bet-count').textContent = count ? `(${count})` : '';
  $('bets-on-table').textContent = money(table.totalOnTable());
  renderIssues($('issues'), issues);
  $('roll').disabled = rolling;
  $('roll').classList.toggle('blocked', blocked);
  $('roll').textContent = blocked ? 'Fix bets' : 'Roll';
  $('undo').disabled = rolling || undoStack.length === 0;
  $('take-down').disabled = rolling || count === 0;
  renderHistory($('history'), history);
  renderStats($('stats'), stats, table);
  if (menuSpot) renderSpotMenu($('spot-menu'), table, chip, menuSpot, issues);
}

function renderStatus() {
  $('dice').classList.toggle('idle', !lastRoll);
  if (!lastRoll) return showDice($('dice'), 6, 1);
  showDice($('dice'), lastRoll.d1, lastRoll.d2);
  $('call').textContent = lastRoll.call;
  const net = $('roll-net');
  net.textContent = lastRoll.net > 0 ? `+${money(lastRoll.net)}` : lastRoll.net < 0 ? `−${money(-lastRoll.net)}` : '';
  net.className = `net ${lastRoll.net > 0 ? 'pos' : 'neg'}`;
  $('roll-detail').textContent = lastRoll.detail;
}

// Run one table action; keep an undo snapshot if it worked, explain if it didn't.
function act(fn) {
  if (rolling) return;
  if (auto && !auto.paused) return toast('Pause autoplay to change bets.');
  const snap = table.snapshot();
  const res = fn();
  if (res.ok) {
    undoStack.push(snap);
    save();
  } else {
    toast(res.error);
  }
  render();
}

function undo() {
  if (rolling || !undoStack.length) return;
  table = CrapsTable.restore(undoStack.pop());
  save();
  render();
}

function takeDownAll() {
  act(() => {
    let any = false;
    for (const bet of Object.values(table.bets)) {
      if (bet.odds && table.removeOdds(bet.key).ok) any = true;
      const n = Math.min(table.def(bet).removable(table, bet), bet.amount);
      if (n > 0 && table.removeBet(bet.key, n).ok) any = true;
    }
    return any ? { ok: true } : { ok: false, error: 'Nothing on the table can come down right now.' };
  });
}

function handleAction(action, key, part) {
  const bet = table.bets[key];
  switch (action) {
    case 'add': return act(() => table.placeBet(key, chip));
    case 'minus': return act(() => table.removeBet(key, Math.min(chip, bet.amount)));
    case 'down': return act(() => table.removeBet(key));
    case 'toggle': return act(() => table.toggleWorking(key));
    case 'odds-add': return act(() => table.placeOdds(key, chip));
    case 'odds-minus': return act(() => table.removeOdds(key, Math.min(chip, bet.odds)));
    case 'fix': return act(() => table.fix(key, part));
    case 'fix-all': return act(() => {
      for (const i of table.issues()) if (table.bets[i.key]) table.fix(i.key, i.part);
      return { ok: true };
    });
  }
}

function forcedDice() {
  const a = Number($('dev-d1')?.value);
  const b = Number($('dev-d2')?.value);
  return a && b ? [a, b] : null;
}

// Returns the roll result, or null if the roll didn't happen. `fast` skips the dice animation.
async function roll(fast = false) {
  if (rolling) return null;
  if (!table.canRoll()) {
    toast('Fix the flagged bets before rolling.');
    return null;
  }
  rolling = true;
  $('dice').classList.remove('idle');
  closeMenu();
  closeSheets();
  render();
  const [d1, d2] = forcedDice() ?? cryptoRoll();
  await animateDice($('dice'), d1, d2, prefs.fastRoll || fast);
  const res = table.roll(d1, d2);
  undoStack = [];
  recordRoll(stats, res);
  history.unshift({ d1, d2, total: res.total, sevenOut: res.sevenOut, pointMade: res.pointMade, pointSet: res.pointSet });
  history.length = Math.min(history.length, 60);
  lastRoll = { d1, d2, call: stickmanCall(res, table.rules), net: res.net, detail: resultsText(res.results, table) };
  rolling = false;
  save();
  render();
  renderStatus();
  showMarkers(res.results);
  flashRoll(res.total);
  return res;
}

// ---------- Autoplay: a strategy bets and rolls on this table ----------
function renderAutoBar() {
  document.body.classList.toggle('autoplaying', !!auto);
  if (!auto) return;
  $('auto-status').innerHTML = `<b>${esc(auto.strategy.name)}</b> · roll ${auto.rolls}${auto.limit ? ` of ${auto.limit}` : ''}${auto.paused ? ' · paused' : ''}`;
  $('auto-pause').textContent = auto.paused ? 'Resume' : 'Pause';
}

function startAuto(strategy, speed, limit) {
  auto = { strategy, runner: createRunner(strategy), speed, limit, rolls: 0, paused: false };
  closeMenu();
  closeSheets();
  renderAutoBar();
  autoLoop();
}

function stopAuto(message) {
  auto = null;
  renderAutoBar();
  render();
  if (message) toast(message);
}

function togglePause() {
  if (!auto) return;
  auto.paused = !auto.paused;
  renderAutoBar();
  if (!auto.paused) autoLoop();
}

async function autoLoop() {
  const me = auto;
  while (auto === me && !me.paused) {
    if (rolling) {
      await sleep(50);
      continue;
    }
    const { short } = me.runner.decide(table);
    save();
    render();
    if (short && Object.keys(table.bets).length === 0) return stopAuto('Autoplay stopped: not enough bankroll for this strategy.');
    if (!table.canRoll()) return stopAuto('Autoplay stopped. Fix the flagged bets, then start again.');
    const res = await roll(me.speed.fast);
    if (auto !== me) return;
    if (res) {
      me.runner.record(res, table);
      me.rolls++;
    }
    renderAutoBar();
    if (me.limit && me.rolls >= me.limit) return stopAuto(`Autoplay finished ${me.rolls} rolls.`);
    await sleep(me.speed.delay);
  }
}

// Spot menu (long-press / right-click).
function openMenu(el) {
  const box = el.closest('.box');
  menuSpot = box ? { number: Number(box.dataset.number) } : { key: el.dataset.key ?? el.dataset.odds, odds: !!el.dataset.odds };
  closeSheets();
  $('spot-menu').hidden = false;
  $('backdrop').hidden = false;
  render();
}

function closeMenu() {
  menuSpot = null;
  $('spot-menu').hidden = true;
}

function wireEvents() {
  let pressTimer = null;
  let pressStart = null;
  let suppressClick = false;

  document.addEventListener('click', (e) => {
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      return;
    }
    const t = e.target.closest('[data-chip], [data-action], [data-help], [data-odds], [data-key], [data-sheet], [data-close]');
    if (!t || t.disabled) return;
    if (t.dataset.help) {
      menuSpot.help = menuSpot.help === t.dataset.help ? null : t.dataset.help;
      render();
    } else if (t.dataset.chip) {
      chip = Number(t.dataset.chip);
      save();
      render();
    } else if (t.dataset.sheet) {
      closeMenu();
      openSheet(t.dataset.sheet);
    } else if ('close' in t.dataset) {
      closeMenu();
      closeSheets();
    } else if (t.dataset.action) {
      handleAction(t.dataset.action, t.dataset.key, t.dataset.part);
    } else if (t.dataset.odds) {
      act(() => table.placeOdds(t.dataset.odds, chip));
    } else if (t.dataset.key) {
      act(() => table.placeBet(t.dataset.key, chip));
    }
  });

  // Long-press on touch screens opens the spot menu; right-click does the same on desktop.
  const spotFrom = (e) => e.target.closest('.felt .spot, .props .spot, .line-chip');
  document.addEventListener('pointerdown', (e) => {
    suppressClick = false;
    const spot = spotFrom(e);
    if (!spot) return;
    pressStart = [e.clientX, e.clientY];
    pressTimer = setTimeout(() => {
      suppressClick = true;
      openMenu(spot);
    }, 500);
  });
  const cancelPress = () => clearTimeout(pressTimer);
  document.addEventListener('pointerup', cancelPress);
  document.addEventListener('pointercancel', cancelPress);
  document.addEventListener('pointermove', (e) => {
    if (pressStart && Math.hypot(e.clientX - pressStart[0], e.clientY - pressStart[1]) > 10) cancelPress();
  });
  document.addEventListener('contextmenu', (e) => {
    const spot = spotFrom(e);
    if (!spot) return;
    e.preventDefault();
    cancelPress();
    openMenu(spot);
  });

  $('roll').addEventListener('click', () => roll());
  $('auto-pause').addEventListener('click', togglePause);
  $('auto-stop').addEventListener('click', () => stopAuto(auto ? `Autoplay stopped after ${auto.rolls} rolls.` : ''));
  $('undo').addEventListener('click', undo);
  $('take-down').addEventListener('click', takeDownAll);

  // Space rolls, 1–6 pick a chip, Cmd/Ctrl+Z undoes.
  const typing = (e) => e.target.closest('input, select, textarea') || $('settings').open;
  document.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) auto ? togglePause() : roll();
    } else if (e.key >= '1' && e.key <= '6' && !e.metaKey && !e.ctrlKey) {
      chip = CHIP_VALUES[Number(e.key) - 1];
      save();
      render();
    } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      undo();
    } else if (e.key === 'Escape') {
      closeMenu();
      closeSheets();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && !typing(e)) e.preventDefault(); // don't also "click" the focused button
  });

  // Sheets sit above the dock, so keep its height in a CSS variable.
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--dock-h', `${$('dock').offsetHeight}px`);
  }).observe($('dock'));
}

function initDev() {
  if (!new URLSearchParams(location.search).has('dev')) return;
  const opts = '<option value="">?</option>' + [1, 2, 3, 4, 5, 6].map((n) => `<option>${n}</option>`).join('');
  $('dev').hidden = false;
  $('dev').innerHTML = `<span>Force next roll</span><select id="dev-d1" aria-label="Die 1">${opts}</select><select id="dev-d2" aria-label="Die 2">${opts}</select>`;
}

load();
buildStatic();
wireEvents();
initDev();
const openSettings = initSettings($('settings'), {
  state: () => ({ rules: table.rules, prefs, hasBets: Object.keys(table.bets).length > 0 }),
  setRules(patch) {
    if (auto) stopAuto();
    const res = table.setRules(patch);
    if (!res.ok) return toast(res.error);
    undoStack = [];
    buildStatic();
    save();
    render();
  },
  setPrefs(patch) {
    Object.assign(prefs, patch);
    save();
  },
  reset(startingBankroll) {
    if (auto) stopAuto();
    table = new CrapsTable({ ...table.rules, startingBankroll });
    stats = newStats(table.bankroll);
    history = [];
    lastRoll = null;
    undoStack = [];
    $('call').textContent = 'New session. Place your bets.';
    $('roll-net').textContent = '';
    $('roll-detail').textContent = '';
    save();
    render();
    renderStatus();
  },
});
$('open-settings').addEventListener('click', openSettings);
$('open-autoplay').addEventListener('click', initAutoplay($('autoplay'), { onStart: startAuto }));
render();
renderStatus();
