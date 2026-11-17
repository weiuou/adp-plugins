import {readFileSync, existsSync} from 'node:fs';
import {createDimPlugin} from './extension.mjs';
// Managed copies receive a stable SDK binding when installed through the GUI.
const binding = new URL('./.adp-runtime.json', import.meta.url);
const runtime = existsSync(binding) ? JSON.parse(readFileSync(binding, 'utf8')) : undefined;
if (runtime?.config) process.env.ADP_CONFIG ??= runtime.config;
if (runtime?.socket) process.env.AGENT_PRESENCE_SOCKET ??= runtime.socket;
if (!runtime?.sdk) throw new Error('Install this package through ADP Agents > Install local plugin before loading it in dima.');
const sdkURL = runtime.sdk;
const sdk = await import(sdkURL);
export default createDimPlugin(sdk);
