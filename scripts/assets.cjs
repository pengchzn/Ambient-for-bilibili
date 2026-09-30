// Render the repository's vector artwork using an isolated browser; no remote assets.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.BILI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'store/assets');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BILI_CHROMIUM_EXECUTABLE||undefined});
 try {
  const page=await browser.newPage({viewport:{width:1400,height:560},deviceScaleFactor:1});
  const svg=fs.readFileSync(path.join(root,'extension/icons/icon.svg'),'utf8');
  for(const size of [16,32,48,128]) {
   await page.setViewportSize({width:size,height:size});
   await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
   await page.screenshot({path:path.join(root,`extension/icons/${size}.png`),omitBackground:true});
  }
  const promo=(width,height)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${width/height>2?'0 0 1400 560':'260 0 880 560'}">
   <defs><radialGradient id="bg"><stop stop-color="#263954"/><stop offset="1" stop-color="#0d1524"/></radialGradient><linearGradient id="halo"><stop stop-color="#23d0ed"/><stop offset=".52" stop-color="#466af5"/><stop offset="1" stop-color="#f082c6"/></linearGradient><linearGradient id="sky" x2="1" y2="1"><stop stop-color="#34bbd9"/><stop offset=".5" stop-color="#3768ce"/><stop offset="1" stop-color="#d184c3"/></linearGradient><linearGradient id="sea" x2="1" y2="1"><stop stop-color="#22bad1"/><stop offset="1" stop-color="#de9b68"/></linearGradient><filter id="blur" x="-.5" y="-.5" width="2" height="2"><feGaussianBlur stdDeviation="55"/></filter></defs>
   <rect width="1400" height="560" fill="url(#bg)"/><ellipse cx="470" cy="300" rx="290" ry="180" fill="#14bcd8" opacity=".7" filter="url(#blur)"/><ellipse cx="960" cy="270" rx="260" ry="165" fill="#c064c8" opacity=".6" filter="url(#blur)"/>
   <rect x="382" y="107" width="636" height="346" rx="27" fill="url(#halo)" opacity=".8" filter="url(#blur)"/>
   <rect x="424" y="131" width="552" height="306" rx="16" fill="#101827" stroke="url(#halo)" stroke-width="3"/>
   <svg x="435" y="142" width="530" height="270" viewBox="0 0 530 270"><rect width="530" height="270" fill="url(#sky)"/><circle cx="414" cy="65" r="24" fill="#ffdeb4"/><path d="M0 170L88 83L178 171L262 117L347 180L452 136L530 167V270H0Z" fill="#263d64"/><rect y="185" width="530" height="85" fill="url(#sea)"/><path d="M0 204Q115 190 248 211T530 200M0 226Q150 217 310 232T530 219M0 251Q130 238 277 253T530 247" stroke="#e2f7ff" opacity=".32" fill="none" stroke-width="2"/></svg>
   <path d="M450 425H903" stroke="#8fadd0" stroke-width="3" stroke-linecap="round" opacity=".5"/><path d="M450 425H650" stroke="#55d0fa" stroke-width="3" stroke-linecap="round"/><circle cx="941" cy="425" r="4" fill="#ebf6ff"/>
   </svg>`;
  for(const [name,width,height] of [['promo-440x280',440,280]]) {
   const art=promo(width,height);
   await page.setViewportSize({width,height});await page.setContent(`<style>html,body{margin:0;background:#0d1524}svg{display:block}</style>${art}`);
   await page.screenshot({path:path.join(output,name+'.png')});
  }
  console.log('Rendered icons and store promotional artwork.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
