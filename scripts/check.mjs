import assert from 'node:assert/strict';
import {readFileSync, readdirSync, lstatSync} from 'node:fs';
import {resolve, relative, isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
assert.equal(catalog.schemaVersion, 1);
assert.ok(Array.isArray(catalog.plugins));
const ids = new Set(), paths = new Set();
function inside(base, name) {
  const target = resolve(base, name), rel = relative(base, target);
  assert.ok(rel && !rel.startsWith('..') && !isAbsolute(rel), `Path escapes its package: ${name}`);
  return target;
}
for (const entry of catalog.plugins) {
  assert.ok(/^plugins\/[a-z][a-z0-9-]*$/.test(entry.path), 'Use plugins/<host> for package paths');
  assert.ok(!ids.has(entry.id) && !paths.has(entry.path), 'Duplicate package in catalog');
  ids.add(entry.id); paths.add(entry.path);
  const folder = inside(root, entry.path);
  const manifest = JSON.parse(readFileSync(join(folder, 'adp-plugin.json'), 'utf8'));
  assert.equal(manifest.apiVersion, 1);
  assert.equal(manifest.id, entry.id);
  assert.equal(manifest.version, entry.version);
  for (const key of ['icon', 'extension', 'summaryWorker']) {
    if (manifest[key]) assert.ok(lstatSync(inside(folder, manifest[key])).isFile(), `Missing ${key}`);
  }
  function walk(directory) {
    for (const file of readdirSync(directory, {withFileTypes: true})) {
      assert.ok(!file.isSymbolicLink(), 'Plugin packages must not contain symbolic links');
      assert.notEqual(file.name, '.adp-runtime.json', 'Do not publish an installed runtime binding');
      const path = join(directory, file.name);
      if (file.isDirectory()) walk(path);
      else if (file.name.endsWith('.json')) JSON.parse(readFileSync(path, 'utf8'));
      else if (/\.(?:js|mjs)$/.test(file.name)) {
        const result = spawnSync(process.execPath, ['--check', path], {windowsHide: true, encoding: 'utf8'});
        assert.equal(result.status, 0, result.stderr || result.error?.message);
      }
    }
  }
  walk(folder);
  console.log(`Checked ${entry.path} (${entry.id}@${entry.version})`);
}
const directories = readdirSync(join(root, 'plugins'), {withFileTypes: true}).filter(file => file.isDirectory());
assert.deepEqual(directories.map(file => `plugins/${file.name}`).sort(), [...paths].sort(), 'Keep catalog.json in sync with plugins/');
