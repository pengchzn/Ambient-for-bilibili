const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.BILI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const output=process.env.BILI_TEST_OUTPUT||path.join(root,'work/live-results');fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launchPersistentContext(path.join(output,'profile'),{
    headless:true,channel:process.env.BILI_CHROMIUM_EXECUTABLE?undefined:'chromium',executablePath:process.env.BILI_CHROMIUM_EXECUTABLE||undefined,
    viewport:{width:Number(process.env.BILI_SCREENSHOT_WIDTH)||1440,height:Number(process.env.BILI_SCREENSHOT_HEIGHT)||1000},ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${path.join(root,'extension')}`,`--load-extension=${path.join(root,'extension')}`]
  });
  browser.setDefaultTimeout(10000);browser.setDefaultNavigationTimeout(30000);
  const page=await browser.newPage(),errors=[],errorDetails=[];page.on('pageerror',e=>{errors.push(e.message);errorDetails.push({message:e.message,stack:e.stack});});
  const result={url:process.argv[2]||'https://www.bilibili.com/video/BV1euaq6CEKR/',status:'pending'};
  result.controlAlignment=[];
  async function checkControlAlignment(mode,expanded=false) {
    if(!expanded) {
      const box=await page.locator('.bpx-player-control-bottom-right').boundingBox();
      await page.mouse.move(Math.max(0,box.x-30),box.y+8);
      await page.locator('#bili-ambient-launcher').evaluate(e=>e.blur());
    }
    const metrics=await page.evaluate(()=> {
      const ambient=document.querySelector('#bili-ambient-launcher .bpx-common-svg-icon'),gear=document.querySelector('.bpx-player-ctrl-setting .bpx-player-ctrl-btn-icon .bpx-common-svg-icon');
      const a=ambient.querySelector('svg').getBoundingClientRect(),g=gear.querySelector('svg').getBoundingClientRect();
      return {centerDifference:a.y+a.height/2-g.y-g.height/2,ambientHeight:a.height,nativeHeight:g.height,
        ambientColor:getComputedStyle(ambient.querySelector('rect')).stroke,nativeColor:getComputedStyle(gear.querySelector('svg')).fill,
        ambientOpacity:Number(getComputedStyle(ambient).opacity),nativeOpacity:Number(getComputedStyle(gear).opacity)};
    });
    if(Math.abs(metrics.centerDifference)>.5||Math.abs(metrics.ambientHeight-metrics.nativeHeight)>.5||metrics.ambientColor!==metrics.nativeColor||
      (!expanded&&metrics.ambientOpacity!==metrics.nativeOpacity))throw new Error(`图标未对齐：${JSON.stringify(metrics)}`);
    result.controlAlignment.push({mode,expanded,...metrics});
  }
  try {
    await page.goto(result.url,{waitUntil:'domcontentloaded'});
    result.title=await page.title();
    await page.locator('video').waitFor({timeout:25000});
    await page.evaluate(async()=>{const v=document.querySelector('video');v.muted=true;await v.play();});
    await page.waitForFunction(()=>Number(document.querySelector('#bili-ambient-root')?.dataset.frames)>10,null,{timeout:20000});
    result.player=await page.evaluate(()=>{
      const video=document.querySelector('video'),r=video.getBoundingClientRect(),root=document.querySelector('#bili-ambient-root');
      return {videoWidth:video.videoWidth,videoHeight:video.videoHeight,crossOrigin:video.crossOrigin,readyState:video.readyState,paused:video.paused,
        rect:{x:r.x,y:r.y,width:r.width,height:r.height},frames:Number(root.dataset.frames),renderer:root.dataset.renderer,status:root.dataset.status,dark:document.body.classList.contains('bili-ambient-dark')};
    });
    await page.screenshot({path:path.join(output,'bilibili-live.png')});
    await page.waitForFunction(()=>document.querySelector('#bili-ambient-launcher')?.nextElementSibling?.classList.contains('bpx-player-ctrl-setting'));
    await checkControlAlignment('normal');
    await page.locator('#bili-ambient-launcher').click();
    await page.waitForTimeout(180);
    await checkControlAlignment('normal',true);
    result.normalMenu=await page.locator('#bili-ambient-settings').evaluate(e=>{
      const button=document.querySelector('#bili-ambient-launcher');
      return {scrollY,rect:e.getBoundingClientRect().toJSON(),parent:e.parentElement.getBoundingClientRect().toJSON(),heightLimit:e.style.getPropertyValue('--bili-ambient-menu-height'),buttonRect:button.getBoundingClientRect().toJSON(),buttonClasses:button.className,buttonParent:button.parentElement.className};
    });
    await page.screenshot({path:path.join(output,'bilibili-settings.png')});
    await page.getByRole('button',{name:'关闭设置',exact:true}).click();
    await page.locator('.bpx-player-ctrl-web').click();
    await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').parentElement.classList.contains('bpx-player-video-area'));
    const beforeFullFrames=await page.locator('#bili-ambient-root').evaluate(e=>Number(e.dataset.frames));
    await page.waitForFunction(n=>Number(document.querySelector('#bili-ambient-root').dataset.frames)>n+5,beforeFullFrames);
    await checkControlAlignment('web');
    await page.screenshot({path:path.join(output,'bilibili-web-fullscreen.png')});
    const controls=await page.locator('.bpx-player-control-bottom-right').boundingBox();
    await page.screenshot({path:path.join(output,'bilibili-controls.png'),clip:{x:Math.max(0,controls.x-10),y:Math.max(0,controls.y-8),width:Math.min(page.viewportSize().width-controls.x+10,controls.width+20),height:Math.min(page.viewportSize().height-controls.y+8,controls.height+16)}});
    await page.locator('#bili-ambient-launcher').click();await page.waitForTimeout(180);
    await checkControlAlignment('web',true);
    result.settingsUI=await page.evaluate(()=> {
      const button=document.querySelector('#bili-ambient-launcher'),menu=document.querySelector('#bili-ambient-settings');
      const box=menu.getBoundingClientRect(),player=menu.parentElement.getBoundingClientRect();
      return {iconWidth:parseFloat(getComputedStyle(button.querySelector('svg')).width),background:getComputedStyle(button).backgroundColor,
        nextControl:button.nextElementSibling?.className,menuRect:box.toJSON(),insidePlayer:box.x>=player.x&&box.y>=player.y&&box.right<=player.right&&box.bottom<=player.bottom};
    });
    if(!result.settingsUI.insidePlayer||!result.settingsUI.nextControl?.includes('bpx-player-ctrl-setting'))throw new Error('设置入口或面板位置不符合预期');
    await page.screenshot({path:path.join(output,'bilibili-native-settings.png')});
    await page.getByRole('button',{name:'关闭设置',exact:true}).click();
    result.webFullscreen=await page.evaluate(()=>({frames:Number(document.querySelector('#bili-ambient-root').dataset.frames),scale:document.querySelector('video').style.scale,
      lightRect:document.querySelector('.bili-ambient-canvas').getBoundingClientRect().toJSON(),
      rootRect:document.querySelector('#bili-ambient-root').getBoundingClientRect().toJSON(),
      ancestors:Array.from((function*(e){for(let i=0;e&&i<7;i++,e=e.parentElement)yield e})(document.querySelector('video'))).map(e=>({classes:e.className,background:getComputedStyle(e).backgroundColor,backgroundImage:getComputedStyle(e).backgroundImage,z:getComputedStyle(e).zIndex,transform:getComputedStyle(e).transform}))}));
    await page.locator('.bpx-player-ctrl-web').click();
    await page.evaluate(()=>window.scrollTo(0,1800));
    await page.waitForFunction(()=>document.querySelector('#bili-ambient-root').dataset.layout==='page-background'&&!document.querySelector('#bili-ambient-root').hidden);
    await page.screenshot({path:path.join(output,'bilibili-comments.png')});
    result.comments=await page.evaluate(()=>({scrollY,layout:document.querySelector('#bili-ambient-root').dataset.layout,
      lightVisible:!document.querySelector('#bili-ambient-root').hidden,lightRect:document.querySelector('.bili-ambient-canvas').getBoundingClientRect().toJSON()}));
    await page.waitForFunction(()=>document.querySelector('bili-comments')?.shadowRoot?.querySelector('bili-comments-header-renderer')?.shadowRoot?.querySelector('style[data-bili-ambient-comment-dock]'));
    result.commentDock=await page.evaluate(()=>{
      const comments=document.querySelector('bili-comments'),header=comments.shadowRoot.querySelector('bili-comments-header-renderer');
      const mask=comments.shadowRoot.querySelector('#limit-mask-wall'),pseudo=mask?getComputedStyle(mask,'::before'):null;
      return {componentStyleCount:comments.shadowRoot.querySelectorAll('style[data-bili-ambient-comment-dock]').length,
        headerStyleCount:header.shadowRoot.querySelectorAll('style[data-bili-ambient-comment-dock]').length,
        nativeOpaqueBackground:getComputedStyle(comments).getPropertyValue('--bg1').trim(),
        loginMaskBackground:pseudo?.backgroundImage,
        dockPresent:!!header.shadowRoot.querySelector('.bili-comments-bottom-fixed-wrapper'),
        accountState:'isolated logged-out browser; logged-in dock covered by fixture tests'};
    });
    if(result.commentDock.componentStyleCount!==1||result.commentDock.headerStyleCount!==1)throw new Error('评论 Shadow DOM 样式适配未成功');
    result.status='passed';
  } catch(error) {
    result.status='unverified';result.reason=error.message;
    result.pageText=(await page.locator('body').innerText().catch(()=>'' )).slice(0,800);
    result.layout=await page.evaluate(()=>({bodyClass:document.body.className,fullscreen:document.fullscreenElement?.className,
      ancestors:Array.from((function*(e){for(let i=0;e&&i<14;i++,e=e.parentElement)yield e})(document.querySelector('video'))).map(e=>({tag:e.tagName,id:e.id,classes:e.className})),
      rootParent:document.querySelector('#bili-ambient-root')?.parentElement.className,scale:document.querySelector('video')?.style.scale})).catch(()=>null);
    await page.screenshot({path:path.join(output,'bilibili-unverified.png')}).catch(()=>{});
  } finally {
    result.errors=errors;result.errorDetails=errorDetails;fs.writeFileSync(path.join(output,'live-results.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));await browser.close();
  }
})();
