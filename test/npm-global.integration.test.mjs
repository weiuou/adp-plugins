import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {ipcPath} from './ipc-path.js';

if(!process.env.ADP_SOURCE_DIR)throw new Error('Set ADP_SOURCE_DIR to a built npm-autoload-capable ADP checkout.');
const core=file=>pathToFileURL(join(resolve(process.env.ADP_SOURCE_DIR),'dist',file)).href;
const {refreshGlobalNpmPlugins,globalNpmRoot}=await import(core('npm-plugins.js'));
const {getPlugin,changePlugin}=await import(core('agent-plugins.js'));
const {startDaemon}=await import(core('daemon.js'));
const {desktopSnapshot}=await import(core('desktop.js'));
const {request}=await import(core('client.js'));
const {saveSetting,loadSettings}=await import(core('settings.js'));
const run=promisify(execFile);

test('a real globally installed dima npm tarball is discovered, bound and removed automatically',async t=>{
  assert.ok(process.env.npm_execpath,'Run with npm run test:integration');
  const temp=await mkdtemp(join(tmpdir(),'adp-dima-npm-'));
  const keys=['ADP_CONFIG','AGENT_PRESENCE_SOCKET','ADP_NPM_ROOT','ADP_NPM_AUTOLOAD','npm_config_prefix'];
  const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));let daemon;
  process.env.ADP_CONFIG=join(temp,'config.json');process.env.AGENT_PRESENCE_SOCKET=ipcPath(temp);
  delete process.env.ADP_NPM_ROOT;process.env.ADP_NPM_AUTOLOAD='1';process.env.npm_config_prefix=join(temp,'prefix');
  t.after(async()=>{try{await daemon?.close();}finally{for(const[key,value]of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(temp,{recursive:true,force:true});}});
  const npm=(...args)=>run(process.execPath,[process.env.npm_execpath,...args],{env:process.env,windowsHide:true,timeout:30000,maxBuffer:1024*1024});
  const output=join(temp,'packages');await mkdir(output);
  const packed=JSON.parse((await npm('pack',fileURLToPath(new URL('../plugins/dima',import.meta.url)),'--ignore-scripts','--json','--pack-destination',output)).stdout)[0];
  assert.ok(packed.files.some(file=>file.path==='adp-plugin.json'));
  assert.equal(packed.files.some(file=>file.path==='.adp-runtime.json'),false);
  const tarball=join(output,packed.filename);
  const install=()=>npm('install','--global','--prefix',process.env.npm_config_prefix,'--offline','--ignore-scripts','--no-audit','--no-fund',tarball);
  const root=await globalNpmRoot();assert.ok(root.startsWith(temp));
  // Install while ADP is already running; no import action or forced refresh.
  daemon=await startDaemon({dryRun:true,log(){}});
  assert.equal(getPlugin('dimagent'),undefined);
  await install();
  const deadline=Date.now()+20000;
  while(!getPlugin('dimagent')) {
    assert.ok(Date.now()<deadline,'Running ADP did not automatically detect the globally installed package');
    await delay(250);
    await desktopSnapshot();
  }
  const plugin=getPlugin('dimagent');assert.equal(plugin.enabled,true);assert.equal(plugin.source.type,'npm-global');
  assert.equal(plugin.source.package,'adp-plugin-dima');assert.equal(plugin.manifest.version,'0.2.0');
  const binding=JSON.parse(await readFile(join(plugin.root,'.adp-runtime.json'),'utf8'));assert.equal(binding.config,process.env.ADP_CONFIG);
  assert.equal((await import(pathToFileURL(join(plugin.root,'index.js')))).default.name,'AgentDiscordPresenceDim');
  assert.ok((await desktopSnapshot()).agents.some(agent=>agent.id==='dimagent'));
  await saveSetting('customPrompt','Preserve npm settings',false,'dimagent');
  await changePlugin('dimagent','disable');await refreshGlobalNpmPlugins(true);assert.equal(getPlugin('dimagent').enabled,false);
  await changePlugin('dimagent','enable');
  await request({type:'event',event:{version:1,agent:'dimagent',sessionId:'npm-check',state:'working',updatedAt:Date.now()}});
  await npm('uninstall','--global','--prefix',process.env.npm_config_prefix,'--offline','--ignore-scripts','adp-plugin-dima');
  await refreshGlobalNpmPlugins(true);assert.equal(getPlugin('dimagent'),undefined);
  assert.equal((await request({type:'status'})).sessions.length,0);
  await install();await refreshGlobalNpmPlugins(true);assert.equal(getPlugin('dimagent').enabled,true);
  assert.equal(loadSettings().agents.dimagent.customPrompt,'Preserve npm settings');
  await changePlugin('dimagent','remove');await refreshGlobalNpmPlugins(true);assert.equal(getPlugin('dimagent'),undefined);
});
