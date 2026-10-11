// Web Worker: runs simulations on a background thread so the page stays responsive.
// The page starts several of these, each with a slice of the sessions: { start, count }.
// Receives { strategies, settings, start, count, seed, checkpoints }; posts progress, then results.
import { runSession, sessionSeed, newResultArrays, OUTCOMES } from './simulate.js';

self.onmessage = ({ data }) => {
  const { strategies, settings, start, count: sessions, seed, checkpoints } = data;
  const results = strategies.map(() => newResultArrays(sessions, checkpoints));
  let lastPost = 0;
  try {
    for (let i = 0; i < sessions; i++) {
      const s = sessionSeed(seed, start + i);
      strategies.forEach((strategy, j) => {
        const r = runSession(strategy, settings, s, { checkpoints });
        const out = results[j];
        out.net[i] = r.net;
        out.action[i] = r.action;
        out.rolls[i] = r.rolls;
        out.maxDrawdown[i] = r.maxDrawdown;
        out.low[i] = r.low;
        out.peak[i] = r.peak;
        out.outcome[i] = OUTCOMES.indexOf(r.outcome);
        out.paths.set(r.path, i * checkpoints);
      });
      const now = performance.now();
      if (now - lastPost > 100) {
        self.postMessage({ type: 'progress', done: i + 1 });
        lastPost = now;
      }
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
    return;
  }
  const buffers = results.flatMap((r) => Object.values(r).map((a) => a.buffer));
  self.postMessage({ type: 'done', start, results }, buffers);
};
