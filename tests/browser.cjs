/* Run with npm install && npx playwright install chromium && npm run test:browser.
 * BILI_PLAYWRIGHT_MODULE can point to an existing Playwright installation.
 * BILI_CHROMIUM_EXECUTABLE optionally selects the isolated test browser.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.BILI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const extension=process.env.BILI_EXTENSION_DIR||path.join(root,'extension');
const output=process.env.BILI_TEST_OUTPUT||path.join(root,'work/test-results');
fs.mkdirSync(output,{recursive:true});
const fixture=fs.readFileSync(path.join(__dirname,'fixture.html'),'utf8');
(async()=>{
  const context=await chromium.launchPersistentContext(path.join(output,'profile'),{
    headless:true,channel:process.env.BILI_CHROMIUM_EXECUTABLE?undefined:'chromium',executablePath:process.env.BILI_CHROMIUM_EXECUTABLE||undefined,
    viewport:{width:1280,height:900},ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]
  });
  const results=[],errors=[];
  context.setDefaultTimeout(8000);context.setDefaultNavigationTimeout(20000);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const workers=context.serviceWorkers();const worker=workers[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.clear());
  const extensionId=new URL(worker.url()).hostname;
  await context.route('https://www.bilibili.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
  async function settings(patch){await worker.evaluate(p=>chrome.storage.local.set(p),patch);}
  async function check(name,fn){await fn();results.push({name,status:'passed'});console.log(`PASS ${name}`);}
  async function frames(){return Number(await page.locator('#bili-ambient-root').getAttribute('data-frames'));}
  async function waitFrames(n){await page.waitForFunction(n=>Number(document.querySelector('#bili-ambient-root')?.dataset.frames)>n,n,{timeout:15000});}
  try {
    await page.goto('https://www.bilibili.com/video/BVfixture');
    await waitFrames(5);
    await check('MV3 extension loads and WebGL renders real video frames',async()=>{
      assert.equal(await page.locator('#bili-ambient-root').getAttribute('data-renderer'),'WebGL');
      assert(await page.locator('body').evaluate(e=>e.classList.contains('bili-ambient-dark')));
      assert.equal(await page.locator('#bili-ambient-launcher').count(),1);
      const r=await page.locator('.bili-ambient-canvas').boundingBox();assert(r.width>800&&r.height>450);
    });
    await settings({spread:45,blur:40,saturation:120,fadeDuration:150});
    await waitFrames(await frames()+10);
    await page.screenshot({path:path.join(output,'preview.png')});
    await check('color outside the player changes with video content',async()=>{
      const a=await page.screenshot();
      await page.evaluate(()=>{demo.hue=180;});await waitFrames(await frames()+15);
      const b=await page.screenshot();
      // Screenshot a region outside the player to prove that the effect is not just a border.
      const crop={x:150,y:130,width:450,height:30};
      const ca=await page.screenshot({clip:crop});await page.evaluate(()=>{demo.hue=0;});await waitFrames(await frames()+20);
      const cb=await page.screenshot({clip:crop});assert(!ca.equals(cb));assert(!a.equals(b));
    });
    await check('scrolling into comments keeps full-viewport light and live colors',async()=>{
      await page.evaluate(()=>{
        const comments=document.createElement('section');comments.id='test-comments';comments.style.cssText='height:3200px;padding:40px 0';
        comments.innerHTML='<h2>评论区</h2><p>下滚后仍然保留视频的动态色彩。</p>';document.getElementById('app').append(comments);window.scrollTo(0,1100);
      });
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.layout==='page-background');
      assert(await page.locator('video').evaluate(v=>v.getBoundingClientRect().bottom<0));
      assert(await page.locator('#bili-ambient-root').isVisible());
      const r=await page.locator('.bili-ambient-canvas').boundingBox();assert(r.width>=1280&&r.height>=900);
      const n=await frames();await waitFrames(n+3);
      const clip={x:100,y:300,width:400,height:200};const first=await page.screenshot({clip});
      await page.evaluate(()=>{demo.hue=180;});await waitFrames(await frames()+10);
      assert(!first.equals(await page.screenshot({clip})));
      await page.screenshot({path:path.join(output,'comments.png')});
      await page.evaluate(()=>{demo.hue=0;window.scrollTo(0,0);});
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.layout==='player');
    });
    await check('paused video retains cached light while scrolling and resizing',async()=>{
      await page.evaluate(()=>document.querySelector('video').pause());await page.waitForTimeout(100);
      await page.evaluate(()=>window.scrollTo(0,1600));
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.layout==='page-background');
      assert(await page.locator('#bili-ambient-root').isVisible());
      await page.screenshot({path:path.join(output,'comments-paused.png')});
      await page.setViewportSize({width:1100,height:800});
      await page.waitForFunction(()=>parseFloat(document.querySelector('.bili-ambient-canvas').style.width)>=1100);
      assert(await page.locator('#bili-ambient-root').isVisible());
      await page.evaluate(()=>window.scrollTo(0,0));await page.setViewportSize({width:1280,height:900});
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.layout==='player');
      await page.evaluate(()=>document.querySelector('video').play());await waitFrames(await frames()+2);
    });
    await check('Chinese settings panel updates storage and survives close',async()=>{
      await page.locator('#bili-ambient-launcher').click();
      await page.getByText('色彩',{exact:true}).click();
      await page.getByLabel('亮度',{exact:true}).evaluate(e=>{e.value='135';e.dispatchEvent(new Event('input',{bubbles:true}));});
      await page.waitForFunction(()=>document.querySelector('.bili-ambient-canvas').style.filter.includes('135%'));
      assert.equal(await worker.evaluate(async()=> (await chrome.storage.local.get('brightness')).brightness),135);
      await page.screenshot({path:path.join(output,'settings.png')});
      await page.getByRole('button',{name:'关闭设置'}).click();assert(await page.locator('#bili-ambient-settings').isHidden());
    });
    await check('native-size icon sits beside settings and its menu stays inside player',async()=>{
      const info=await page.locator('#bili-ambient-launcher').evaluate(e=>({next:e.nextElementSibling?.className,background:getComputedStyle(e).backgroundColor,icon:parseFloat(getComputedStyle(e.querySelector('svg')).width),text:Array.from(e.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('')}));
      assert(info.next.includes('bpx-player-ctrl-setting'));assert.equal(info.background,'rgba(0, 0, 0, 0)');assert.equal(info.icon,22);assert.equal(info.text,'');
      const scrollBefore=await page.evaluate(()=>scrollY);
      await page.locator('#bili-ambient-launcher').click();
      await page.waitForTimeout(180);
      assert.equal(await page.evaluate(()=>scrollY),scrollBefore);
      const menu=await page.locator('#bili-ambient-settings').boundingBox(),player=await page.locator('#player').boundingBox();
      assert(menu.x>=player.x&&menu.x+menu.width<=player.x+player.width+1);
      assert(menu.y>=player.y&&menu.y+menu.height<player.y+player.height-45);
      assert.equal(await page.locator('#bili-ambient-settings').evaluate(e=>e.parentElement.id),'player');
      assert(await page.locator('#player').evaluate(e=>e.classList.contains('bili-ambient-menu-open')));
      await page.screenshot({path:path.join(output,'native-settings.png')});
      await page.locator('.video-title').click();assert(await page.locator('#bili-ambient-settings').isHidden());
      assert.equal(await page.locator('#bili-ambient-launcher').getAttribute('aria-expanded'),'false');
      assert(!(await page.locator('#player').evaluate(e=>e.classList.contains('bili-ambient-menu-open'))));
    });
    await check('keyboard menu activation and Escape restore focus without toggling playback',async()=>{
      await page.locator('#bili-ambient-launcher').focus();await page.keyboard.press('Enter');
      assert(await page.locator('#bili-ambient-settings').isVisible());
      await page.keyboard.press('Escape');assert(await page.locator('#bili-ambient-settings').isHidden());
      assert(await page.locator('#bili-ambient-launcher').evaluate(e=>document.activeElement===e));
      await page.keyboard.press('Space');assert(await page.locator('#bili-ambient-settings').isVisible());
      await page.getByRole('button',{name:'关闭设置'}).click();assert.equal(await page.locator('video').evaluate(v=>v.paused),false);
    });
    await check('mini-player menu uses viewport space instead of covering the small video',async()=>{
      await page.evaluate(()=>document.getElementById('player').setAttribute('data-screen','mini'));
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-settings').parentElement===document.body);
      await page.locator('#bili-ambient-launcher').click();await page.waitForTimeout(180);
      const box=await page.locator('#bili-ambient-settings').boundingBox();assert(box.y>=0&&box.x>=0&&box.y+box.height<=900);
      await page.getByRole('button',{name:'关闭设置'}).click();
      await page.evaluate(()=>document.getElementById('player').setAttribute('data-screen','normal'));
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-settings').parentElement.id==='player');
    });
    await check('pause holds light without drawing continuously, seek refreshes',async()=>{
      await page.evaluate(()=>document.querySelector('video').pause());await page.waitForTimeout(200);
      const n=await frames();await page.waitForTimeout(1700);assert.equal(await frames(),n);
      await page.evaluate(()=>document.querySelector('video').dispatchEvent(new Event('seeked')));
      // A seek must redraw even if a paused video is already attached.
      await waitFrames(n);await settings({brightness:100});
      await page.evaluate(()=>document.querySelector('video').play());await waitFrames(n+2);
    });
    await check('disabling restores page colors and original video scale',async()=>{
      await settings({enabled:false});await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').hidden);
      assert(!(await page.locator('body').evaluate(e=>e.classList.contains('bili-ambient-dark'))));
      assert.equal(await page.locator('video').evaluate(v=>v.style.scale),'');
      await settings({enabled:true});await waitFrames(await frames()+2);
    });
    await check('Canvas 2D fallback also renders, then switch back to WebGL',async()=>{
      await settings({renderer:'2d'});await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.renderer==='Canvas 2D');
      await waitFrames(await frames()+3);
      await page.screenshot({path:path.join(output,'canvas-2d.png')});
      await settings({renderer:'webgl'});await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.renderer==='WebGL');
    });
    await check('frame limit caps ambient redraws independently of the video',async()=>{
      await settings({fps:5});await page.waitForTimeout(200);const n=await frames();await page.waitForTimeout(2000);
      const count=await frames()-n;assert(count>=3&&count<=12,`Unexpected redraws: ${count}`);await settings({fps:60});
    });
    await check('flicker reduction smooths a black-to-white flash',async()=>{
      await settings({renderer:'2d',flickerReduction:100,fadeDuration:0});
      await page.evaluate(()=>{demo.flat='#000';});await waitFrames(await frames()+15);
      const n=await frames();await page.evaluate(()=>{demo.flat='#fff';});await waitFrames(n+2);
      const level=await page.evaluate(()=>{const c=document.querySelector('.bili-ambient-canvas');return c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data[0];});
      assert(level<100,`Flash was not smoothed: ${level}`);
      await settings({flickerReduction:0});await waitFrames(await frames()+2);
      const white=await page.evaluate(()=>{const c=document.querySelector('.bili-ambient-canvas');return c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data[0];});
      assert(white>240);await page.evaluate(()=>{demo.flat=null;});await settings({renderer:'webgl'});
    });
    await check('web fullscreen and native fullscreen retain light and controls',async()=>{
      await page.locator('#web').click();await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').parentElement.classList.contains('bpx-player-video-area'));
      assert.equal(await page.locator('video').evaluate(v=>v.style.scale),'0.88');await waitFrames(await frames()+2);
      await page.screenshot({path:path.join(output,'web-fullscreen.png')});
      await page.locator('#bili-ambient-launcher').click();assert(await page.locator('#bili-ambient-settings').isVisible());
      assert.equal(await page.locator('#bili-ambient-launcher svg').evaluate(e=>parseFloat(getComputedStyle(e).width)),28);
      await page.keyboard.press('Escape');
      await page.locator('#web').click();await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').parentElement===document.body);
      await page.locator('#full').click();await page.waitForFunction(()=>!!document.fullscreenElement);await waitFrames(await frames()+2);
      assert(await page.locator('#bili-ambient-launcher').isVisible());await page.screenshot({path:path.join(output,'fullscreen.png')});
      await page.locator('#bili-ambient-launcher').click();assert(await page.locator('#bili-ambient-settings').isVisible());
      assert(await page.locator('#bili-ambient-settings').evaluate(e=>document.fullscreenElement.contains(e)));
      await page.getByRole('button',{name:'关闭设置'}).click();
      await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.fullscreenElement);
    });
    await check('current Bilibili mode-webscreen layout is detected',async()=>{
      await page.evaluate(()=>document.getElementById('player').classList.add('mode-webscreen','bpx-state-web'));
      await page.evaluate(()=>document.getElementById('player').classList.remove('bpx-state-web'));
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').parentElement.classList.contains('bpx-player-video-area'));
      assert.equal(await page.locator('video').evaluate(v=>v.style.scale),'0.88');
      await page.evaluate(()=>document.getElementById('player').classList.remove('mode-webscreen'));
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').parentElement===document.body);
    });
    await check('automatic black bars require multiple stable frames',async()=>{
      await settings({detectHorizontal:true,fadeDuration:0});await page.evaluate(()=>{demo.bars=true;});
      await page.waitForFunction(()=>JSON.parse(document.querySelector('#bili-ambient-root').dataset.crop).y>.07,null,{timeout:10000});
      assert(JSON.parse(await page.locator('#bili-ambient-root').getAttribute('data-crop')).y<.15);
      await page.evaluate(()=>{demo.bars=false;});await settings({detectHorizontal:false});
    });
    await check('stable playback reuses geometry rather than measuring every frame',async()=>{
      await waitFrames(await frames()+5);
      const start=await page.locator('#bili-ambient-root').evaluate(e=>({frames:Number(e.dataset.frames),layouts:Number(e.dataset.layoutPasses)}));
      await waitFrames(start.frames+20);
      const end=await page.locator('#bili-ambient-root').evaluate(e=>({frames:Number(e.dataset.frames),layouts:Number(e.dataset.layoutPasses)}));
      assert(end.layouts-start.layouts<5,`Unexpected geometry passes: ${end.layouts-start.layouts}`);
    });
    await check('asynchronous content shifts reposition the cached light',async()=>{
      const top=await page.locator('.bili-ambient-canvas').evaluate(c=>parseFloat(c.style.top));
      await page.evaluate(()=>{const spacer=document.createElement('div');spacer.id='layout-spacer';spacer.style.height='37px';document.querySelector('.mini-header').after(spacer);});
      await page.waitForFunction(top=>Math.abs(parseFloat(document.querySelector('.bili-ambient-canvas').style.top)-top-37)<1,top);
      await page.evaluate(()=>document.getElementById('layout-spacer').remove());
      await page.waitForFunction(top=>Math.abs(parseFloat(document.querySelector('.bili-ambient-canvas').style.top)-top)<1,top);
    });
    await check('portrait frames keep the selected sampling resource limit',async()=>{
      await page.evaluate(()=>{source.width=180;source.height=640;});
      await page.waitForFunction(()=>document.querySelector('video').videoHeight===640&&document.querySelector('#bili-ambient-root').dataset.sampleSize==='72×256');
      assert(await page.locator('#bili-ambient-root').isVisible());await waitFrames(await frames()+3);
      await page.evaluate(()=>{source.width=640;source.height=360;});
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.sampleSize==='256×144');
    });
    await check('data-screen web, wide and mini states switch immediately',async()=>{
      await page.evaluate(()=>document.getElementById('player').setAttribute('data-screen','web'));
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').classList.contains('bili-ambient-in-fullscreen'));
      assert.equal(await page.locator('video').evaluate(v=>v.style.scale),'0.88');
      await settings({hideHeaderWide:true});
      await page.evaluate(()=>document.getElementById('player').setAttribute('data-screen','wide'));
      await page.waitForFunction(()=>document.body.classList.contains('bili-ambient-hide-header'));
      await page.mouse.move(1200,850);
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.mini-header')).opacity==='0');
      await page.evaluate(()=>document.getElementById('player').setAttribute('data-screen','mini'));
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.layout==='page-background');
      assert(await page.locator('#bili-ambient-root').isVisible());
      await page.evaluate(()=>document.getElementById('player').setAttribute('data-screen','normal'));
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.layout==='player');
      await settings({hideHeaderWide:false});
    });
    await check('mirrored pixels follow the player without replacing its transform',async()=>{
      await settings({renderer:'2d',fadeDuration:0,blur:0});await page.evaluate(()=>{demo.split=true;});await waitFrames(await frames()+5);
      const pixel=()=>page.locator('.bili-ambient-canvas').evaluate(c=>Array.from(c.getContext('2d').getImageData(Math.floor(c.width*.4),Math.floor(c.height*.5),1,1).data));
      const before=await pixel();assert(before[0]>before[2]);
      await page.evaluate(()=>{document.getElementById('player').classList.add('bpx-state-mirror');document.querySelector('video').style.transform='scaleX(-1)';});
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.mirrored==='true');await waitFrames(await frames()+3);
      const after=await pixel();assert(after[2]>after[0],`Mirror pixel: ${after}`);
      assert.equal(await page.locator('video').evaluate(v=>v.style.transform),'scaleX(-1)');
      await page.evaluate(()=>document.getElementById('player').classList.remove('bpx-state-mirror'));
      await waitFrames(await frames()+3);assert.equal(await page.locator('#bili-ambient-root').getAttribute('data-mirrored'),'true');
      await page.evaluate(()=>{document.querySelector('video').style.removeProperty('transform');demo.split=false;});
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.mirrored==='false');await settings({renderer:'webgl',blur:40,fadeDuration:150});
    });
    await check('filling cropped video clips black edges and restores prior styles',async()=>{
      await settings({enabled:false});await page.waitForFunction(()=>!document.body.classList.contains('bili-ambient-page'));
      await page.evaluate(()=>{const v=document.querySelector('video');v.style.setProperty('scale','1.1','important');v.style.setProperty('clip-path','inset(2px)','important');v.style.transform='translateX(0px)';});
      await settings({enabled:true,fillVideo:true,cropHorizontal:10,videoScale:90});
      await page.waitForFunction(()=>document.querySelector('video').style.clipPath!=='inset(2px)');
      assert(Math.abs(parseFloat(await page.locator('video').evaluate(v=>v.style.scale))-1.2375)<.001);
      assert.equal(await page.locator('video').evaluate(v=>v.style.transform),'translateX(0px)');
      await settings({enabled:false});await page.waitForFunction(()=>!document.body.classList.contains('bili-ambient-page'));
      assert.deepEqual(await page.locator('video').evaluate(v=>({scale:v.style.scale,clip:v.style.clipPath,priority:v.style.getPropertyPriority('clip-path')})),{scale:'1.1',clip:'inset(2px)',priority:'important'});
      await page.evaluate(()=>{const v=document.querySelector('video');v.style.removeProperty('scale');v.style.removeProperty('clip-path');v.style.removeProperty('transform');});
      await settings({enabled:true,fillVideo:false,cropHorizontal:0,videoScale:100});await waitFrames(await frames()+3);
    });
    await check('missing video callbacks preserve light and recover on new frames',async()=>{
      await settings({energySaver:false,frameSync:'video'});await page.evaluate(()=>{demo.freeze=true;});await page.waitForTimeout(800);
      const n=await frames();await page.waitForTimeout(1600);const count=await frames()-n;
      assert(count>=2&&count<=5,`Watchdog redraws: ${count}`);assert(await page.locator('#bili-ambient-root').isVisible());
      await page.evaluate(()=>{demo.freeze=false;});await waitFrames(await frames()+8);
    });
    await check('page fusion respects focus, Shadow DOM masks and individual switches',async()=>{
      await page.evaluate(()=>{
        document.querySelector('header').insertAdjacentHTML('beforeend','<form id="nav-searchform" style="background:rgb(255,255,255)"><input aria-label="test search"></form>');
        const comments=document.createElement('bili-comments');comments.id='fusion-comments';comments.attachShadow({mode:'open'}).innerHTML='<style>.mask{background:var(--bg1)}textarea{background:var(--bili-comment-textarea-bg)}</style><div class="mask">登录遮罩</div><textarea></textarea>';document.getElementById('app').append(comments);
        const sidebar=document.createElement('div');sidebar.id='danmukuBox';sidebar.innerHTML='<div class="danmaku-wrap"><div class="bui-collapse-header">弹幕列表</div></div>';document.getElementById('app').append(sidebar);
      });
      assert.equal(await page.locator('.mini-header').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
      await page.locator('#nav-searchform').evaluate(e=>e.classList.add('is-focus'));
      assert.equal(await page.locator('#nav-searchform').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
      assert.equal(await page.locator('bili-comments .mask').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(21, 24, 32)');
      assert.equal(await page.locator('bili-comments textarea').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
      assert.equal(await page.locator('#danmukuBox .bui-collapse-header').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
      await settings({blendHeader:false,blendSidebar:false,blendDanmaku:false,blendComments:false,textShadow:false});
      await page.waitForFunction(()=>!document.body.classList.contains('bili-ambient-blendComments'));
      assert.equal(await page.locator('bili-comments').evaluate(e=>e.style.getPropertyValue('--bg1')),'');
      assert(!(await page.locator('body').evaluate(e=>e.classList.contains('bili-ambient-blendSidebar'))));
      await settings({blendHeader:true,blendSidebar:true,blendDanmaku:true,blendComments:true,textShadow:true});
      await page.evaluate(()=>{document.querySelector('#fusion-comments').remove();document.querySelector('#danmukuBox').remove();document.querySelector('#nav-searchform').remove();});
    });
    await check('nested comment dock blends while preserving typing, geometry and login masks',async()=>{
      await page.evaluate(()=>{
        window.makeDockHeader=()=>{
          const header=document.createElement('bili-comments-header-renderer');
          header.attachShadow({mode:'open'}).innerHTML=`<div class="bili-comments-bottom-fixed-wrapper" style="position:fixed;bottom:0;left:64px;width:800px;z-index:10"><div style="width:100%;padding:15px 0;position:relative;background-color:var(--bg1);border-top:.5px solid var(--graph_bg_thick)"><bili-comment-box></bili-comment-box></div></div>`;
          header.shadowRoot.querySelector('bili-comment-box').attachShadow({mode:'open'}).innerHTML='<style>#editor{margin:0 15px;padding:12px;background:var(--bg3);border:1px solid var(--Ga1);border-radius:8px}textarea{display:block;width:100%;box-sizing:border-box;height:46px;background:transparent;color:var(--text1);border:0;resize:none;font:16px sans-serif;outline:none}</style><div id="editor"><textarea aria-label="悬浮评论输入框" placeholder="发一条友善的评论"></textarea></div>';
          return header;
        };
        const comments=document.createElement('bili-comments');comments.id='dock-comments';
        comments.style.cssText='--bg1:rgb(21,24,32);--bg3:rgb(40,43,50)';
        comments.attachShadow({mode:'open'}).innerHTML='<style>.mask{background:var(--bg1)}</style><div class="mask" hidden>登录遮罩</div>';
        comments.shadowRoot.append(makeDockHeader());document.getElementById('app').append(comments);window.scrollTo(0,1700);
      });
      const dock=page.locator('#dock-comments .bili-comments-bottom-fixed-wrapper > div');
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#dock-comments').shadowRoot.querySelector('bili-comments-header-renderer').shadowRoot.querySelector('.bili-comments-bottom-fixed-wrapper > div')).backgroundColor==='rgba(21, 24, 32, 0.55)');
      const info=await dock.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,blur:getComputedStyle(e).backdropFilter,inline:e.style.backgroundColor}));
      assert.equal(info.inline,'var(--bg1)');assert(info.blur.includes('blur(18px)'));
      const box=await dock.boundingBox();assert.equal(box.x,64);assert.equal(box.width,800);assert.equal(box.y+box.height,900);
      assert.equal(await page.locator('#dock-comments .mask').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(21, 24, 32)');
      await page.getByLabel('悬浮评论输入框').fill('氛围光下的评论，输入内容保持不变');
      assert.equal(await page.getByLabel('悬浮评论输入框').inputValue(),'氛围光下的评论，输入内容保持不变');
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.layout==='page-background'&&!document.querySelector('#bili-ambient-root').hidden);
      await waitFrames(await frames()+3);
      await page.screenshot({path:path.join(output,'comment-dock-preview.png')});
      await settings({contentOpacity:35});
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#dock-comments').shadowRoot.querySelector('bili-comments-header-renderer').shadowRoot.querySelector('.bili-comments-bottom-fixed-wrapper > div')).backgroundColor==='rgba(21, 24, 32, 0.35)');
      await settings({darkPage:false});
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#dock-comments').shadowRoot.querySelector('bili-comments-header-renderer').shadowRoot.querySelector('.bili-comments-bottom-fixed-wrapper > div')).backgroundColor==='rgba(255, 255, 255, 0.35)');
      await settings({darkPage:true,contentOpacity:55});
    });
    await check('comment fusion restores native dock and handles remounts without duplicate styles',async()=>{
      await settings({blendComments:false});
      await page.waitForFunction(()=>document.querySelector('#dock-comments').shadowRoot.querySelectorAll('style[data-bili-ambient-comment-dock]').length===0);
      assert.equal(await page.locator('#dock-comments .bili-comments-bottom-fixed-wrapper > div').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(21, 24, 32)');
      assert.equal(await page.locator('#dock-comments bili-comments-header-renderer').evaluate(e=>e.shadowRoot.querySelectorAll('style[data-bili-ambient-comment-dock]').length),0);
      assert.equal(await page.getByLabel('悬浮评论输入框').inputValue(),'氛围光下的评论，输入内容保持不变');
      await settings({blendComments:true});
      await page.waitForFunction(()=>document.querySelector('#dock-comments').shadowRoot.querySelector('bili-comments-header-renderer').shadowRoot.querySelectorAll('style[data-bili-ambient-comment-dock]').length===1);
      await page.evaluate(()=>{const root=document.querySelector('#dock-comments').shadowRoot;window.oldHeader=root.querySelector('bili-comments-header-renderer');oldHeader.replaceWith(makeDockHeader());});
      await page.waitForFunction(()=>document.querySelector('#dock-comments').shadowRoot.querySelector('bili-comments-header-renderer').shadowRoot.querySelectorAll('style[data-bili-ambient-comment-dock]').length===1&&oldHeader.shadowRoot.querySelectorAll('style[data-bili-ambient-comment-dock]').length===0);
      await page.evaluate(()=>document.querySelector('#dock-comments').shadowRoot.querySelector('bili-comments-header-renderer').shadowRoot.querySelector('style[data-bili-ambient-comment-dock]').remove());
      await page.waitForFunction(()=>document.querySelector('#dock-comments').shadowRoot.querySelector('bili-comments-header-renderer').shadowRoot.querySelectorAll('style[data-bili-ambient-comment-dock]').length===1);
      await page.evaluate(()=>{const wrapper=document.querySelector('#dock-comments').shadowRoot.querySelector('bili-comments-header-renderer').shadowRoot.querySelector('.bili-comments-bottom-fixed-wrapper').cloneNode(true);wrapper.id='light-dock';wrapper.style.setProperty('--bg1','rgb(21,24,32)');document.body.append(wrapper);});
      assert.equal(await page.locator('#light-dock > div').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(21, 24, 32, 0.55)');
      await settings({enabled:false});
      await page.waitForFunction(()=>document.querySelector('#dock-comments').shadowRoot.querySelectorAll('style[data-bili-ambient-comment-dock]').length===0);
      assert.equal(await page.locator('#light-dock > div').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(21, 24, 32)');
      await settings({enabled:true});await waitFrames(await frames()+2);
      await page.evaluate(()=>{window.oldComments=document.querySelector('#dock-comments');oldComments.remove();document.querySelector('#light-dock').remove();window.scrollTo(0,0);});
      await page.waitForFunction(()=>oldComments.shadowRoot.querySelectorAll('style[data-bili-ambient-comment-dock]').length===0);
    });
    await check('player replacement binds new video and removes old effects',async()=>{
      const n=await frames();await page.evaluate(async()=>{
        const old=document.querySelector('video');window.oldVideo=old;const next=old.cloneNode();old.replaceWith(next);await startVideo(next);
      });await waitFrames(n+3);
      assert.equal(await page.evaluate(()=>oldVideo.style.scale),'');assert.equal(await page.locator('#bili-ambient-root').count(),1);
    });
    await check('SPA navigation to non-playback route disables effects',async()=>{
      await page.evaluate(()=>history.pushState({},'','/'));await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').hidden);
      assert.equal(await page.locator('#bili-ambient-launcher').count(),0);
      await page.evaluate(()=>history.pushState({},'','/video/BVfixture?p=2'));await waitFrames(await frames()+2);
    });
    await check('bwp-video shows an unsupported-player notice and cleanly recovers',async()=>{
      await page.evaluate(()=>{window.savedVideo=document.querySelector('video');savedVideo.pause();savedVideo.replaceWith(document.createElement('bwp-video'));});
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.status.includes('bwp-video'));
      assert(await page.locator('#bili-ambient-launcher').isVisible());assert(await page.locator('#bili-ambient-root').isHidden());
      await page.evaluate(async()=>{document.querySelector('bwp-video').replaceWith(savedVideo);await savedVideo.play();});await waitFrames(await frames()+3);
    });
    await check('popup renders external scripts under extension CSP',async()=>{
      const popup=await context.newPage();await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await popup.getByLabel('启用氛围光').waitFor();assert.equal(await popup.getByLabel('亮度',{exact:true}).inputValue(),'100');await popup.close();
    });
    await check('WebGL context loss switches to Canvas and keeps drawing',async()=>{
      const n=await frames();await page.evaluate(()=>document.querySelector('.bili-ambient-canvas').getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.renderer==='Canvas 2D');await waitFrames(n+3);
    });
    await check('cross-origin pixels fail safely and new clean video recovers',async()=>{
      const bytes=await page.evaluate(async()=>{
        const chunks=[],recorder=new MediaRecorder(document.querySelector('video').srcObject,{mimeType:'video/webm'});
        recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
        await new Promise(resolve=>setTimeout(resolve,350));recorder.stop();await done;
        return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
      });
      await context.route('https://media.test/**',route=>route.fulfill({contentType:'video/webm',body:Buffer.from(bytes)}));
      await page.evaluate(async()=>{const v=document.querySelector('video');v.srcObject=null;v.src='https://media.test/video.webm';v.loop=true;await v.play();});
      await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.status.includes('不允许读取像素'),null,{timeout:15000});
      assert(await page.locator('#bili-ambient-root').isHidden());
      assert.equal(await page.locator('video').evaluate(v=>v.paused),false);
      await page.evaluate(async()=>{const v=document.querySelector('video');v.removeAttribute('src');await startVideo(v);});await waitFrames(await frames()+3);
    });
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({browser:context.browser()?.version(),results,errors},null,2));
    console.log(`${results.length} browser checks passed; ${output}`);
  } catch(error) {
    await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
    fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({results,errors,failure:error.stack},null,2));
    throw error;
  } finally {await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
