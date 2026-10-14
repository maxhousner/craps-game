// Strategy builder dialog: a list of bet rows, each with its own options and press/progression.
import { BET_KINDS, describePlan, validateStrategy } from './strategy.js';
import { esc } from '../ui/html.js';

const GROUPS = [
  ['Line bets', ['pass', 'dontPass', 'come', 'dontCome']],
  ['Number bets', ['place', 'buy', 'lay', 'hard', 'big']],
  ['One-roll bets', ['field', 'any7', 'anyCraps', 'num', 'horn', 'world', 'ce']],
  ['Side bets', ['fire', 'small', 'tall', 'all']],
];

const NEW_PLAN = {
  pass: { amount: 10, odds: 'max' },
  dontPass: { amount: 10, odds: 'max' },
  come: { amount: 10, count: 2, odds: 'max' },
  dontCome: { amount: 10, count: 2, odds: 'max' },
  place: { numbers: [6, 8], amount: 12, when: 'point' },
  buy: { numbers: [4, 10], amount: 25, when: 'point' },
  lay: { numbers: [4, 10], amount: 40, when: 'point' },
  hard: { numbers: [6, 8], amount: 2, when: 'point' },
  big: { numbers: [6, 8], amount: 10, when: 'always' },
  field: { amount: 5, when: 'always' },
  any7: { amount: 5, when: 'always' },
  anyCraps: { amount: 2, when: 'comeOut' },
  num: { numbers: [11], amount: 2, when: 'always' },
  horn: { amount: 4, when: 'always' },
  world: { amount: 5, when: 'always' },
  ce: { amount: 2, when: 'comeOut' },
  fire: { amount: 1 },
  small: { amount: 1 },
  tall: { amount: 1 },
  all: { amount: 1 },
};

const ODDS = [['none', 'No odds'], ['1', '1x'], ['2', '2x'], ['3', '3x'], ['5', '5x'], ['10', '10x'], ['max', 'Max the table allows']];
const WHEN_NUMBER = [['point', 'After the point is set'], ['always', 'From the come-out roll']];
const WHEN_ONE_ROLL = [['always', 'Every roll'], ['point', 'While a point is on'], ['comeOut', 'Only on come-out rolls']];
const ON_WIN = [
  ['same', 'Collect (same bet)'], ['press', 'Press (double it)'], ['halfPress', 'Half press (+50%)'],
  ['addUnit', 'Add one starting unit'], ['reset', 'Back to the starting bet'],
  ['regress', 'Regress to an amount'], ['ladder', 'Ladder through amounts'],
];
const ON_LOSS = [['reset', 'Back to the starting bet'], ['same', 'Keep the same bet'], ['double', 'Double it (Martingale)'], ['addUnit', 'Add one starting unit']];

const options = (list, value) => list.map(([v, t]) => `<option value="${v}"${String(value) === v ? ' selected' : ''}>${t}</option>`).join('');

function fields(plan) {
  const kind = BET_KINDS[plan.bet];
  const out = [`<label class="mini"><span>Amount${kind.numbers ? ' each' : ''}</span>
    <input type="number" min="1" step="1" inputmode="numeric" data-field="amount" value="${plan.amount}"></label>`];
  if (kind.group === 'line' || kind.group === 'come') {
    out.push(`<label class="mini"><span>${plan.bet.startsWith('dont') ? 'Lay odds' : 'Odds'}</span>
      <select data-field="odds">${options(ODDS, plan.odds ?? 'none')}</select></label>`);
  }
  if (kind.group === 'come') {
    out.push(`<label class="mini"><span>Keep working</span>
      <select data-field="count">${options([1, 2, 3, 4, 5, 6].map((n) => [String(n), `${n} bet${n > 1 ? 's' : ''}`]), plan.count)}</select></label>`);
  }
  if (kind.group === 'number') {
    out.push(`<label class="mini"><span>When</span><select data-field="when">${options(WHEN_NUMBER, plan.when ?? 'point')}</select></label>`);
  }
  if (kind.group === 'oneRoll') {
    out.push(`<label class="mini"><span>When</span><select data-field="when">${options(WHEN_ONE_ROLL, plan.when ?? 'always')}</select></label>`);
  }
  if (kind.numbers) {
    out.push(`<div class="mini numbers"><span>Numbers</span><div class="chips-row">${kind.numbers.map((n) => `
      <button type="button" class="num-chip" data-number="${n}" aria-pressed="${plan.numbers?.includes(n) ?? false}">${n}</button>`).join('')}</div></div>`);
  }
  const checks = [];
  if (kind.group === 'number') checks.push(['skipPoint', 'Skip the point number']);
  if (['place', 'buy', 'hard'].includes(plan.bet)) checks.push(['comeOutOn', 'Working on the come-out']);
  if (plan.bet === 'come') checks.push(['oddsOnComeOut', 'Odds working on the come-out']);
  for (const [f, label] of checks) {
    out.push(`<label class="check mini-check"><input type="checkbox" data-field="${f}"${plan[f] ? ' checked' : ''}><span>${label}</span></label>`);
  }
  return out.join('');
}

function progressionFields(plan) {
  const p = plan.progression ?? {};
  const onWin = p.onWin ?? 'same';
  return `
    <label class="mini"><span>After a win</span><select data-pfield="onWin">${options(ON_WIN, onWin)}</select></label>
    <label class="mini"><span>Do it every</span><select data-pfield="every">${options([1, 2, 3, 4, 5].map((n) => [String(n), n === 1 ? 'win' : `${n} wins`]), p.every ?? 1)}</select></label>
    ${onWin === 'regress' ? `<label class="mini"><span>Regress to</span><input type="number" min="1" step="1" data-pfield="regressTo" value="${p.regressTo ?? Math.max(1, Math.round(plan.amount / 2))}"></label>` : ''}
    ${onWin === 'ladder' ? `<label class="mini wide"><span>Ladder amounts</span><input type="text" inputmode="numeric" data-pfield="ladder" placeholder="e.g. 18, 24, 30" value="${(p.ladder ?? []).join(', ')}"></label>` : ''}
    <label class="mini"><span>Start over after</span><select data-pfield="resetAfter">${options([['0', 'never'], ...[2, 3, 4, 5].map((n) => [String(n), `${n} wins in a row`])], p.resetAfter ?? 0)}</select></label>
    <label class="mini"><span>After a loss</span><select data-pfield="onLoss">${options(ON_LOSS, p.onLoss ?? 'reset')}</select></label>
    <label class="mini"><span>Max bet</span><input type="number" min="0" step="1" data-pfield="max" placeholder="no max" value="${p.max || ''}"></label>`;
}

function planCard(plan, i) {
  const kind = BET_KINDS[plan.bet];
  const prog = kind.group !== 'side';
  return `
    <div class="plan-card" data-i="${i}">
      <div class="plan-head">
        <strong>${kind.label}</strong>
        <button type="button" class="icon-btn small" data-remove="${i}" aria-label="Remove ${kind.label}">✕</button>
      </div>
      <p class="plan-desc">${describePlan(plan)}</p>
      <div class="plan-fields">${fields(plan)}</div>
      ${prog ? `<details class="prog"${plan.progression ? ' open' : ''}><summary>Press / progression</summary>
        <div class="plan-fields">${progressionFields(plan)}</div></details>` : ''}
    </div>`;
}

// Drop progression settings that do nothing, and parse ladder text.
function clean(strategy) {
  for (const plan of strategy.plans) {
    const p = plan.progression;
    if (!p) continue;
    if (typeof p.ladder === 'string') p.ladder = p.ladder.split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    const idle = (p.onWin ?? 'same') === 'same' && (p.onLoss ?? 'reset') === 'reset' && !p.resetAfter;
    if (idle) delete plan.progression;
  }
  return strategy;
}

/**
 * Open the builder on a copy of `strategy`.
 * onSave(strategy, keepInLibrary) and onDelete() are called on the matching buttons.
 */
export function openEditor(dialog, strategy, { onSave, onDelete = null, saved = false }) {
  const draft = structuredClone(strategy);
  dialog.innerHTML = `
    <form method="dialog" class="editor">
      <div class="sheet-head"><h2>Strategy builder</h2><button type="button" class="icon-btn" id="close-edit" aria-label="Close">✕</button></div>
      <label class="field"><span>Name</span><input name="name" maxlength="60" value="${esc(draft.name)}"></label>
      <label class="field"><span>Notes</span><input name="notes" maxlength="200" placeholder="Optional" value="${esc(draft.notes ?? '')}"></label>
      <div id="plans"></div>
      <label class="add-bet"><span class="sr-only">Add a bet</span>
        <select id="add-plan"><option value="">+ Add a bet…</option>${GROUPS.map(([g, bets]) => `
          <optgroup label="${g}">${bets.map((b) => `<option value="${b}">${BET_KINDS[b].label}</option>`).join('')}</optgroup>`).join('')}
        </select></label>
      <p class="note">Amounts are raised to the table minimum and rounded to proper units when the strategy runs.</p>
      <div id="editor-errors" class="errors" role="alert"></div>
      <label class="check"><input type="checkbox" name="keep" checked><span>Save to My strategies <small>so you can reuse it here and in table autoplay</small></span></label>
      <div class="editor-actions">
        ${onDelete && saved ? '<button type="button" class="danger" id="delete-strategy">Delete from My strategies</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="ghost" id="cancel-edit">Cancel</button>
        <button type="button" class="roll-btn" id="save-strategy">Save</button>
      </div>
    </form>`;

  const form = dialog.querySelector('form');
  const plansEl = dialog.querySelector('#plans');
  const render = () => {
    plansEl.innerHTML = draft.plans.length
      ? draft.plans.map(planCard).join('')
      : '<p class="empty">No bets yet. Add one below.</p>';
  };
  const planOf = (el) => draft.plans[+el.closest('.plan-card').dataset.i];

  // Enter in a text box shouldn't close the builder.
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', (e) => {
    if (e.target.name === 'name') draft.name = e.target.value;
    if (e.target.name === 'notes') draft.notes = e.target.value;
  });
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'add-plan' && t.value) {
      draft.plans.push({ bet: t.value, ...structuredClone(NEW_PLAN[t.value]) });
      t.value = '';
      render();
      plansEl.lastElementChild?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (t.dataset.field) {
      const plan = planOf(t);
      const f = t.dataset.field;
      if (t.type === 'checkbox') plan[f] = t.checked;
      else if (f === 'amount' || f === 'count') plan[f] = Math.floor(Number(t.value));
      else if (f === 'odds') plan.odds = t.value === 'none' || t.value === 'max' ? t.value : Number(t.value);
      else plan[f] = t.value;
      render();
    } else if (t.dataset.pfield) {
      const plan = planOf(t);
      const p = (plan.progression ??= {});
      const f = t.dataset.pfield;
      if (f === 'onWin' || f === 'onLoss') p[f] = t.value;
      else if (f === 'ladder') p.ladder = t.value;
      else p[f] = Math.max(0, Math.floor(Number(t.value) || 0));
      render();
    }
  });
  form.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.number) {
      const plan = planOf(t);
      const n = Number(t.dataset.number);
      plan.numbers = plan.numbers?.includes(n) ? plan.numbers.filter((x) => x !== n) : [...(plan.numbers ?? []), n].sort((a, b) => a - b);
      render();
    } else if (t.dataset.remove) {
      draft.plans.splice(Number(t.dataset.remove), 1);
      render();
    } else if (t.id === 'cancel-edit' || t.id === 'close-edit') {
      dialog.close();
    } else if (t.id === 'delete-strategy') {
      if (confirm(`Delete "${draft.name}" from My strategies?`)) {
        onDelete();
        dialog.close();
      }
    } else if (t.id === 'save-strategy') {
      const result = clean(structuredClone(draft));
      result.name = result.name.trim();
      const errors = validateStrategy(result);
      const box = dialog.querySelector('#editor-errors');
      box.innerHTML = errors.map((m) => `<p class="issue error">${esc(m)}</p>`).join('');
      if (errors.length) return;
      onSave(result, dialog.querySelector('[name="keep"]').checked);
      dialog.close();
    }
  });

  render();
  dialog.showModal();
}
