// Wires the page to the engine: actions, rolling, saving, keyboard and touch.
import { CrapsTable, money } from './engine/table.js';
import { cryptoRoll } from './engine/dice.js';
import { buildFelt, buildProps, renderTable, showMarkers, flashRoll } from './ui/table-view.js';
import {
  CHIP_VALUES, renderChipRack, animateDice, showDice, stickmanCall, resultsText,
  renderBetList, renderSpotMenu, renderIssues, toast, openSheet, closeSheets,
} from './ui/controls.js';
import { initSettings, SAVE_KEY } from './ui/settings.js';
import { newStats, recordRoll, renderStats, renderHistory, signed, signClass } from './ui/stats.js';
import { initAutoplay } from './ui/autoplay.js';
import { createRunner } from './sim/strategy.js';
import { esc } from './ui/html.js';

const $ = (id) => document.getElementById(id);

let table, stats, history, prefs, chip, lastRoll;
let propKeys; // bet keys of the center-action spots, for the strip's total
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
  propKeys = new Set([...$('props').querySelectorAll('[data-key]')].map((el) => el.dataset.key));
  $('center-title').textContent = $('props').classList.contains('no-side') ? 'Center action' : 'Center action & side bets';
}

function renderCenter() {
  const open = prefs.centerOpen !== false;
  $('center').classList.toggle('collapsed', !open);
  $('center-toggle').setAttribute('aria-expanded', open);
  $('center-act').textContent = open ? 'Hide' : 'Show';
}

function render() {
  const issues = table.issues();
  const blocked = issues.some((i) => i.level === 'error');
  const onTable = table.totalOnTable();
  const pl = table.bankroll + onTable - stats.start;
  renderTable(table, issues);
  $('bankroll').textContent = money(table.bankroll);
  $('on-table').textContent = money(onTable);
  $('session').textContent = signed(pl);
  $('session').className = signClass(pl);
  $('point-label').textContent = table.point ?? 'OFF';
  fitMeters();
  renderChipRack($('chip-rack'), chip);
  renderBetList($('bet-list'), table, issues);
  const count = Object.keys(table.bets).length;
  $('bet-count').textContent = count ? `(${count})` : '';
  $('bets-on-table').textContent = money(onTable);
  const centerOn = table.betList().reduce((s, b) => (propKeys.has(b.key) ? s + b.amount : s), 0);
  $('center-on').textContent = centerOn ? `${money(centerOn)} bet here` : '';
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

// On phones, long numbers can crowd the meters; the Autoplay button then shows only its icon.
function fitMeters() {
  const row = $('open-autoplay').parentElement;
  row.classList.remove('tight');
  row.classList.toggle('tight', row.scrollWidth > row.clientWidth);
}

function renderStatus() {
  $('dice').classList.toggle('idle', !lastRoll);
  if (!lastRoll) return showDice($('dice'), 6, 1);
  showDice($('dice'), lastRoll.d1, lastRoll.d2);
  $('call').textContent = lastRoll.call;
  const net = $('roll-net');
  net.textContent = lastRoll.net ? signed(lastRoll.net) : '';
  net.className = `net ${lastRoll.net > 0 ? 'pos' : 'neg'}`;
  $('roll-detail').textContent = lastRoll.detail;
}

// While autoplay is running, bets can't be changed by hand.
function autoBusy() {
  if (auto && !auto.paused) {
    toast('Pause autoplay to change bets.');
    return true;
  }
  return false;
}

// Run one table action; keep an undo snapshot if it worked, explain if it didn't.
function act(fn) {
  if (rolling || autoBusy()) return;
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

function selectChip(value) {
  chip = value;
  save();
  render();
}

function undo() {
  if (rolling || !undoStack.length) return;
  table = CrapsTable.restore(undoStack.pop());
  save();
  render();
}

function takeDownAll() {
  act(() => (table.takeDownAll() ? { ok: true } : { ok: false, error: 'Nothing on the table can come down right now.' }));
}

// Move a bet (or its odds) to an exact amount. 0 takes it down.
function setTo(key, part, target) {
  const bet = table.bets[key];
  if (!bet) return { ok: false, error: 'There\'s no bet there.' };
  const cur = part === 'odds' ? bet.odds : bet.amount;
  if (part === 'odds') return target > cur ? table.placeOdds(key, target - cur) : table.removeOdds(key, cur - target);
  return target > cur ? table.placeBet(key, target - cur) : table.removeBet(key, cur - target);
}

// Tapping an amount in My Bets swaps it for a number box. Enter or leaving the box sets it; Escape cancels.
function editAmount(btn) {
  const { key, part, value } = btn.dataset;
  const input = document.createElement('input');
  Object.assign(input, { type: 'number', min: 0, step: 1, value, className: 'amt amt-input' });
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', btn.getAttribute('aria-label').replace(' Tap to type an amount.', ''));
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    const target = Number(input.value);
    if (!commit || input.value === '' || target === Number(value)) return render();
    if (!Number.isInteger(target) || target < 0) {
      toast('Bets are made in whole dollars.');
      return render();
    }
    act(() => setTo(key, part, target));
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') {
      e.stopPropagation(); // cancel the edit, not close the sheet
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  btn.replaceWith(input);
  input.focus();
  input.select();
}

function handleAction(action, key, part, el) {
  const bet = table.bets[key];
  switch (action) {
    case 'bet-up': return act(() => table.placeBet(key, table.step(bet)));
    case 'bet-down': return act(() => table.removeBet(key, Math.min(table.step(bet), table.def(bet).removable(table, bet))));
    case 'odds-up': return act(() => table.placeOdds(key, Math.min(table.oddsInfo(bet).step, table.oddsInfo(bet).max - bet.odds)));
    case 'odds-down': return act(() => table.removeOdds(key, Math.min(table.oddsInfo(bet).step, bet.odds)));
    case 'odds-max': return act(() => setTo(key, 'odds', table.oddsInfo(bet).max));
    case 'edit':
      if (autoBusy() || rolling) return;
      return editAmount(el);
    case 'why': return toast(el.dataset.why);
    case 'add': return act(() => table.placeBet(key, chip));
    case 'down': return act(() => table.removeBet(key));
    case 'toggle': return act(() => table.toggleWorking(key));
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
  closeAll();
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
  closeAll();
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

function closeAll() {
  closeMenu();
  closeSheets();
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
      selectChip(Number(t.dataset.chip));
    } else if (t.dataset.sheet) {
      closeMenu();
      openSheet(t.dataset.sheet);
    } else if ('close' in t.dataset) {
      closeAll();
    } else if (t.dataset.action) {
      handleAction(t.dataset.action, t.dataset.key, t.dataset.part, t);
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
      selectChip(CHIP_VALUES[Number(e.key) - 1]);
    } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      undo();
    } else if (e.key === 'Escape') {
      closeAll();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && !typing(e)) e.preventDefault(); // don't also "click" the focused button
  });

  // Sheets sit above the dock, so keep its height in a CSS variable.
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--dock-h', `${$('dock').offsetHeight}px`);
  }).observe($('dock'));
  addEventListener('resize', fitMeters);
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
$('center-toggle').addEventListener('click', () => {
  prefs.centerOpen = prefs.centerOpen === false;
  save();
  renderCenter();
});
$('open-autoplay').addEventListener('click', initAutoplay($('autoplay'), { rules: () => table.rules, onStart: startAuto }));
render();
renderStatus();
renderCenter();
