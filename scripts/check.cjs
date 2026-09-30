const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../extension');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
assert.equal(manifest.manifest_version,3);
assert.deepEqual(manifest.permissions,['storage']);
assert.equal(manifest.web_accessible_resources,undefined);
const assets=[...Object.values(manifest.icons),manifest.action.default_popup,manifest.background.service_worker,...manifest.content_scripts.flatMap(c=>[...c.js,...c.css])];
for(const file of assets)assert(fs.existsSync(path.join(root,file)),`Missing ${file}`);
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
for(const file of ['popup.html']) {
  const html=fs.readFileSync(path.join(root,file),'utf8');
  assert(!/<script\b[^>]*>\s*\S+(?!<\/script)/.test(html.replace(/<script src=[^>]*><\/script>/g,'')),'Inline script');
  for(const [,asset] of html.matchAll(/(?:src|href)="([^"]+)"/g))assert(fs.existsSync(path.join(root,asset)),asset);
}
console.log(`Manifest V3、${assets.length} 个资源及全部 JavaScript 语法检查通过。`);
const project=path.dirname(root),pkg=JSON.parse(fs.readFileSync(path.join(project,'package.json'))),lock=JSON.parse(fs.readFileSync(path.join(project,'package-lock.json')));
assert.equal(pkg.version,manifest.version);assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
assert.equal(lock.packages['node_modules/playwright'].version,pkg.devDependencies.playwright);
assert(manifest.description.length<=132);assert.equal(manifest.host_permissions,undefined);
function pngInfo(file){const b=fs.readFileSync(file);assert.equal(b.subarray(1,4).toString(),'PNG');return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),colorType:b[25]};}
for(const [size,icon] of Object.entries(manifest.icons))assert.deepEqual(Object.values(pngInfo(path.join(root,icon))).slice(0,2),[Number(size),Number(size)]);
for(const [file,width,height] of [['assets/promo-440x280.png',440,280],['screenshots/01-web-fullscreen.png',1280,800],['screenshots/02-settings.png',1280,800],['screenshots/03-comments.png',1280,800]]) {
  const image=path.join(project,'dist/store-materials',file);if(!fs.existsSync(image))continue;
  const info=pngInfo(image);assert.equal(info.width,width,file);assert.equal(info.height,height,file);
  if(!file.includes('icon'))assert.equal(info.colorType,2,`Store image must be opaque RGB: ${file}`);
}
assert(fs.existsSync(path.join(project,'PRIVACY.md')),'Missing privacy policy');
console.log('版本与锁文件一致；隐私政策、图标及可用的本地商店图片检查通过。');
