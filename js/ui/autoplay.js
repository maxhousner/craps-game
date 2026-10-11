// Autoplay dialog: pick a strategy and speed; the game then bets and rolls on its own.
import { describePlan } from '../sim/strategy.js';
import { PRESETS } from '../sim/presets.js';
import { loadLibrary, findStrategy } from '../sim/library.js';
import { esc } from './html.js';

const SPEEDS = {
  slow: { label: 'Slow: watch every roll', delay: 1800, fast: false },
  normal: { label: 'Normal', delay: 700, fast: false },
  fast: { label: 'Fast: no dice animation', delay: 250, fast: true },
  turbo: { label: 'Turbo', delay: 40, fast: true },
};

export function initAutoplay(dialog, { onStart }) {
  let lastId = PRESETS[0].id;
  let lastSpeed = 'normal';

  function open() {
    const lib = loadLibrary();
    if (!findStrategy(lastId)) lastId = PRESETS[0].id;
    dialog.innerHTML = `
      <form class="settings autoplay-form">
        <div class="sheet-head"><h2>Autoplay</h2><button type="button" class="icon-btn" data-auto-close aria-label="Close">✕</button></div>
        <p class="note">Pick a strategy and the game will bet and roll for you on this table, with your bankroll. Pause or stop any time.</p>
        <label class="field"><span>Strategy</span>
          <select name="strategy">
            <optgroup label="Popular strategies">${PRESETS.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>
            ${lib.length ? `<optgroup label="My strategies">${lib.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</optgroup>` : ''}
          </select></label>
        <div class="auto-desc" id="auto-desc"></div>
        <label class="field"><span>Speed</span>
          <select name="speed">${Object.entries(SPEEDS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select></label>
        <label class="field"><span>Stop after</span>
          <input name="limit" type="number" min="1" step="1" inputmode="numeric" placeholder="Keep going (rolls)"></label>
        <p class="note">Bets already on the table stay put; the strategy adds and adjusts its own bets.
          <a href="simulate.html">Build or test strategies in the simulator</a></p>
        <div class="editor-actions"><span class="spacer"></span>
          <button type="button" class="ghost" data-auto-close>Cancel</button>
          <button type="submit" class="roll-btn">Start</button></div>
      </form>`;
    const form = dialog.querySelector('form');
    form.strategy.value = lastId;
    form.speed.value = lastSpeed;
    const describe = () => {
      const s = findStrategy(form.strategy.value);
      dialog.querySelector('#auto-desc').innerHTML = `${s.notes ? `<p>${esc(s.notes)}</p>` : ''}
        <ul>${s.plans.map((p) => `<li>${describePlan(p)}</li>`).join('')}</ul>`;
    };
    form.strategy.addEventListener('change', describe);
    form.addEventListener('click', (e) => {
      if (e.target.closest('[data-auto-close]')) dialog.close();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      lastId = form.strategy.value;
      lastSpeed = form.speed.value;
      const limit = Math.floor(Number(form.limit.value)) || 0;
      dialog.close();
      onStart(structuredClone(findStrategy(lastId)), SPEEDS[lastSpeed], limit);
    });
    describe();
    dialog.showModal();
  }

  return open;
}
