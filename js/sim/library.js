// The player's saved strategies (browser storage), shared by the simulator and table autoplay.
import { PRESETS } from './presets.js';

const KEY = 'craps-game:strategies';

export function loadLibrary() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked or full: the strategy still works for this visit.
  }
}

export function saveToLibrary(strategy) {
  const list = loadLibrary();
  const i = list.findIndex((s) => s.id === strategy.id);
  if (i >= 0) list[i] = strategy;
  else list.push(strategy);
  persist(list);
}

export function removeFromLibrary(id) {
  persist(loadLibrary().filter((s) => s.id !== id));
}

export function newId() {
  return `my-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Presets first, then the player's own.
function allStrategies() {
  return [...PRESETS, ...loadLibrary()];
}

export function findStrategy(id) {
  return allStrategies().find((s) => s.id === id);
}

export const isPreset = (id) => PRESETS.some((p) => p.id === id);
