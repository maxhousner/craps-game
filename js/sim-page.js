// Simulator page: pick strategies, run them in a Web Worker, show results, charts and replays.
import { DEFAULT_RULES } from './engine/rules.js';
import { CrapsTable, money } from './engine/table.js';
import { RULES } from './ui/settings.js';
import { esc } from './ui/html.js';
import { dieHTML } from './ui/table-view.js';
import { resultsText, toast } from './ui/controls.js';
import { rangeChart, fanChart, histograms, signed } from './ui/charts.js';
import { describePlan, validateStrategy } from './sim/strategy.js';
import { PRESETS } from './sim/presets.js';
import { loadLibrary, saveToLibrary, removeFromLibrary, newId, isPreset } from './sim/library.js';
import { runSession, summarize, bands, notableSessions, sessionSeed, horizon } from './sim/simulate.js';
import { openEditor } from './sim/editor.js';
import { initToTop } from './ui/to-top.js';

const SIM_KEY = 'craps-game:sim';
// Validated dark categorical slots (dataviz palette), checked against the panel color.
const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500'];
const MAX_LINEUP = 4;
const CHECKPOINTS = 60;
const ENDED = { limit: 'played the full session', 'stop-win': 'hit the stop-win', 'stop-loss': 'hit the stop-loss', bust: 'ran out of money' };
const $ = (id) => document.getElementById(id);
const randomSeed = () => Math.floor(Math.random() * 1e9);
const pct = (x) => `${(x * 100).toFixed(1)}%`;

function gameRules() {
  try {
    return JSON.parse(localStorage.getItem('craps-game:v1'))?.table?.rules ?? {};
  } catch {
    return {};
  }
}

function loadState() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SIM_KEY)) ?? {};
  } catch {
    // Unreadable storage: start fresh.
  }
  return {
    lineup: Array.isArray(saved.lineup) && saved.lineup.length
      ? saved.lineup
      : [structuredClone(PRESETS[0]), structuredClone(PRESETS.find((p) => p.id === 'iron-cross'))],
    settings: {
      bankroll: 1000, lengthUnit: 'rolls', lengthValue: 200, stopWin: 0, stopLoss: 0, sessions: 5000, seed: randomSeed(),
      ...saved.settings,
      rules: { ...DEFAULT_RULES, ...gameRules(), ...saved.settings?.rules },
    },
  };
}

let { lineup, settings } = loadState();
let results = null;
let workers = []; // running simulation workers (several, each with a slice of the sessions)

function saveState() {
  try {
    localStorage.setItem(SIM_KEY, JSON.stringify({ lineup, settings }));
  } catch {
    // Storage blocked: the page still works for this visit.
  }
}

// ---------- Lineup ----------
function renderLineup() {
  const lib = loadLibrary();
  $('lineup').innerHTML = lineup.length
    ? lineup.map((s, i) => `
      <article class="strategy-card">
        <span class="swatch" style="background:${COLORS[i]}"></span>
        <div>
          <h3>${esc(s.name)}</h3>
          ${s.notes ? `<p class="notes">${esc(s.notes)}</p>` : ''}
          <ul>${s.plans.map((p) => `<li>${describePlan(p)}</li>`).join('')}</ul>
        </div>
        <div class="card-actions">
          <button class="ghost" data-edit="${i}">Edit</button>
          <button class="ghost" data-remove="${i}">Remove</button>
        </div>
      </article>`).join('')
    : '<p class="empty">Add a strategy to get started.</p>';
  const full = lineup.length >= MAX_LINEUP;
  $('add-strategy').innerHTML = `<option value="">${full ? 'Up to 4 strategies at a time' : '+ Add a strategy…'}</option>
    <optgroup label="Popular strategies">${PRESETS.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>
    ${lib.length ? `<optgroup label="My strategies">${lib.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</optgroup>` : ''}`;
  $('add-strategy').disabled = full;
  $('new-strategy').disabled = full;
}

function edit(i) {
  const original = lineup[i];
  const fromPreset = isPreset(original.id);
  openEditor($('editor'), original, {
    saved: loadLibrary().some((s) => s.id === original.id),
    onSave(strategy, keep) {
      if (fromPreset) {
        strategy.id = newId();
        if (strategy.name === original.name) strategy.name = `${strategy.name} (my version)`;
      }
      lineup[i] = strategy;
      if (keep) saveToLibrary(strategy);
      saveState();
      renderLineup();
    },
    onDelete() {
      removeFromLibrary(original.id);
      renderLineup();
      toast(`Deleted "${original.name}" from My strategies.`);
    },
  });
}

function buildNew() {
  openEditor($('editor'), { id: newId(), name: 'My strategy', notes: '', plans: [{ bet: 'pass', amount: 10, odds: 'max' }] }, {
    onSave(strategy, keep) {
      lineup.push(strategy);
      if (keep) saveToLibrary(strategy);
      saveState();
      renderLineup();
    },
  });
}

// ---------- Settings ----------
function rulesSummary(r) {
  const odds = r.oddsMultiple === '345' ? '3-4-5x' : `${r.oddsMultiple}x`;
  return `${money(r.tableMin)} table · ${odds} odds · field 12 pays ${r.field12Pays} to 1${r.allowImproper ? ' · non-proper bets allowed' : ''}`;
}

function renderSettings() {
  const f = $('sim-settings');
  for (const name of ['bankroll', 'lengthValue', 'lengthUnit', 'sessions', 'seed']) f[name].value = settings[name];
  f.stopWin.value = settings.stopWin || '';
  f.stopLoss.value = settings.stopLoss || '';
  $('rules-fields').innerHTML = RULES.map(([name, label, opts]) => `
    <label class="field"><span>${label}</span>
      <select data-rule="${name}">${opts.map(([v, t]) => `<option value="${v}"${String(settings.rules[name]) === String(v) ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`).join('')
    + `<label class="check"><input type="checkbox" data-rule="allowImproper"${settings.rules.allowImproper ? ' checked' : ''}>
        <span>Allow bets that aren't in proper units <small>Payouts round down.</small></span></label>`;
  $('rules-summary').textContent = rulesSummary(settings.rules);
}

function readSettings() {
  const f = $('sim-settings');
  const int = (v, min, fallback) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= min ? n : fallback;
  };
  settings.bankroll = int(f.bankroll.value, 1, settings.bankroll);
  settings.lengthValue = int(f.lengthValue.value, 1, settings.lengthValue);
  settings.lengthUnit = f.lengthUnit.value;
  settings.stopWin = int(f.stopWin.value, 0, 0);
  settings.stopLoss = int(f.stopLoss.value, 0, 0);
  settings.sessions = int(f.sessions.value, 1, 5000);
  settings.seed = int(f.seed.value, 0, settings.seed);
  for (const el of $('rules-fields').querySelectorAll('[data-rule]')) {
    const rule = RULES.find(([n]) => n === el.dataset.rule);
    settings.rules[el.dataset.rule] = el.type === 'checkbox' ? el.checked : rule[3](el.value);
  }
  $('rules-summary').textContent = rulesSummary(settings.rules);
  saveState();
}

// ---------- Running ----------
function setRunning(on) {
  $('run').textContent = on ? 'Stop' : 'Run simulation';
  $('run').classList.toggle('blocked', on);
  $('progress').hidden = !on;
}

function stopWorkers() {
  workers.forEach((w) => w.terminate());
  workers = [];
  setRunning(false);
}

function run() {
  if (workers.length) {
    stopWorkers();
    return toast('Simulation stopped.');
  }
  if (!lineup.length) return toast('Add at least one strategy first.');
  const problem = lineup.flatMap((s) => validateStrategy(s).map((m) => `${s.name}: ${m}`))[0];
  if (problem) return toast(problem);
  readSettings();
  const job = {
    strategies: structuredClone(lineup),
    settings: {
      rules: { ...settings.rules },
      bankroll: settings.bankroll,
      length: { unit: settings.lengthUnit, value: settings.lengthValue },
      stopWin: settings.stopWin,
      stopLoss: settings.stopLoss,
    },
    sessions: settings.sessions,
    seed: settings.seed,
    checkpoints: CHECKPOINTS,
  };
  // Split the sessions across CPU cores (leaving one free for the page).
  const cores = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  const per = Math.ceil(job.sessions / cores);
  const slices = [];
  for (let start = 0; start < job.sessions; start += per) slices.push({ start, count: Math.min(per, job.sessions - start) });
  const raw = job.strategies.map(() => ({
    net: new Float64Array(job.sessions), action: new Float64Array(job.sessions), rolls: new Uint32Array(job.sessions),
    maxDrawdown: new Float64Array(job.sessions), low: new Float64Array(job.sessions), peak: new Float64Array(job.sessions),
    outcome: new Uint8Array(job.sessions), paths: new Float32Array(job.sessions * CHECKPOINTS),
  }));
  const done = slices.map(() => 0);
  let finished = 0;
  const started = performance.now();
  setRunning(true);
  updateProgress(0, job.sessions);
  workers = slices.map((slice, w) => {
    const worker = new Worker(new URL('./sim/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        done[w] = data.done;
        return updateProgress(done.reduce((a, b) => a + b, 0), job.sessions);
      }
      if (data.type === 'error') {
        stopWorkers();
        return toast(`Simulation failed: ${data.message}`);
      }
      data.results.forEach((part, j) => {
        for (const [name, arr] of Object.entries(part)) raw[j][name].set(arr, name === 'paths' ? data.start * CHECKPOINTS : data.start);
      });
      done[w] = slice.count;
      worker.terminate();
      if (++finished === slices.length) {
        workers = [];
        setRunning(false);
        showResults({ ...job, raw, seconds: (performance.now() - started) / 1000 });
      }
    };
    worker.onerror = (e) => {
      stopWorkers();
      toast(`Simulation failed: ${e.message}`);
    };
    worker.postMessage({ ...job, ...slice });
    return worker;
  });
}

function updateProgress(done, total) {
  $('progress').querySelector('i').style.width = `${(100 * done) / total}%`;
  $('progress-text').textContent = `${done.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} sessions`;
}

// ---------- Results ----------
const METRICS = [
  ['Average result per session', (s) => `${signed(s.mean)} <small>±${money(Math.round(2 * s.se))}</small>`, (s) => s.mean, 'high'],
  ['Median (typical) session', (s) => signed(s.median), (s) => s.median, 'high'],
  ['Chance to finish ahead', (s) => pct(s.ahead), (s) => s.ahead, 'high'],
  ['Chance to finish behind', (s) => pct(s.behind), (s) => s.behind, 'low'],
  ['Middle 50% of sessions', (s) => `${signed(s.p25)} to ${signed(s.p75)}`],
  ['Middle 90% of sessions', (s) => `${signed(s.p5)} to ${signed(s.p95)}`],
  ['Best / worst session', (s) => `${signed(s.best)} / ${signed(s.worst)}`],
  ['Total bet per session (action)', (s) => money(Math.round(s.action))],
  ['House edge you paid', (s) => `${(s.edge * 100).toFixed(2)}%`, (s) => s.edge, 'low'],
  ['Average worst drop', (s) => money(Math.round(s.maxDrawdown)), (s) => s.maxDrawdown, 'low'],
  ['Average low point', (s) => signed(s.low), (s) => s.low, 'high'],
  ['Rolls per session', (s) => Math.round(s.rolls).toLocaleString('en-US')],
  ['Ran out of money', (s) => pct(s.outcomes.bust), (s) => s.outcomes.bust, 'low'],
  ['Hit stop-win', (s) => pct(s.outcomes['stop-win']), null, null, (r) => r.settings.stopWin],
  ['Hit stop-loss', (s) => pct(s.outcomes['stop-loss']), null, null, (r) => r.settings.stopLoss],
];

function renderSummary() {
  const many = results.summaries.length > 1;
  const head = results.strategies.map((s, i) => `<th scope="col"><span class="th-key" style="background:${COLORS[i]}"></span>${esc(s.name)}</th>`).join('');
  const rows = METRICS.filter((m) => !m[4] || m[4](results)).map(([label, show, value, better]) => {
    let bestIndex = -1;
    if (many && value) {
      const vals = results.summaries.map(value);
      const target = better === 'high' ? Math.max(...vals) : Math.min(...vals);
      if (vals.filter((v) => v === target).length === 1) bestIndex = vals.indexOf(target);
    }
    return `<tr><th scope="row">${label}</th>${results.summaries.map((s, i) => `<td${i === bestIndex ? ' class="best"' : ''}>${show(s)}</td>`).join('')}</tr>`;
  }).join('');
  $('summary-table').innerHTML = `<table class="summary"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

let chartWidth = 0;
function renderCharts() {
  if (!results) return;
  chartWidth = $('range-chart').clientWidth;
  const series = results.strategies.map((s, i) => ({ name: s.name, color: COLORS[i] }));
  rangeChart($('range-chart'), series.map((x, i) => ({ ...x, s: results.summaries[i] })));
  fanChart($('fan-chart'), series.map((x, i) => ({ ...x, bands: results.bands[i] })), horizon(results.settings));
  histograms($('histograms'), series.map((x, i) => ({ ...x, values: results.raw[i].net })));
}

function lengthText({ length }) {
  return `${length.value.toLocaleString('en-US')} ${length.unit === 'hours' ? 'hour' : length.unit.replace(/s$/, '')}${length.value === 1 ? '' : 's'} per session`;
}

function showResults(r) {
  results = r;
  results.summaries = r.raw.map(summarize);
  results.bands = r.raw.map((x) => bands(x.paths, r.sessions, CHECKPOINTS));
  results.notable = r.raw.map((x) => notableSessions(x.net));
  $('results').hidden = false;
  $('results-meta').textContent = `${r.sessions.toLocaleString('en-US')} sessions · ${lengthText(r.settings)} · ${money(r.settings.bankroll)} bankroll · dice seed ${r.seed} · ${r.seconds.toFixed(1)}s`;
  renderSummary();
  renderCharts();
  $('replay-strategy').innerHTML = r.strategies.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('');
  $('replay-n').max = r.sessions;
  showReplay(0, 'median');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Replay ----------
function pointText(e) {
  if (e.pointBefore == null) return e.point ? `<span class="made">Point ${e.point}</span>` : 'Come-out';
  if (e.point == null) return e.d1 + e.d2 === 7 ? 'Seven out' : '<span class="made">Point made</span>';
  return `Point ${e.pointBefore}`;
}

function showReplay(si, pick) {
  if (!results) return;
  const n = results.sessions;
  const idx = pick === 'random' ? Math.floor(Math.random() * n) : typeof pick === 'number' ? pick : results.notable[si][pick];
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pick === pick)));
  const s = runSession(results.strategies[si], results.settings, sessionSeed(results.seed, idx), { log: true });
  const labels = new CrapsTable(results.settings.rules);
  $('replay-strategy').value = String(si);
  $('replay-n').value = idx + 1;
  $('replay-summary').innerHTML = `<strong>${esc(results.strategies[si].name)}</strong>, session #${(idx + 1).toLocaleString('en-US')}:
    ${s.rolls} rolls, ${s.shooters} shooter${s.shooters === 1 ? '' : 's'}, ${ENDED[s.outcome]}.
    Result <strong>${signed(s.net)}</strong> (low ${signed(s.low)}, high ${signed(s.peak)}).`;
  $('replay-log').innerHTML = `<table>
    <thead><tr><th>Roll</th><th>Dice</th><th>Point</th><th>Bets made before the roll</th><th>What happened</th><th>Up / down</th></tr></thead>
    <tbody>${s.log.map((e) => `
      <tr class="${e.d1 + e.d2 === 7 ? 'seven' : ''}">
        <td class="num">${e.roll}</td>
        <td class="dice-cell">${dieHTML(e.d1)}${dieHTML(e.d2)} <b>${e.d1 + e.d2}</b></td>
        <td>${pointText(e)}</td>
        <td>${e.actions.length ? e.actions.join('<br>') : '—'}</td>
        <td>${resultsText(e.results, labels) || '—'}</td>
        <td class="num">${signed(e.worth)}</td>
      </tr>`).join('')}</tbody></table>`;
}

// ---------- CSV ----------
function cell(v) {
  let s = String(v);
  if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`; // keep spreadsheet formulas from running
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(name, rows) {
  const blob = new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function summaryCsv() {
  const head = ['Strategy', 'Sessions', 'Average', 'Median', '5th percentile', '25th percentile', '75th percentile', '95th percentile',
    'Best', 'Worst', 'Finished ahead %', 'Average action', 'House edge %', 'Average worst drop', 'Average low point', 'Average rolls',
    'Ran out of money %', 'Hit stop-win %', 'Hit stop-loss %'];
  const r2 = (x) => Math.round(x * 100) / 100;
  download('craps-sim-summary.csv', [head, ...results.summaries.map((s, i) => [
    results.strategies[i].name, s.sessions, r2(s.mean), r2(s.median), r2(s.p5), r2(s.p25), r2(s.p75), r2(s.p95), s.best, s.worst,
    r2(s.ahead * 100), r2(s.action), r2(s.edge * 100), r2(s.maxDrawdown), r2(s.low), r2(s.rolls),
    r2(s.outcomes.bust * 100), r2(s.outcomes['stop-win'] * 100), r2(s.outcomes['stop-loss'] * 100),
  ])]);
}

function sessionsCsv() {
  const ended = ['limit', 'stop-win', 'stop-loss', 'bust'];
  const rows = [['Strategy', 'Session', 'Result', 'Rolls', 'Action', 'Low point', 'High point', 'Worst drop', 'Ended']];
  results.raw.forEach((raw, i) => {
    const name = results.strategies[i].name;
    for (let n = 0; n < results.sessions; n++) {
      rows.push([name, n + 1, raw.net[n], raw.rolls[n], raw.action[n], raw.low[n], raw.peak[n], raw.maxDrawdown[n], ended[raw.outcome[n]]]);
    }
  });
  download('craps-sim-sessions.csv', rows);
}

// ---------- Wiring ----------
$('lineup').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.edit) edit(Number(b.dataset.edit));
  if (b.dataset.remove) {
    lineup.splice(Number(b.dataset.remove), 1);
    saveState();
    renderLineup();
  }
});
$('add-strategy').addEventListener('change', (e) => {
  const id = e.target.value;
  const s = [...PRESETS, ...loadLibrary()].find((x) => x.id === id);
  if (s && lineup.length < MAX_LINEUP) {
    lineup.push(structuredClone(s));
    saveState();
  }
  renderLineup();
});
$('new-strategy').addEventListener('click', buildNew);
$('sim-settings').addEventListener('change', readSettings);
$('sim-settings').addEventListener('submit', (e) => e.preventDefault());
$('new-seed').addEventListener('click', () => {
  $('sim-settings').seed.value = randomSeed();
  readSettings();
});
$('run').addEventListener('click', run);
$('csv-summary').addEventListener('click', summaryCsv);
$('csv-sessions').addEventListener('click', sessionsCsv);
document.querySelector('.seg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) showReplay(Number($('replay-strategy').value), b.dataset.pick);
});
$('replay-strategy').addEventListener('change', () => showReplay(Number($('replay-strategy').value), 'median'));
$('replay-go').addEventListener('click', () => {
  const n = Math.min(results.sessions, Math.max(1, Math.floor(Number($('replay-n').value) || 1)));
  showReplay(Number($('replay-strategy').value), n - 1);
});
new ResizeObserver(() => {
  if (results && Math.abs($('range-chart').clientWidth - chartWidth) > 4) renderCharts();
}).observe($('results'));

renderLineup();
renderSettings();
initToTop($('to-top'));
