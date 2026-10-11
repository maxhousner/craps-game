// Help page: bet guide, clickable table map, house-edge chart and contents.
import { DEFAULT_RULES } from './engine/rules.js';
import { buildFelt, buildProps } from './ui/table-view.js';
import { SECTIONS, TOPICS, topic, topicFor, topicHTML } from './help-content.js';

// Use the player's saved house rules so the map matches their table.
function savedRules() {
  try {
    return { ...DEFAULT_RULES, ...JSON.parse(localStorage.getItem('craps-game:v1'))?.table?.rules };
  } catch {
    return { ...DEFAULT_RULES };
  }
}

// [label, house edge %, topic id, optional display text]
const EDGES = [
  ['Odds, taking or laying', 0, 'odds'],
  ['Don\'t Pass + 6x lay odds', 0.273, 'odds'],
  ['Pass Line + 3-4-5x odds', 0.374, 'odds'],
  ['Don\'t Pass · Don\'t Come', 300 / 220, 'dont-pass'],
  ['Pass Line · Come', 700 / 495, 'pass'],
  ['Place 6 or 8', 100 / 66, 'place'],
  ['Buy or Lay 4 or 10', 100 / 60, 'buy'],
  ['Buy or Lay 5 or 9', 2.0, 'buy'],
  ['Buy or Lay 6 or 8', 100 / 44, 'buy'],
  ['Field (12 pays 3 to 1)', 100 / 36, 'field'],
  ['Place 5 or 9', 4.0, 'place'],
  ['Field (12 pays 2 to 1)', 200 / 36, 'field'],
  ['Place 4 or 10', 100 / 15, 'place'],
  ['All', 7.46, 'ats'],
  ['Small · Tall', 7.76, 'ats'],
  ['Big 6 or 8', 100 / 11, 'big'],
  ['Hard 6 or 8', 100 / 11, 'hardways'],
  ['Hard 4 or 10', 100 / 9, 'hardways'],
  ['Any Craps · C & E', 100 / 9, 'any-craps'],
  ['Ace-Deuce · Yo · easy hops', 100 / 9, 'prop-numbers'],
  ['Horn High', 12.22, 'horn-high', '12.2–12.8%'],
  ['Horn', 12.5, 'horn'],
  ['World', 40 / 3, 'world'],
  ['Aces · Boxcars · hard hops', 500 / 36, 'prop-numbers'],
  ['Any Seven', 100 / 6, 'any-seven'],
  ['Fire Bet', 20.76, 'fire'],
];

function renderGuide() {
  document.getElementById('bet-guide').innerHTML = SECTIONS.map((s) => `
    <section class="help-section" id="${s.id}">
      <h2>${s.title}</h2>
      <p>${s.intro}</p>
      ${TOPICS.filter((t) => t.section === s.id).map((t) => topicHTML(t, { anchor: true })).join('')}
    </section>`).join('');
}

function renderEdges() {
  const max = Math.max(...EDGES.map(([, e]) => e));
  const grade = (e) => (e < 1.5 ? 'good' : e < 3 ? 'ok' : e < 8 ? 'meh' : 'bad');
  document.getElementById('edge-table').innerHTML = EDGES.map(([label, edge, id, shown]) => `
    <div class="edge-row">
      <a href="#${id}">${label}</a>
      <span class="edge-val">${shown ?? `${edge.toFixed(2)}%`}</span>
      <span class="edge-bar" aria-hidden="true"><i class="${grade(edge)}" style="width:${Math.max(1, (100 * edge) / max)}%"></i></span>
    </div>`).join('');
}

function renderMap() {
  const rules = savedRules();
  buildFelt(document.getElementById('map-felt'), rules);
  buildProps(document.getElementById('map-props'), rules);
  document.querySelectorAll('.help-map .spot').forEach((spot) => {
    const id = topicFor(spot.dataset.key ?? spot.dataset.odds, !!spot.dataset.odds);
    spot.title = topic(id).title;
  });
  document.querySelector('.help-map').addEventListener('click', (e) => {
    const spot = e.target.closest('.spot');
    if (spot) location.hash = topicFor(spot.dataset.key ?? spot.dataset.odds, !!spot.dataset.odds);
  });
}

function renderToc() {
  const items = [...document.querySelectorAll('.guide .help-section')].map((s) => {
    const topics = [...s.querySelectorAll('.topic[id]')];
    const sub = topics.length
      ? `<ol>${topics.map((t) => `<li><a href="#${t.id}">${t.querySelector('h3').textContent}</a></li>`).join('')}</ol>`
      : '';
    return `<li><a href="#${s.id}">${s.querySelector('h2').textContent}</a>${sub}</li>`;
  });
  document.getElementById('toc').innerHTML = `<ol>${items.join('')}</ol>`;
}

renderGuide();
renderEdges();
renderMap();
renderToc();
// The bet sections were added after load, so jump to a linked section now that it exists.
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
