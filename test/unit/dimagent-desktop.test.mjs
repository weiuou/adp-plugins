import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hookEvent, sessionID} from '../../plugins/dimagent-desktop/adapter.mjs';

const manifest = JSON.parse(await readFile(new URL('../../plugins/dimagent-desktop/adp-plugin.json', import.meta.url)));
const selected = new Set(manifest.integration.events.map(event => event.id));

test('desktop hooks publish status metadata and close the child rather than its parent', () => {
  const payload = {session_id: 'parent', prompt: 'private prompt', cwd: '/private/workspace', tool_input: {secret: true}, tool_response: 'private output'};
  for (const [name, state] of [['SessionStart','idle'],['UserPromptSubmit','working'],['PermissionRequest','waiting'],['PostToolUse','working'],['Stop','idle']]) {
    const event = hookEvent({...payload, hook_event_name: name}, selected, 100);
    assert.equal(event.state, state);
    assert.equal(event.sessionId, sessionID('parent'));
    assert.deepEqual(Object.keys(event).sort(), (['version','agent','sessionId','state','updatedAt', ...(['PermissionRequest','PostToolUse'].includes(name) ? ['continuation'] : [])]).sort());
  }
  const closed = hookEvent({...payload, hook_event_name: 'SubagentStop', agent_id: 'child'}, selected, 100);
  assert.equal(closed.state, 'closed');
  assert.equal(closed.sessionId, sessionID('child'));
  assert.notEqual(closed.sessionId, sessionID('parent'));
  assert.equal(hookEvent({...payload, hook_event_name: 'SubagentStop'}, selected), undefined);
});

test('desktop policy filters optional hooks and declares only supported command events', async () => {
  assert.equal(hookEvent({session_id:'one',hook_event_name:'PermissionRequest'}, new Set(['Stop'])), undefined);
  for (const payload of [null, [], {}, {session_id:'one',hook_event_name:'SessionEnd'}, {session_id:'',hook_event_name:'Stop'}]) {
    assert.equal(hookEvent(payload, selected), undefined);
  }
  const supported = new Set(['SessionStart','SubagentStart','PreToolUse','PermissionRequest','PostToolUse','PreCompact','PostCompact','UserPromptSubmit','SubagentStop','Stop']);
  const hooks = JSON.parse(await readFile(new URL('../../plugins/dimagent-desktop/hooks.json', import.meta.url)));
  assert.deepEqual(new Set(Object.keys(hooks.hooks)), selected);
  for (const name of Object.keys(hooks.hooks)) {
    assert.ok(supported.has(name));
    assert.match(hooks.hooks[name][0].hooks[0].commandWindows, /\$\{CLAUDE_PLUGIN_ROOT\}\/hook\.mjs/);
  }
});
