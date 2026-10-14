import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { globSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);

// The other suites only import the engine and simulator, so a syntax error in a
// UI or guide file (like an unescaped apostrophe) would pass them and still
// stop the site from loading. `node --check` parses each file without running it.
test('every JavaScript file parses', async () => {
  const files = globSync('{js,tests}/**/*.js');
  assert.ok(files.length > 20, `expected the project's JS files, found ${files.length}`);
  const failures = [];
  await Promise.all(files.map(file =>
    run(process.execPath, ['--check', file]).catch(err => failures.push(err.stderr.trim()))
  ));
  assert.deepEqual(failures, []);
});
