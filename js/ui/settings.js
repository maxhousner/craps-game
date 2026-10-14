// Settings dialog: house rules (only with no bets on the table), preferences, and session reset.
import { ODDS_OPTIONS } from '../engine/rules.js';

export const SAVE_KEY = 'craps-game:v1'; // the game's saved table, stats and prefs

// The house rules saved by the game, so the guide and simulator match the player's table. {} if none.
export function savedRules() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY))?.table?.rules ?? {};
  } catch {
    return {};
  }
}

const ODDS_LABELS = { 1: '1x', 2: '2x', 3: '3x', 345: '3-4-5x (Vegas standard)', 5: '5x', 10: '10x', 20: '20x', 100: '100x' };

const OFFERED = [[true, 'Offered'], [false, 'Not offered']];

export const RULES = [
  ['tableMin', 'Table minimum', [1, 5, 10, 15, 25, 50, 100].map((v) => [v, `$${v}`]), Number],
  ['tableMax', 'Table maximum', [1000, 2000, 5000, 10000, 25000].map((v) => [v, `$${v.toLocaleString('en-US')}`]), Number],
  ['oddsMultiple', 'Max odds', ODDS_OPTIONS.map((v) => [v, ODDS_LABELS[v]]), String],
  ['field12Pays', 'Field: 12 pays', [[3, '3 to 1 (triple)'], [2, '2 to 1 (double)']], Number],
  ['barNumber', 'Don\'t side pushes on', [[12, 'Bar 12'], [2, 'Bar 2']], Number],
  ['buyVig', 'Buy bet 5% vig', [['win', 'Charged only on a win'], ['upfront', 'Charged up front']], String],
  ['layVig', 'Lay bet 5% vig', [['win', 'Charged only on a win'], ['upfront', 'Charged up front']], String],
  ['propsPay', 'Props pay (2, 3, 11, 12, hops)', [['to', '30 to 1 / 15 to 1'], ['for', '30 for 1 / 15 for 1']], String],
  ['atsPayTable', 'All / Tall / Small', [['34-175', '34 / 34 / 175 to 1'], ['30-150', '30 / 30 / 150 to 1'], ['off', 'Not offered']], String],
  ['fireBet', 'Fire Bet', OFFERED, (v) => v === 'true'],
  ['bigBets', 'Big 6 / Big 8', OFFERED, (v) => v === 'true'],
];

export function initSettings(dialog, { state, setRules, setPrefs, reset }) {
  dialog.innerHTML = `
    <form method="dialog" class="settings">
      <div class="sheet-head"><h2>Settings</h2><button class="icon-btn" value="close" aria-label="Close">✕</button></div>
      <fieldset id="rules-set">
        <legend>House rules</legend>
        <p class="note" id="rules-note" hidden>Take down all bets to change house rules.</p>
        ${RULES.map(([name, label, options]) => `
          <label class="field"><span>${label}</span>
            <select name="${name}">${options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`).join('')}
        <label class="check"><input type="checkbox" name="allowImproper">
          <span>Allow bets that aren't in proper units <small>Payouts round down to the dollar, like a real table. You'll still see a hint.</small></span></label>
      </fieldset>
      <fieldset>
        <legend>Preferences</legend>
        <label class="check"><input type="checkbox" name="fastRoll"><span>Fast roll <small>Skip the dice animation.</small></span></label>
      </fieldset>
      <fieldset>
        <legend>New session</legend>
        <label class="field"><span>Starting bankroll</span>
          <input type="number" name="startingBankroll" min="1" step="1" inputmode="numeric"></label>
        <button type="button" class="danger" id="reset-session">Reset bankroll, bets and stats</button>
      </fieldset>
    </form>`;

  const form = dialog.querySelector('form');
  form.addEventListener('change', (e) => {
    const { name } = e.target;
    const rule = RULES.find(([n]) => n === name);
    if (rule) setRules({ [name]: rule[3](e.target.value) });
    else if (name === 'allowImproper') setRules({ allowImproper: e.target.checked });
    else if (name === 'fastRoll') setPrefs({ fastRoll: e.target.checked });
    else return; // starting bankroll is only used by Reset
    fill();
  });
  dialog.querySelector('#reset-session').addEventListener('click', () => {
    const amount = Math.floor(Number(form.startingBankroll.value));
    if (!(amount >= 1)) return form.startingBankroll.focus();
    if (confirm(`Start a new session with $${amount.toLocaleString('en-US')}? This clears your bets, history and stats.`)) {
      reset(amount);
      dialog.close();
    }
  });

  function fill() {
    const { rules, prefs, hasBets } = state();
    for (const [name] of RULES) form[name].value = String(rules[name]);
    form.allowImproper.checked = rules.allowImproper;
    form.fastRoll.checked = prefs.fastRoll;
    form.startingBankroll.value = rules.startingBankroll;
    dialog.querySelector('#rules-set').disabled = hasBets;
    dialog.querySelector('#rules-note').hidden = !hasBets;
  }

  return () => {
    fill();
    dialog.showModal();
  };
}
