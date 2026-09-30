const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');require('./check.cjs');
const version=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'))).version;
const dist=path.join(root,'dist'),stage=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'ambient-for-bilibili-'));
fs.mkdirSync(dist,{recursive:true});
const legal=['LICENSE'];
const copy=(name,target)=>fs.cpSync(path.join(root,name),path.join(target,name),{recursive:true});
const required=['extension','README.md','README.en.md','LICENSE','package.json','package-lock.json','.gitignore'];
const optional=['scripts','tests','docs','store','.github'];
const list=[...required,...optional.filter(name=>fs.existsSync(path.join(root,name)))];
const specs=[
  {kind:'store',dir:path.join(stage,'store'),populate:dir=>{fs.cpSync(path.join(root,'extension'),dir,{recursive:true});legal.forEach(n=>copy(n,dir));},manifest:'manifest.json',prefix:''},
  {kind:'unpacked',dir:path.join(stage,'unpacked'),populate:dir=>{
    ['extension',...legal].forEach(n=>copy(n,dir));
    fs.writeFileSync(path.join(dir,'README.txt'),`Ambient light for Bilibili ${version}\n\nOpen chrome://extensions/, enable Developer mode, choose Load unpacked and select extension/. Refresh Bilibili.\n\n打开 chrome://extensions/，启用开发者模式，选择加载已解压的扩展程序，加载 extension/ 文件夹，然后刷新 B 站。\n\nPreferences stay in chrome.storage.local. Video pixels and page layout are processed locally in memory; no data is uploaded. Uninstalling removes local preferences.\n\nMIT license and upstream copyright notices: LICENSE.\n`);
  },manifest:'extension/manifest.json',prefix:'extension/'},
  {kind:'source',dir:path.join(stage,'source'),populate:dir=>{const p=path.join(dir,'Ambient-for-bilibili');fs.mkdirSync(p,{recursive:true});list.forEach(n=>copy(n,p));},manifest:'Ambient-for-bilibili/extension/manifest.json',prefix:'Ambient-for-bilibili/extension/'}
];
const checksums=[];
function walk(dir,prefix='') {return fs.readdirSync(dir).sort().flatMap(n=>fs.statSync(path.join(dir,n)).isDirectory()?walk(path.join(dir,n),prefix+n+'/'):[prefix+n]);}
try {
for(const spec of specs) {
  fs.mkdirSync(spec.dir,{recursive:true});spec.populate(spec.dir);
  const filename=spec.kind==='unpacked'?`ambient-light-for-bilibili-${version}.zip`:`ambient-light-for-bilibili-${version}-${spec.kind}.zip`;
  const archive=path.join(dist,filename);
  fs.rmSync(archive,{force:true});const files=walk(spec.dir);
  execFileSync('zip',['-X','-q',archive,...files],{cwd:spec.dir});
  execFileSync('unzip',['-tq',archive]);
  const entries=execFileSync('unzip',['-Z','-1',archive],{encoding:'utf8'}).trim().split('\n');
  assert(entries.includes(spec.manifest));assert(!entries.some(n=>/(^|\/)(node_modules|work|dist|\.git)(\/|$)|\.DS_Store|\.env|\.pem$/.test(n)));
  assert.equal(JSON.parse(execFileSync('unzip',['-p',archive,spec.manifest],{encoding:'utf8'})).version,version);
  for(const file of walk(path.join(root,'extension')))assert(execFileSync('unzip',['-p',archive,spec.prefix+file]).equals(fs.readFileSync(path.join(root,'extension',file))),`Runtime differs: ${file}`);
  for(const n of legal)assert(entries.includes((spec.kind==='source'?'Ambient-for-bilibili/':'')+n));
  checksums.push(`${crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex')}  ${path.basename(archive)}`);
  console.log(`Verified ${path.relative(root,archive)} (${fs.statSync(archive).size} bytes)`);
}
fs.writeFileSync(path.join(dist,'SHA256SUMS'),checksums.join('\n')+'\n');

} finally {fs.rmSync(stage,{recursive:true,force:true});}
