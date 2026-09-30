const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx=vm.createContext({URL});
for(const file of ['config.js','core.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),ctx);
const A=ctx.BiliAmbient,plain=v=>JSON.parse(JSON.stringify(v));
test('settings reject unknown values and clamp numeric bounds',()=>{
  const s=A.sanitize({enabled:'false',blur:Infinity,spread:999,renderer:'script',cropHorizontal:-5,opacity:80,unexpected:1});
  assert.equal(s.enabled,true);assert.equal(s.blur,30);assert.equal(s.spread,200);assert.equal(s.renderer,'webgl');
  assert.equal(s.cropHorizontal,0);assert.equal(s.opacity,80);assert.equal(s.unexpected,undefined);
});
test('playback routes exclude homepage, profiles, and searches',()=>{
  for(const url of ['https://www.bilibili.com/video/BV1/?p=2','https://www.bilibili.com/bangumi/play/ep123','https://player.bilibili.com/player.html','https://live.bilibili.com/123','https://live.bilibili.com/blanc/123','https://www.bilibili.com/list/123','https://www.bilibili.com/festival/demo'])assert(A.isPlaybackPage(url));
  for(const url of ['https://www.bilibili.com/','https://live.bilibili.com/','https://www.bilibili.com/v/popular','https://example.com/video/1'])assert(!A.isPlaybackPage(url));
});
test('projection scales match upstream inner layers and equal pixel spread',()=>{
  const s=plain(A.scales(1600,900,A.defaults));
  assert.equal(s.length,4);assert.equal(s[2].x,1);assert.equal(s[2].y,1);
  assert(Math.abs((s.at(-1).x-1)*1600-(s.at(-1).y-1)*900)<1e-9);
  assert.equal(s.at(-1).x,1.12);
  for(const scale of A.scales(90,160,{...A.defaults,spread:200,edge:2}))assert(scale.x>0&&scale.y>0);
});
test('letterboxed and portrait video rectangles preserve aspect ratio',()=>{
  assert.deepEqual(plain(A.containRect({x:10,y:20,width:100,height:100},160,90)),{x:10,y:41.875,width:100,height:56.25});
  const r=A.containRect({x:0,y:0,width:200,height:100},90,160);
  assert.equal(r.height,100);assert.equal(r.width,56.25);
  assert.deepEqual(plain(A.cropRect({x:0,y:0,width:100,height:100},{x:.1,y:.2})),{x:10,y:20,width:80,height:60});
});
function frame(w,h,bars,{allDark=false,colored=false,uneven=false}={}) {
  const p=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const bar=y<bars||y>=h-(uneven?bars*2:bars);const i=(y*w+x)*4;
    p[i]=p[i+1]=p[i+2]=allDark?0:bar?(colored?65:0):90+(x%100);p[i+3]=255;
  }
  return p;
}
test('black bar detection avoids all-black scenes and uneven edges',()=>{
  assert.deepEqual(plain(A.detectBars(frame(128,72,8),128,72)),{x:0,y:7/72});
  assert.equal(A.detectBars(frame(128,72,8,{allDark:true}),128,72).y,0);
  assert.equal(A.detectBars(frame(128,72,8,{uneven:true}),128,72).y,0);
  assert.equal(A.detectBars(frame(128,72,8,{colored:true}),128,72).y,0);
  assert.equal(A.detectBars(frame(128,72,8,{colored:true}),128,72,{colored:true}).y,7/72);
});
test('manual cropping and automatic detection combine within safe limits',()=>{
  assert.deepEqual(plain(A.mergeCrop({...A.defaults,detectHorizontal:true,cropVertical:10},{x:.3,y:.2})),{x:.1,y:.2});
});
test('frame smoothing depends on elapsed time rather than refresh rate',()=>{
  const a=A.blendAlpha(16,250),b=A.blendAlpha(32,250);
  assert(Math.abs(1-(1-a)**2-b)<1e-12);assert.equal(A.blendAlpha(16,0),1);
});
test('flicker reduction bounds brightness changes and respects elapsed time',()=>{
  assert.equal(A.flickerAlpha(16,0,0,255),1);
  assert.equal(A.flickerAlpha(16,100,null,255),1);
  assert(A.flickerAlpha(16,100,0,255)<A.flickerAlpha(16,50,0,255));
  assert(Math.abs(A.flickerAlpha(32,80,0,100)-2*A.flickerAlpha(16,80,0,100))<1e-9);
});
