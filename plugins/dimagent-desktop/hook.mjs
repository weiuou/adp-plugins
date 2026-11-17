import {readFile} from 'node:fs/promises';
import {agentID, hookEvent} from './adapter.mjs';

if (process.env.ADP_SUMMARY_WORKER === '1') process.exit(0);

// Hook output can change the host's behavior. Always stay silent and leave
// model calls, permissions and replies untouched, even when ADP is unavailable.
try {
  let input = '', bytes = 0;
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 1024 * 1024) process.exit(0);
    input += chunk;
  }
  const payload = JSON.parse(input);
  const binding = JSON.parse(await readFile(new URL('./.adp-runtime.json', import.meta.url), 'utf8'));
  if (binding.config) process.env.ADP_CONFIG ??= binding.config;
  if (binding.socket) process.env.AGENT_PRESENCE_SOCKET ??= binding.socket;
  const sdk = await import(binding.sdk);
  const event = hookEvent(payload, sdk.adapterEvents(agentID));
  if (event) await sdk.emit(event);
} catch { /* Presence must never interrupt a DimAgent session. */ }
