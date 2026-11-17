import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, mkdir, rm, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
const adpSource=process.env.ADP_SOURCE_DIR;
if(!adpSource)throw new Error('Set ADP_SOURCE_DIR to a built plugin-capable ADP checkout before running integration tests.');
const adpRoot=resolve(adpSource);
const adpURL=file=>pathToFileURL(join(adpRoot,'dist',file)).href;
const {installPlugin, changePlugin, listPlugins, getPlugin, readPlugin}=await import(adpURL('agent-plugins.js'));
const {catalogFor, selectEvents, scenariosFor}=await import(adpURL('integration-events.js'));
const {policyPath, adapterEvents}=await import(adpURL('integration-config.js'));
const {planSetup, applySetup}=await import(adpURL('setup.js'));
const {planUninstall, uninstallIntegration}=await import(adpURL('uninstall.js'));
const {handleDesktopRequest}=await import(adpURL('desktop.js'));
const {startDaemon}=await import(adpURL('daemon.js'));
const sdk=await import(adpURL('plugin-sdk.js'));
import {createDimPlugin, dimSessionId} from '../plugins/dima/extension.mjs';
import {ipcPath} from './ipc-path.js';

const exec=promisify(execFile);
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'adp-dim-policy-')),cleanups=[];
 const before={ADP_CONFIG:process.env.ADP_CONFIG,AGENT_PRESENCE_SOCKET:process.env.AGENT_PRESENCE_SOCKET};
 process.env.ADP_CONFIG=join(dir,'config.json');process.env.AGENT_PRESENCE_SOCKET=ipcPath(dir);
 t.after(async()=>{try{for(const fn of cleanups.reverse())await fn();}finally{for(const [key,value]of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(dir,{recursive:true,force:true});}});
 await installPlugin(fileURLToPath(new URL('../plugins/dima/',import.meta.url)));
 return {dir,cleanup:fn=>cleanups.push(fn)};
}
async function until(check){for(let i=0;i<200;i++){if(await check())return;await delay(10);}assert.fail('Dim policy condition timed out');}

test('Dim policy supports upstream scenarios, preview/apply, partial removal and stale-preview protection',async t=>{
 const {dir}=await fixture(t),path=policyPath('dimagent'),catalog=catalogFor('dimagent');
 assert.equal(listPlugins()[0].managedIntegration,true);
 assert.ok(catalog.some(e=>e.id==='approval/request'&&e.capability==='waiting'));
 assert.ok(scenariosFor('dimagent').some(s=>s.id==='reply-summary'));
 const setup=await handleDesktopRequest({action:'integration',agent:'dimagent'});
 assert.equal(setup.ok,true,JSON.stringify(setup));assert.equal(setup.setupPlan.kind,'policy');
 assert.match(setup.integration.content,/setup dimagent --events/);assert.match(setup.integration.content,/dima plugin install/);
 const whole=await planUninstall('dimagent');assert.equal(whole.kind,'managed');assert.equal(whole.status,'manual');assert.match(whole.note,/dima/);
 const waiting=catalog.filter(e=>e.capability==='waiting').map(e=>e.id);
 await assert.rejects(planUninstall('dimagent',undefined,[waiting[0]]),/requires/);
 const preview=await planUninstall('dimagent',undefined,waiting);assert.equal(preview.partial,true);assert.equal(preview.status,'ready');
 assert.equal(preview.path,path);await assert.rejects(readFile(path),{code:'ENOENT'});
 let removed=await uninstallIntegration('dimagent',undefined,preview.revision,waiting);assert.equal(removed.removed,true);
 let policy=JSON.parse(await readFile(path,'utf8'));assert.equal(policy.events.some(id=>waiting.includes(id)),false);
 for(const e of catalog.filter(e=>e.required))assert.ok(policy.events.includes(e.id));
 assert.equal(adapterEvents('dimagent').has('approval/request'),false);
 assert.equal((await planUninstall('dimagent',undefined,waiting)).status,'not-found');
 await assert.rejects(planUninstall('dimagent',undefined,['branch/end']),/Required/);
 policy.note='Keep unrelated metadata';await writeFile(path,JSON.stringify(policy));
 let plan=await planSetup('dimagent',{profile:'recommended'});
 const applied=await applySetup('dimagent',{events:plan.selectedEvents},plan.revision);assert.ok(applied.backup);
 assert.equal(JSON.parse(await readFile(path,'utf8')).note,policy.note);
 const summary=catalog.filter(e=>e.capability==='summary').map(e=>e.id);
 let partial=await planUninstall('dimagent',undefined,summary);const original=await readFile(path,'utf8');
 await writeFile(path,JSON.stringify({...JSON.parse(original),note:'Concurrent change'}));
 await assert.rejects(uninstallIntegration('dimagent',undefined,partial.revision,summary),/changed/);
 partial=await planUninstall('dimagent',undefined,summary);
 removed=await uninstallIntegration('dimagent',undefined,partial.revision,summary);
 assert.equal(JSON.parse(await readFile(path,'utf8')).note,'Concurrent change');assert.ok(removed.backup);
 await assert.rejects(planSetup('dimagent',{path:join(dir,'other.json')}),/policy file/);
 await changePlugin('dimagent','disable');assert.equal((await planUninstall('dimagent')).kind,'managed');
 await assert.rejects(planSetup('dimagent'),/Enable/);
});

test('Dim native observer filters disabled waiting and reply collection while retaining lifecycle and cleanup',async t=>{
 const f=await fixture(t),daemon=await startDaemon({dryRun:true,log(){}});f.cleanup(()=>daemon.close());
 const catalog=catalogFor('dimagent');
 async function mount(){
  let observer,callback,closeSession,closeSummaries,resolveClosing,calls=0,readText=0;
  const closing=new Promise(resolve=>{resolveClosing=resolve;});
  const auxiliary={async complete(){calls++;return {stopReason:'end_turn',text:JSON.stringify({topic:'Dim policy verified',subtitle:'Configured events'})};}};
  const plugin=createDimPlugin({...sdk});
  await plugin.apply({get:key=>key==='auxiliaryModel'?auxiliary:{async registerDefinition(_kind,_name,definition){observer=definition;}},effect:fn=>{closeSummaries=fn();}});
  const sessionID=`native-${Math.random()}`,key=`dimagent:${dimSessionId(sessionID,'main')}`;
  const services={sessionIdentity:{async get(){return {sessionId:sessionID};}},sessionConfig:{async get(){return {model:{modelId:'fixture-model',providerId:'fixture-provider'}};}},sessionLifecycle:{closing:()=>closing,activated:()=>Promise.resolve(true)}};
  await observer.apply({get:name=>services[name],effect:fn=>{closeSession=fn();},on(_channel,fn){callback=fn;}});
  const dispose=async()=>{resolveClosing();await closeSession();await closeSummaries();};f.cleanup(dispose);
  await until(()=>daemon.store.sessions.has(key));
  const send=(kind,data={})=>{const [type,name]=kind.split('/');callback({kind:'event',branchId:'main',event:{type,name,data}});};
  const state=()=>daemon.store.sessions.get(key)?.state;
  const reply=()=>{
   send('step/model-start',{turn_id:'turn',request_id:'request'});
   send('step/text',{turn_id:'turn',request_id:'request',get delta(){readText++;return 'Completed Dim task';}});
   send('step/model-output-end',{turn_id:'turn',request_id:'request',status:'completed',finish_reason:'end_turn'});
   send('turn/end',{turn_id:'turn',status:'completed'});
  };
  return {send,state,reply,key,dispose,calls:()=>calls,readText:()=>readText};
 }
 let host=await mount();host.send('turn/start',{turn_id:'turn'});await until(()=>host.state()==='working');
 host.send('approval/request',{approval_id:'one'});await until(()=>host.state()==='waiting');
 host.send('approval/respond',{approval_id:'one'});await until(()=>host.state()==='working');
 host.reply();await until(()=>daemon.store.sessions.get(host.key)?.summary?.topic==='Dim policy verified');
 assert.equal(host.calls(),1);assert.ok(host.readText()>0);
 host.send('turn/start',{turn_id:'failed'});await until(()=>host.state()==='working');host.send('turn/end',{turn_id:'failed',status:'failed'});await until(()=>host.state()==='error');
 await host.dispose();
 const disable=catalog.filter(e=>['waiting','summary','errors'].includes(e.capability)).map(e=>e.id);
 const preview=await planUninstall('dimagent',undefined,disable);await uninstallIntegration('dimagent',undefined,preview.revision,disable);
 host=await mount();host.send('turn/start',{turn_id:'turn'});await until(()=>host.state()==='working');
 host.send('approval/request',{approval_id:'one'});await delay(30);assert.equal(host.state(),'working');
 host.reply();await until(()=>host.state()==='idle');await delay(30);assert.equal(host.calls(),0);assert.equal(host.readText(),0);
 host.send('turn/start',{turn_id:'failed'});await until(()=>host.state()==='working');host.send('turn/end',{turn_id:'failed',status:'failed'});await until(()=>host.state()==='idle');
 host.send('branch/end');await until(()=>!daemon.store.sessions.has(host.key));
});

test('Dim event policies survive CLI round trips; invalid files never get overwritten',async t=>{
 const {dir}=await fixture(t),path=policyPath('dimagent');
 const args=[fileURLToPath(new URL(adpURL('cli.js'))),'setup','dimagent','--profile','lightweight'];
 await exec(process.execPath,[...args,'--dry-run'],{env:{...process.env}});await assert.rejects(readFile(path),{code:'ENOENT'});
 await exec(process.execPath,args,{env:{...process.env}});
 assert.deepEqual(JSON.parse(await readFile(path,'utf8')).events,selectEvents('dimagent',{profile:'lightweight'}));
 await writeFile(path,'{invalid');const plan=await planSetup('dimagent');assert.equal(plan.status,'manual');
 assert.equal((await applySetup('dimagent',{},plan.revision)).changed,false);assert.equal(await readFile(path,'utf8'),'{invalid');
 assert.deepEqual([...adapterEvents('dimagent')],catalogFor('dimagent').filter(e=>e.required).map(e=>e.id));
 const source=join(dir,'manifest');await mkdir(source);const manifest=JSON.parse(await readFile(join(getPlugin('dimagent').root,'adp-plugin.json'),'utf8'));
 delete manifest.icon;delete manifest.extension;manifest.integration.events[0].requires=['unknown/event'];
 await writeFile(join(source,'adp-plugin.json'),JSON.stringify(manifest));assert.throws(()=>readPlugin(source),/dependency/);
});
