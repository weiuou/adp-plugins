import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {ipcPath} from './ipc-path.js';
import {sessionID} from '../plugins/dimagent-desktop/adapter.mjs';

if (!process.env.ADP_SOURCE_DIR) throw new Error('Set ADP_SOURCE_DIR to a built plugin-capable ADP checkout.');
const core = file => pathToFileURL(join(resolve(process.env.ADP_SOURCE_DIR), 'dist', file)).href;
const {installPlugin, getPlugin, listPlugins, changePlugin} = await import(core('agent-plugins.js'));
const {startDaemon} = await import(core('daemon.js'));
const {request} = await import(core('client.js'));
const {planUninstall, uninstallIntegration} = await import(core('uninstall.js'));

test('managed desktop hook subprocesses report states, honor partial removal and fail without affecting the host', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'adp-desktop-plugin-'));
  const before = {ADP_CONFIG:process.env.ADP_CONFIG, AGENT_PRESENCE_SOCKET:process.env.AGENT_PRESENCE_SOCKET};
  process.env.ADP_CONFIG = join(directory, 'config.json');
  process.env.AGENT_PRESENCE_SOCKET = ipcPath(directory);
  let daemon;
  t.after(async () => {
    try {await daemon?.close();} finally {
      for (const [key,value] of Object.entries(before)) value === undefined ? delete process.env[key] : process.env[key] = value;
      await rm(directory, {recursive:true,force:true});
    }
  });
  await installPlugin(fileURLToPath(new URL('../plugins/dima', import.meta.url)));
  await installPlugin(fileURLToPath(new URL('../plugins/dimagent-desktop', import.meta.url)));
  assert.deepEqual(listPlugins().map(plugin => plugin.id).sort(), ['dimagent','dimagent-desktop']);
  const installed = getPlugin('dimagent-desktop');
  daemon = await startDaemon({dryRun:true,staleMs:60_000,log(){}});
  async function hook(payload, extraEnv = {}) {
    const output = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [join(installed.root,'hook.mjs')], {env:{...process.env,...extraEnv},windowsHide:true,stdio:['pipe','pipe','pipe']});
      let stdout = '', stderr = '';
      child.stdout.on('data', chunk => stdout += chunk);
      child.stderr.on('data', chunk => stderr += chunk);
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve({stdout,stderr}) : reject(new Error(`Hook exited ${code}: ${stderr}`)));
      child.stdin.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
    });
    assert.deepEqual(output, {stdout:'',stderr:''});
  }
  const state = id => daemon.store.sessions.get(`dimagent-desktop:${sessionID(id)}`)?.state;
  for (const [name, expected] of [['SessionStart','idle'],['UserPromptSubmit','working'],['PermissionRequest','waiting'],['PostToolUse','working'],['Stop','idle']]) {
    await hook({hook_event_name:name,session_id:'parent',prompt:'must not be retained',tool_response:'must not be retained'});
    assert.equal(state('parent'), expected);
  }
  await hook({hook_event_name:'SessionStart',session_id:'child'});
  await hook({hook_event_name:'SubagentStop',session_id:'parent',agent_id:'child'});
  assert.equal(state('child'), undefined);
  assert.equal(state('parent'), 'idle');
  await hook({hook_event_name:'SessionStart',session_id:'summary-worker'}, {ADP_SUMMARY_WORKER:'1'});
  assert.equal(state('summary-worker'), undefined);
  const plan = await planUninstall('dimagent-desktop', undefined, ['PermissionRequest','PreToolUse']);
  await uninstallIntegration('dimagent-desktop', undefined, plan.revision, ['PermissionRequest','PreToolUse']);
  await hook({hook_event_name:'PermissionRequest',session_id:'parent'});
  assert.equal(state('parent'), 'idle');
  await hook('not JSON');
  await hook({hook_event_name:'SubagentStop',session_id:'parent'});
  assert.equal(state('parent'), 'idle');
  const status = await request({type:'status'});
  assert.equal(status.sessions[0].label, 'DimAgent Desktop');
  assert.equal('prompt' in status.sessions[0], false);
  daemon.store.sweep(Date.now() + 60_001);
  assert.equal(state('parent'), undefined, 'Hooks without a host close event must still expire');
  await changePlugin('dimagent-desktop','disable');
  await hook({hook_event_name:'UserPromptSubmit',session_id:'parent'});
  assert.equal((await request({type:'status'})).sessions.length, 0);
  assert.equal(getPlugin('dimagent').enabled, true);
  await daemon.close(); daemon = undefined;
  await hook({hook_event_name:'SessionStart',session_id:'offline'});
});
