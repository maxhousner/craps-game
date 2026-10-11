import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cryptoDie, seededDice } from '../js/engine/dice.js';

// Chi-square goodness of fit for six equally likely faces (5 degrees of freedom).
function chiSquare(draw, n) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const d = draw();
    assert.ok(d >= 1 && d <= 6);
    counts[d - 1]++;
  }
  const expected = n / 6;
  return counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
}

test('crypto dice are fair (chi-square, p > 0.00001)', () => {
  assert.ok(chiSquare(cryptoDie, 600_000) < 31.0);
});

test('seeded dice are fair and repeatable', () => {
  const { die } = seededDice(42);
  assert.ok(chiSquare(die, 600_000) < 20.5); // p > 0.001; deterministic for this seed
  const a = seededDice(7);
  const b = seededDice(7);
  for (let i = 0; i < 100; i++) assert.deepEqual(a.roll(), b.roll());
});
