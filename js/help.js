// Help page: bet guide, clickable table map, house-edge chart and contents.
import { DEFAULT_RULES } from './engine/rules.js';
import { buildFelt, buildProps } from './ui/table-view.js';
import { SECTIONS, TOPICS, topic, topicFor, topicHTML } from './help-content.js';
import { initToTop } from './ui/to-top.js';
import { savedRules } from './ui/settings.js';

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

// The contents, grouped. Section ids are the guide's anchors, so links into the guide keep working.
const GROUPS = [
  ['Learn', ['basics', 'using', 'map']],
  ['Bets', ['line-bets', 'number-bets', 'center-bets', 'side-bets']],
  ['Reference', ['working', 'proper-units', 'house-edge', 'smart-play', 'simulator', 'house-rules', 'glossary']],
];

// A small copy of the table under each bet's summary, with that bet's spots lit. Filled in by renderMiniMaps.
const miniMap = (id) => `<div class="mini-map" data-topic="${id}" inert aria-hidden="true"></div>`;
const spotTopic = (spot) => topicFor(spot.dataset.key ?? spot.dataset.odds, !!spot.dataset.odds);

function renderGuide() {
  document.getElementById('bet-guide').innerHTML = SECTIONS.map((s) => `
    <section class="help-section" id="${s.id}">
      <h2>${s.title}</h2>
      <p>${s.intro}</p>
      ${TOPICS.filter((t) => t.section === s.id).map((t) => topicHTML(t, { anchor: true, extra: miniMap(t.id) })).join('')}
    </section>`).join('');
}

// Bar color for a house edge %.
function grade(edge) {
  if (edge < 1.5) return 'good';
  if (edge < 3) return 'ok';
  if (edge < 8) return 'meh';
  return 'bad';
}

function renderEdges() {
  const max = Math.max(...EDGES.map(([, e]) => e));
  document.getElementById('edge-table').innerHTML = EDGES.map(([label, edge, id, shown]) => `
    <div class="edge-row">
      <a href="#${id}">${label}</a>
      <span class="edge-val">${shown ?? `${edge.toFixed(2)}%`}</span>
      <span class="edge-bar" aria-hidden="true"><i class="${grade(edge)}" style="width:${Math.max(1, (100 * edge) / max)}%"></i></span>
    </div>`).join('');
}

function renderMap() {
  // The guide explains every bet, so the map also shows the ones this table doesn't offer.
  const rules = { ...DEFAULT_RULES, ...savedRules(), bigBets: true, fireBet: true };
  if (rules.atsPayTable === 'off') rules.atsPayTable = DEFAULT_RULES.atsPayTable;
  buildFelt(document.getElementById('map-felt'), rules);
  buildProps(document.getElementById('map-props'), rules);
  document.querySelectorAll('.help-map .spot').forEach((spot) => {
    spot.title = topic(spotTopic(spot)).title;
  });
  document.querySelector('.help-map').addEventListener('click', (e) => {
    const spot = e.target.closest('.spot');
    if (spot) location.hash = spotTopic(spot);
  });
}

function renderMiniMaps() {
  const sources = [document.getElementById('map-felt'), document.getElementById('map-props')];
  document.querySelectorAll('.mini-map').forEach((mini) => {
    const id = mini.dataset.topic;
    const source = sources.find((el) => [...el.querySelectorAll('.spot')].some((s) => spotTopic(s) === id));
    if (!source) return mini.remove(); // e.g. put bets, which have no spot of their own
    const copy = source.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    copy.querySelectorAll('.spot').forEach((s) => s.classList.toggle('lit', spotTopic(s) === id));
    copy.querySelectorAll('details').forEach((d) => { d.open = id === 'hop'; });
    if (source.id === 'map-props') {
      const strip = document.createElement('div');
      strip.className = 'center';
      strip.append(copy);
      mini.append(strip);
    } else {
      mini.append(copy);
    }
  });
}

function renderToc() {
  const item = (id) => {
    const s = document.getElementById(id);
    const topics = [...s.querySelectorAll('.topic[id]')];
    const sub = topics.length
      ? `<ol>${topics.map((t) => `<li><a href="#${t.id}">${t.querySelector('h3').textContent}</a></li>`).join('')}</ol>`
      : '';
    return `<li><a href="#${id}">${s.querySelector('h2').textContent}</a>${sub}</li>`;
  };
  const html = GROUPS.map(([name, ids]) => `
    <div class="toc-group"><h2>${name}</h2><ol>${ids.map(item).join('')}</ol></div>`).join('');
  document.getElementById('toc').innerHTML = html;
  document.getElementById('toc-sheet-list').innerHTML = html;

  // Phones: the sticky Contents bar opens the list as a sheet; picking a link closes it.
  const sheet = document.getElementById('toc-sheet');
  document.getElementById('toc-open').addEventListener('click', () => sheet.showModal());
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet || e.target.closest('a, [data-close]')) sheet.close();
  });
}

// Light up the contents entries for the part of the guide on screen, open that section's list of
// bets in the sidebar, and name it in the phone's Contents bar.
function trackPosition() {
  const toc = document.getElementById('toc');
  const here = document.getElementById('toc-here');
  const wide = matchMedia('(min-width: 960px)');
  const links = new Map();
  for (const a of document.querySelectorAll('.toc a, #toc-sheet-list a')) {
    const id = a.hash.slice(1);
    links.set(id, [...(links.get(id) ?? []), a]);
  }
  const targets = [...document.querySelectorAll('.guide .help-section, .guide .topic[id]')].filter((el) => links.has(el.id));
  let lit = [];
  let queued = false;
  const update = () => {
    queued = false;
    let at = null;
    for (const el of targets) {
      if (el.getBoundingClientRect().top > 140) break;
      at = el;
    }
    // The section on screen, then the bet card within it (a Set drops the repeat when `at` is the section).
    const path = at ? [...new Set([at.closest('.help-section'), at])] : [];
    const next = path.flatMap((el) => links.get(el.id));
    if (next.length !== lit.length || next.some((a, i) => a !== lit[i])) {
      lit.forEach((a) => a.removeAttribute('aria-current'));
      next.forEach((a) => a.setAttribute('aria-current', 'location'));
      toc.querySelectorAll('li.open').forEach((li) => li.classList.remove('open'));
      if (path[0]) links.get(path[0].id).find((a) => toc.contains(a)).parentElement.classList.add('open');
      here.textContent = path.map((el) => el.querySelector('h2, h3').textContent).join(' · ');
      const side = next.filter((a) => toc.contains(a)).at(-1);
      if (wide.matches && side) side.scrollIntoView({ block: 'nearest' });
      lit = next;
    }
  };
  addEventListener('scroll', () => {
    if (!queued) requestAnimationFrame(update);
    queued = true;
  }, { passive: true });
  update();
}

renderGuide();
renderEdges();
renderMap();
renderMiniMaps();
renderToc();
trackPosition();
initToTop(document.getElementById('to-top'));
// The bet sections were added after load, so jump to a linked section now that it exists.
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
