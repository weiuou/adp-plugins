import {createHash} from 'node:crypto';

export const agentID = 'dimagent-desktop';
export const sessionID = id => `desktop:${createHash('sha256').update(id).digest('hex')}`;

const states = {
  SessionStart: 'idle', UserPromptSubmit: 'working', Stop: 'idle',
  PreToolUse: 'working', PostToolUse: 'working', PermissionRequest: 'waiting',
  PreCompact: 'working', PostCompact: 'working', SubagentStop: 'closed',
};
const continuations = new Set(['PreToolUse', 'PostToolUse', 'PermissionRequest', 'PreCompact', 'PostCompact']);

// Only publish status metadata. Prompts, arguments, tool output and workspace
// paths from the host's hook payload never enter the Presence protocol.
export function hookEvent(payload, selected, now = Date.now()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  const hook = payload.hook_event_name;
  if (typeof hook !== 'string' || !Object.hasOwn(states, hook) || !selected.has(hook)) return;
  // SubagentStop's session_id refers to the parent; agent_id identifies the child.
  const id = hook === 'SubagentStop' ? payload.agent_id : payload.session_id;
  if (typeof id !== 'string' || !id.trim() || id.length > 4096) return;
  const event = {version: 1, agent: agentID, sessionId: sessionID(id), state: states[hook], updatedAt: now};
  if (continuations.has(hook)) event.continuation = true;
  for (const key of ['model', 'provider']) {
    if (typeof payload[key] === 'string' && payload[key].length <= 256) event[key] = payload[key];
  }
  return event;
}
