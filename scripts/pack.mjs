import {mkdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(await readFile(join(root,'catalog.json'),'utf8'));
const host = process.argv[2];
const entry = catalog.plugins.find(plugin => plugin.path === `plugins/${host}`);
if (!entry) throw new Error('Choose a package from catalog.json, for example: npm run pack -- dima');
if (!process.env.npm_execpath) throw new Error('Run this command using npm run pack -- HOST');
const output = join(root,'dist'); await mkdir(output,{recursive:true});
const packed = spawnSync(process.execPath,[process.env.npm_execpath,'pack',join(root,entry.path),'--ignore-scripts','--json','--pack-destination',output],{windowsHide:true,encoding:'utf8'});
if (packed.status !== 0) throw new Error(packed.stderr || packed.error?.message || 'npm pack failed');
for (const pkg of JSON.parse(packed.stdout)) {
  if (pkg.files.some(file => file.path === '.adp-runtime.json')) throw new Error('A local runtime binding was included in the package');
  console.log(join(output,pkg.filename));
}
