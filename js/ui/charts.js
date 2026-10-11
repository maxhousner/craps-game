// SVG charts for the simulator. Series colors are passed in (validated palette in sim-page.js).
// Strategy names are user-entered, so tooltips build text with textContent, never innerHTML.
import { esc } from './html.js';

const MINUS = '−';
export const signed = (n) => `${n > 0 ? '+' : n < 0 ? MINUS : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const compact = (n) => {
  const a = Math.abs(n);
  const body = a >= 1000 ? `${+(a / 1000).toFixed(a % 1000 ? 1 : 0)}K` : String(Math.round(a));
  return `${n < 0 ? MINUS : ''}$${body}`;
};

function niceTicks(lo, hi, count = 5) {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { ticks, lo: start, hi: end };
}

const shorten = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ---------- Tooltip ----------
let tip;
function tooltip() {
  tip ??= document.getElementById('chart-tip');
  return tip;
}

// rows: [{ color?, label, value }]; values lead, labels follow.
function showTip(x, y, title, rows) {
  const el = tooltip();
  el.replaceChildren();
  const h = document.createElement('p');
  h.className = 'tip-title';
  h.textContent = title;
  el.append(h);
  for (const r of rows) {
    const row = document.createElement('p');
    row.className = 'tip-row';
    if (r.color) {
      const key = document.createElement('i');
      key.style.background = r.color;
      row.append(key);
    }
    const v = document.createElement('strong');
    v.textContent = r.value;
    const l = document.createElement('span');
    l.textContent = r.label;
    row.append(v, l);
    el.append(row);
  }
  el.hidden = false;
  const pad = 14;
  const w = el.offsetWidth;
  const left = x + pad + w > innerWidth ? x - pad - w : x + pad;
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top = `${Math.max(8, y - el.offsetHeight - 10)}px`;
}

const hideTip = () => { tooltip().hidden = true; };

function legend(series, shape = 'line') {
  return `<div class="chart-legend">${series.map((s) => `
    <span><i class="key ${shape}" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}

// ---------- Range chart: one row per strategy ----------
export function rangeChart(el, rows) {
  const W = Math.max(300, el.clientWidth);
  const labelW = Math.min(190, Math.round(W * 0.34));
  const rowH = 46;
  const top = 8;
  const H = top + rows.length * rowH + 30;
  const { ticks, lo, hi } = niceTicks(Math.min(0, ...rows.map((r) => r.s.p5)), Math.max(0, ...rows.map((r) => r.s.p95)));
  const x = (v) => labelW + ((v - lo) / (hi - lo)) * (W - labelW - 14);
  const axisY = top + rows.length * rowH;

  let svg = ticks.map((t) => `
    <line class="${t === 0 ? 'zero' : 'grid'}" x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${axisY}"/>
    <text class="tick" x="${x(t)}" y="${axisY + 18}" text-anchor="middle">${compact(t)}</text>`).join('');
  rows.forEach((r, i) => {
    const cy = top + i * rowH + rowH / 2;
    const { s } = r;
    svg += `
      <text class="row-label" x="0" y="${cy + 4}">${esc(shorten(r.name, Math.floor(labelW / 7.5)))}</text>
      <line x1="${x(s.p5)}" x2="${x(s.p95)}" y1="${cy}" y2="${cy}" stroke="${r.color}" stroke-width="2" stroke-linecap="round"/>
      <rect x="${x(s.p25)}" y="${cy - 7}" width="${Math.max(2, x(s.p75) - x(s.p25))}" height="14" rx="4" fill="${r.color}"/>
      <line class="mean" x1="${x(s.mean)}" x2="${x(s.mean)}" y1="${cy - 12}" y2="${cy + 12}"/>
      <circle cx="${x(s.median)}" cy="${cy}" r="5" fill="${r.color}" class="ringed"/>
      <rect class="hit" data-i="${i}" x="0" y="${cy - rowH / 2}" width="${W}" height="${rowH}" tabindex="0"
        aria-label="${esc(r.name)}: average ${signed(s.mean)}, median ${signed(s.median)}, middle half ${signed(s.p25)} to ${signed(s.p75)}"/>`;
  });
  el.innerHTML = `
    <div class="chart-legend marks">
      <span><i class="key line" style="background:var(--muted)"></i>middle 90% of sessions</span>
      <span><i class="key bar"></i>middle 50%</span>
      <span><i class="key dot"></i>median</span>
      <span><i class="key tick"></i>average</span>
    </div>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Session results by strategy">${svg}</svg>`;

  const show = (target, px, py) => {
    const r = rows[+target.dataset.i];
    showTip(px, py, r.name, [
      { label: 'average', value: signed(r.s.mean) },
      { label: 'median', value: signed(r.s.median) },
      { label: 'middle 50%', value: `${signed(r.s.p25)} to ${signed(r.s.p75)}` },
      { label: 'middle 90%', value: `${signed(r.s.p5)} to ${signed(r.s.p95)}` },
    ]);
  };
  el.querySelectorAll('.hit').forEach((h) => {
    h.addEventListener('pointermove', (e) => show(h, e.clientX, e.clientY));
    h.addEventListener('pointerleave', hideTip);
    h.addEventListener('focus', () => { const b = h.getBoundingClientRect(); show(h, b.left + labelW, b.top + 8); });
    h.addEventListener('blur', hideTip);
  });
}

// ---------- Fan chart: bankroll over a session ----------
export function fanChart(el, series, span) {
  const W = Math.max(300, el.clientWidth);
  const H = 300;
  const pad = { l: 58, r: 16, t: 12, b: 34 };
  const k = series[0].bands.length;
  const all = series.flatMap((s) => s.bands.flatMap((b) => [b.p10, b.p90]));
  const { ticks, lo, hi } = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const rollAt = (i) => Math.round(((i + 1) * span) / k);
  const x = (roll) => pad.l + (roll / span) * plotW;
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * plotH;
  const xt = niceTicks(0, span, Math.max(3, Math.floor(plotW / 90))).ticks.filter((t) => t <= span);

  let svg = ticks.map((t) => `
    <line class="${t === 0 ? 'zero' : 'grid'}" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/>
    <text class="tick" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${compact(t)}</text>`).join('');
  svg += xt.map((t) => `<text class="tick" x="${x(t)}" y="${H - pad.b + 20}" text-anchor="middle">${t}</text>`).join('');
  svg += `<text class="axis-title" x="${W - pad.r}" y="${H - 2}" text-anchor="end">roll</text>`;
  for (const s of series) {
    const pts = (key) => [[0, 0], ...s.bands.map((b, i) => [rollAt(i), b[key]])];
    const upper = pts('p90').map(([r, v]) => `${x(r)},${y(v)}`);
    const lower = pts('p10').reverse().map(([r, v]) => `${x(r)},${y(v)}`);
    svg += `<path d="M${upper.join('L')}L${lower.join('L')}Z" fill="${s.color}" fill-opacity="0.1"/>`;
  }
  for (const s of series) {
    const line = [[0, 0], ...s.bands.map((b, i) => [rollAt(i), b.p50])].map(([r, v]) => `${x(r)},${y(v)}`).join('L');
    svg += `<path d="M${line}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  svg += `<g class="cross" visibility="hidden"><line class="crosshair" y1="${pad.t}" y2="${pad.t + plotH}"/>
    ${series.map((s) => `<circle r="4" fill="${s.color}" class="ringed"/>`).join('')}</g>
    <rect class="overlay" x="${pad.l}" y="${pad.t}" width="${plotW}" height="${plotH}" tabindex="0"
      aria-label="Bankroll over the session. Use the left and right arrow keys to read values."/>`;
  el.innerHTML = `${legend(series)}<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bankroll during a session">${svg}</svg>`;

  const cross = el.querySelector('.cross');
  const line = cross.querySelector('line');
  const dots = cross.querySelectorAll('circle');
  const overlay = el.querySelector('.overlay');
  let current = k - 1;
  const show = (i, px, py) => {
    current = Math.max(0, Math.min(k - 1, i));
    const cx = x(rollAt(current));
    line.setAttribute('x1', cx);
    line.setAttribute('x2', cx);
    series.forEach((s, j) => {
      dots[j].setAttribute('cx', cx);
      dots[j].setAttribute('cy', y(s.bands[current].p50));
    });
    cross.setAttribute('visibility', 'visible');
    showTip(px, py, `After roll ${rollAt(current)}`, series.map((s) => ({
      color: s.color,
      label: `${s.name} · 80% between ${signed(s.bands[current].p10)} and ${signed(s.bands[current].p90)}`,
      value: signed(s.bands[current].p50),
    })));
  };
  const indexAt = (clientX) => {
    const box = overlay.getBoundingClientRect();
    return Math.round(((clientX - box.left) / box.width) * k - 1);
  };
  overlay.addEventListener('pointermove', (e) => show(indexAt(e.clientX), e.clientX, e.clientY));
  const hide = () => { cross.setAttribute('visibility', 'hidden'); hideTip(); };
  overlay.addEventListener('pointerleave', hide);
  overlay.addEventListener('blur', hide);
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const box = overlay.getBoundingClientRect();
    const i = current + (e.key === 'ArrowRight' ? 1 : -1);
    show(i, box.left + ((i + 1) / k) * box.width, box.top + 20);
  });
  overlay.addEventListener('focus', () => {
    const box = overlay.getBoundingClientRect();
    show(current, box.right - 20, box.top + 20);
  });
}

// ---------- Histograms: spread of session results, one small chart per strategy ----------
export function histograms(el, series, bins = 28) {
  const W = Math.max(280, el.clientWidth);
  const H = 132;
  const pad = { l: 12, r: 12, t: 8, b: 26 };
  const sortedAll = Float64Array.from(series.flatMap((s) => Array.from(s.values))).sort();
  const q = (p) => sortedAll[Math.min(sortedAll.length - 1, Math.floor(p * (sortedAll.length - 1)))];
  let lo = Math.min(0, q(0.005));
  let hi = Math.max(0, q(0.995));
  if (hi === lo) hi = lo + 1;
  ({ lo, hi } = niceTicks(lo, hi, 6));
  const width = (hi - lo) / bins;
  const counts = series.map((s) => {
    const c = new Array(bins).fill(0);
    for (const v of s.values) c[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / width)))]++;
    return c.map((n) => n / s.values.length);
  });
  const yMax = Math.max(...counts.flat()) || 1;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const slot = plotW / bins;
  const barW = Math.min(24, slot - 2);
  const x = (v) => pad.l + ((v - lo) / (hi - lo)) * plotW;
  const xt = niceTicks(lo, hi, Math.max(3, Math.floor(plotW / 110))).ticks.filter((t) => t >= lo && t <= hi);
  const base = pad.t + plotH;

  el.innerHTML = series.map((s, si) => {
    let svg = `<line class="zero" x1="${x(0)}" x2="${x(0)}" y1="${pad.t}" y2="${base}"/>`;
    counts[si].forEach((share, b) => {
      const h = (share / yMax) * plotH;
      const bx = pad.l + b * slot + (slot - barW) / 2;
      if (h > 0) {
        const r = Math.min(4, h, barW / 2);
        const top = base - h;
        svg += `<path d="M${bx},${base}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + barW - r}Q${bx + barW},${top} ${bx + barW},${top + r}V${base}Z" fill="${s.color}"/>`;
      }
      svg += `<rect class="hit" data-s="${si}" data-b="${b}" x="${pad.l + b * slot}" y="${pad.t}" width="${slot}" height="${plotH}"/>`;
    });
    svg += `<line class="axis" x1="${pad.l}" x2="${W - pad.r}" y1="${base}" y2="${base}"/>`;
    svg += xt.map((t) => `<text class="tick" x="${x(t)}" y="${H - 6}" text-anchor="middle">${compact(t)}</text>`).join('');
    return `<figure class="multiple"><figcaption><i class="key bar" style="background:${s.color}"></i>${esc(s.name)}</figcaption>
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spread of session results for ${esc(s.name)}">${svg}</svg></figure>`;
  }).join('');

  el.querySelectorAll('.hit').forEach((h) => {
    h.addEventListener('pointermove', (e) => {
      const s = series[+h.dataset.s];
      const b = +h.dataset.b;
      const from = lo + b * width;
      const range = b === 0 ? `${signed(from + width)} or less`
        : b === bins - 1 ? `${signed(from)} or more`
        : `${signed(from)} to ${signed(from + width)}`;
      showTip(e.clientX, e.clientY, s.name, [{ color: s.color, label: `of sessions ended ${range}`, value: `${(counts[+h.dataset.s][b] * 100).toFixed(1)}%` }]);
    });
    h.addEventListener('pointerleave', hideTip);
  });
}
