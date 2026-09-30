/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  if(globalThis.__biliAmbientController) return;
  const A=globalThis.BiliAmbient;
  class Controller {
    constructor(settings) {
      this.settings=settings;
      this.commentsAdapter=new A.CommentsAdapter();
      this.root=document.createElement('div'); this.root.className='bili-ambient-root'; this.root.hidden=true;
      this.root.id='bili-ambient-root'; this.root.setAttribute('aria-hidden','true');
      this.launcher=A.createLauncher();
      this.launcher.addEventListener('click',event=>{event.stopPropagation();this.togglePanel();});
      this.launcher.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();});
      this.host=document.createElement('div'); this.host.id='bili-ambient-settings'; this.host.hidden=true;
      this.host.setAttribute('role','dialog'); this.host.setAttribute('aria-label','Ambient light for Bilibili™ 设置');
      this.ui=A.createSettingsUI(this.host,settings,A.writeSettings,()=>this.togglePanel(false));
      // Prevent player click/keyboard shortcuts while interacting with the menu.
      for(const type of ['click','pointerdown','keydown','wheel'])this.host.addEventListener(type,event=>event.stopPropagation());
      this.stats=document.createElement('div'); this.stats.id='bili-ambient-stats'; this.stats.hidden=true;
      document.body.append(this.root,this.host,this.stats);
      this.sample=document.createElement('canvas'); this.sampleCtx=this.sample.getContext('2d',{alpha:false,willReadFrequently:true});
      this.blended=document.createElement('canvas'); this.blendCtx=this.blended.getContext('2d',{alpha:false});
      this.probe=document.createElement('canvas'); this.probe.width=128; this.probe.height=72;
      this.probeCtx=this.probe.getContext('2d',{willReadFrequently:true});
      this.tone=document.createElement('canvas');this.tone.width=this.tone.height=8;
      this.toneCtx=this.tone.getContext('2d',{willReadFrequently:true});
      this.autoCrop={x:0,y:0}; this.frames=0; this.lastDraw=-Infinity; this.lastBar=-Infinity;
      this.globalEvents=new AbortController(); const signal=this.globalEvents.signal;
      window.addEventListener('resize',()=>this.requestLayout(),{signal});
      window.addEventListener('scroll',()=>this.requestLayout(),{signal,passive:true});
      document.addEventListener('fullscreenchange',()=>this.requestLayout(),{signal});
      document.addEventListener('visibilitychange',()=>{this.cancelFrame(); this.reconcile();},{signal});
      document.addEventListener('keydown',event=> {
        if(event.key==='Escape'&&!this.host.hidden) { this.togglePanel(false);event.preventDefault();event.stopPropagation(); }
      },{signal,capture:true});
      document.addEventListener('pointerdown',event=> {
        if(!this.host.hidden&&!event.composedPath().includes(this.host)&&!event.composedPath().includes(this.launcher))this.togglePanel(false);
      },{signal});
      window.addEventListener('pagehide',event=>{if(!event.persisted)this.destroy();else this.cancelFrame();},{signal});
      window.addEventListener('pageshow',()=>this.reconcile(),{signal});
      this.observer=new MutationObserver(mutations=> {
        if(mutations.some(m=>!m.target.closest?.('#bili-ambient-settings,#bili-ambient-root') &&
          [...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('video,bwp-video')||n.querySelector?.('video,bwp-video'))))) this.requestLayout();
      });
      this.observer.observe(document.body,{subtree:true,childList:true});
      // Handles SPA URLs, web-fullscreen classes, mini-player movement, and player control replacement.
      this.interval=setInterval(()=>this.reconcile(),1000);
      this.reconcile();
    }
    setStatus(message) {
      this.message=message; this.ui.status(message); this.root.dataset.status=message;
    }
    pickVideo() {
      this.pickedBox=null;
      if(!A.isPlaybackPage(location.href)) return null;
      let best=null, bestScore=0;
      for(const video of document.querySelectorAll('video')) {
        const r=video.getBoundingClientRect(), style=getComputedStyle(video);
        if(r.width<120||r.height<70||style.display==='none'||style.visibility==='hidden')continue;
        const known=video.closest('.bpx-player-container,.bilibili-player,.live-player-mounter,.web-player-module,#bilibili-player,#live-player');
        const score=r.width*r.height*(known?10:1)*(video.readyState>=2?2:1);
        if(score>bestScore){best=video;bestScore=score;this.pickedBox=r;}
      }
      return best;
    }
    bind(video) {
      this.cancelFrame(); this.videoEvents?.abort(); this.restoreVideo();
      this.playerObserver?.disconnect();this.resizeObserver?.disconnect();
      this.renderer?.destroy(); this.renderer=null;
      this.surface?.classList.remove('bili-ambient-surface'); this.surface=null;
      this.video=video;
      this.scrollAnchor=null;this.fixedRect=null;this.geometryDirty=true;this.state=null;this.lastBox=null;
      this.resetSource();
      if(!video) return;
      this.previousStyle=A.captureVideoStyle(video);this.baseScale=getComputedStyle(video).scale;
      this.playerObserver=new MutationObserver(()=> {
        const state=A.playerState(this.video);
        if(!this.state||state.mode!==this.state.mode||state.full!==this.state.full||state.mirrored!==this.state.mirrored)this.requestLayout();
      });
      for(let node=video;node&&node!==document.body;node=node.parentElement)
        this.playerObserver.observe(node,{attributes:true,attributeFilter:['class','data-screen','style']});
      this.videoEvents=new AbortController(); const signal=this.videoEvents.signal;
      for(const event of ['loadeddata','loadedmetadata','emptied']) video.addEventListener(event,()=>{this.resetSource(); this.reconcile();},{signal});
      for(const event of ['play','playing','pause','ended','seeked','resize','enterpictureinpicture','leavepictureinpicture'])
        video.addEventListener(event,()=>{this.cancelFrame();this.needsRedraw=true;this.geometryDirty=true;this.reconcile();},{signal});
      this.resizeObserver?.disconnect(); this.resizeObserver=new ResizeObserver(()=>this.requestLayout()); this.resizeObserver.observe(video);
    }
    resetSource() {
      this.source=this.video?.currentSrc||''; this.blocked=false; this.securityChecked=false;
      this.geometryDirty=true;
      this.autoCrop={x:0,y:0}; this.barCandidate=null; this.barCount=0;
      this.blendInitialized=false; this.lastDraw=-Infinity; this.lastBar=-Infinity;
      this.signature=null; this.staticFrames=0; this.displayLuma=null;
      // A tainted canvas remains tainted until its backing store is reset.
      this.sample.width=this.sample.width; this.blended.width=this.blended.width; this.probe.width=this.probe.width;this.tone.width=8;
      this.renderer?.clear();
    }
    restoreVideo() {
      if(this.video&&this.previousStyle)for(const key of ['scale','clip-path'])A.restoreProperty(this.video,key,this.previousStyle[key]);
      this.previousStyle=null;
    }
    reconcile() {
      if(this.destroyed)return;
      const video=this.pickVideo();
      if(video!==this.video)this.bind(video);
      // Catch layout shifts from asynchronously loaded site content without measuring on every video frame.
      if(this.pickedBox&&(!this.lastBox||['x','y','width','height'].some(key=>Math.abs(this.pickedBox[key]-this.lastBox[key])>.5)))this.geometryDirty=true;
      const playback=!!video;
      const state=playback?A.playerState(video):null;
      if(state&&(!this.state||state.mode!==this.state.mode||state.full!==this.state.full||state.mirrored!==this.state.mirrored)) {
        this.geometryDirty=true;
        if(state.mirrored!==this.state?.mirrored){this.blendInitialized=false;this.needsRedraw=true;}
      }
      this.state=state;
      const full=playback&&state.full; this.fullscreen=full;
      const unsupported=!playback&&A.isPlaybackPage(location.href)&&!!document.querySelector('bwp-video');
      const surface=video?.closest('.bpx-player-video-area,.bilibili-player-video-wrap,.live-player-mounter,.web-player-module')||video?.parentElement;
      const target=full?(surface||document.fullscreenElement):document.body;
      if(target&&this.root.parentElement!==target)target.prepend(this.root);
      this.root.classList.toggle('bili-ambient-in-fullscreen',!!full);
      const uiTarget=document.fullscreenElement||document.body;
      const player=state?.player||document.querySelector('bwp-video')?.closest('.bpx-player-container,.bilibili-player,#bilibili-player');
      const menuTarget=player&&state?.mode!=='mini'&&player.clientWidth>=280&&player.clientHeight>=260&&
        (!document.fullscreenElement||document.fullscreenElement.contains(player))?player:uiTarget;
      if(this.menuPlayer!==player){this.menuPlayer?.classList.remove('bili-ambient-menu-open');this.menuPlayer=player;}
      if(this.host.parentElement!==menuTarget) {
        this.menuAnchor?.classList.remove('bili-ambient-menu-anchor');this.menuAnchor=null;
        if(menuTarget!==document.body&&getComputedStyle(menuTarget).position==='static'){menuTarget.classList.add('bili-ambient-menu-anchor');this.menuAnchor=menuTarget;}
        menuTarget.append(this.host);
      }
      this.host.classList.toggle('bili-ambient-menu-floating',menuTarget===document.body);
      this.host.classList.toggle('bili-ambient-menu-fullscreen',!!full);
      this.menuPlayer?.classList.toggle('bili-ambient-menu-open',!this.host.hidden);
      if(this.stats.parentElement!==uiTarget)uiTarget.append(this.stats);
      if(playback||unsupported) {
        const controls=video?.closest('.bpx-player-container,.bilibili-player')?.querySelector('.bpx-player-control-bottom-right,.bilibili-player-video-btn');
        const buttonParent=controls||uiTarget;
        const nativeSettings=controls?.querySelector(':scope > .bpx-player-ctrl-setting');
        if(nativeSettings) {if(nativeSettings.previousElementSibling!==this.launcher)controls.insertBefore(this.launcher,nativeSettings);}
        else if(this.launcher.parentElement!==buttonParent)buttonParent.prepend(this.launcher);
        this.launcher.classList.toggle('bili-ambient-floating',!controls); this.launcher.hidden=false;
      } else {this.launcher.remove();this.togglePanel(false);}
      const allowed=this.settings.enabled&&playback&&(full?this.settings.fullscreenEnabled:this.settings.normalEnabled);
      this.launcher.dataset.enabled=String(!!allowed);this.launcher.classList.toggle('bili-ambient-large',!!full);
      const active=allowed&&!document.hidden&&!this.blocked&&!document.pictureInPictureElement;
      document.body.classList.toggle('bili-ambient-page',allowed);
      const dark=allowed&&this.settings.darkPage;
      for(const e of [document.body,document.documentElement])e.classList.toggle('bili-ambient-dark',dark);
      document.body.style.setProperty('--bili-ambient-content-opacity',String(this.settings.contentOpacity/100));
      for(const key of ['blendHeader','blendSidebar','blendDanmaku','blendComments','textShadow'])document.body.classList.toggle(`bili-ambient-${key}`,allowed&&this.settings[key]);
      this.commentsAdapter.update(!!allowed&&this.settings.blendComments);
      document.body.classList.toggle('bili-ambient-at-top',allowed&&scrollY<8);
      document.body.classList.toggle('bili-ambient-hide-header',allowed&&this.settings.hideHeaderWide&&state?.mode==='wide');
      this.root.dataset.mode=state?.mode||'none';this.root.dataset.mirrored=String(!!state?.mirrored);
      if(this.surface!==surface){this.surface?.classList.remove('bili-ambient-surface');this.surface=surface;}
      this.surface?.classList.toggle('bili-ambient-surface',allowed&&(full||this.settings.videoScale<100));
      this.stats.hidden=!this.settings.showStats||!allowed;
      this.root.hidden=!active;
      this.layoutMenu();
      if(!active) {
        this.cancelFrame();
        if(!allowed)this.restoreVideo();
        this.setStatus(unsupported?'当前为 bwp-video 播放器，暂不支持读取画面。可尝试在 B 站播放器中切换 AVC 编码；原视频不受影响。':!playback?'等待哔哩哔哩播放器…':!this.settings.enabled?'氛围光已关闭':this.blocked?this.message:document.hidden?'后台暂停，返回页面后恢复':document.pictureInPictureElement?'画中画中暂停': '当前布局已关闭氛围光');
        return;
      }
      if(!this.previousStyle){this.previousStyle=A.captureVideoStyle(video);this.baseScale=getComputedStyle(video).scale;}
      if(video.currentSrc!==this.source)this.resetSource();
      if(!this.renderer) {
        try {this.renderer=new A.Renderer(this.root,this.settings.renderer,message=>{this.fallback=message;this.requestLayout();});this.geometryDirty=true;}
        catch(error){this.blocked=true;this.root.hidden=true;this.setStatus(`无法创建渲染器：${error.message}`);return;}
      }
      if(this.geometryDirty)this.layout();
      if(video.readyState<2) {this.setStatus('等待视频画面…');return;}
      if(video.paused||video.ended) {
        if(this.lastDraw===-Infinity||this.needsRedraw){this.draw(performance.now());this.needsRedraw=false;}
        this.cancelFrame();
      } else this.scheduleFrame();
      this.updateStatus();
    }
    layout() {
      if(!this.video||!this.renderer)return;
      this.geometryDirty=false;this.root.dataset.layoutPasses=String((this.layoutPasses||0)+1);this.layoutPasses=(this.layoutPasses||0)+1;
      const s=this.settings, crop=A.mergeCrop(s,this.autoCrop);
      const fill=s.fillVideo?1/Math.max(.2,1-2*Math.max(crop.x,crop.y)):1;
      const scale=(this.fullscreen?s.fullscreenScale:s.videoScale)/100*fill;
      const base=this.baseScale==='none'?['1']:this.baseScale.split(/\s+/);
      A.setVideoProperty(this.video,'scale',base.map(v=>String(parseFloat(v)*scale)).join(' '));
      if(s.fillVideo&&(crop.x||crop.y)) {
        const local=A.containRect({x:0,y:0,width:this.video.clientWidth,height:this.video.clientHeight},this.video.videoWidth,this.video.videoHeight);
        const x=local.x+local.width*crop.x,y=local.y+local.height*crop.y;
        A.setVideoProperty(this.video,'clip-path',`inset(${y}px ${x}px)`);
      } else if(this.previousStyle)A.restoreProperty(this.video,'clip-path',this.previousStyle['clip-path']);
      const box=this.video.getBoundingClientRect();
      this.lastBox={x:box.x,y:box.y,width:box.width,height:box.height};
      let rect=A.cropRect(A.containRect(box,this.video.videoWidth,this.video.videoHeight),crop);
      if(!this.fullscreen&&this.scrollAnchor==null)this.scrollAnchor=box.y+scrollY;
      // The viewport background continues to use the original video, including when Bilibili moves it into a mini-player.
      const scrollBackground=s.scrollBackground&&!this.fullscreen&&
        (this.state?.mode==='mini'||scrollY>Math.max(0,this.scrollAnchor)+1 || rect.y<0 || (scrollY>innerHeight/2&&box.width<innerWidth*.35));
      if(scrollBackground) {
        rect={x:0,y:0,width:innerWidth,height:innerHeight};
      } else if(s.fixedPosition&&!this.fullscreen) {
        if(!this.fixedRect)this.fixedRect={...rect};
        rect={...rect,x:this.fixedRect.x,y:this.fixedRect.y};
      } else this.fixedRect=null;
      this.root.dataset.layout=scrollBackground?'page-background':'player';
      this.inView=rect.y+rect.height>0&&rect.y<innerHeight&&rect.x+rect.width>0&&rect.x<innerWidth;
      this.root.hidden=!this.inView||document.hidden||this.blocked;
      if(rect.width>0&&rect.height>0) {
        const resized=this.renderer.layout(rect,s);
        // Resizing clears a canvas. Repaint the cached frame immediately, even when an offscreen video stops delivering callbacks.
        if(resized&&this.blendInitialized)this.renderer.draw(this.blended);
      }
      this.root.dataset.renderer=this.renderer.type;
    }
    requestLayout() {
      this.geometryDirty=true;
      if(this.layoutFrame||this.destroyed)return;
      this.layoutFrame=requestAnimationFrame(()=> {
        this.layoutFrame=null;this.needsRedraw=true;this.reconcile();
      });
    }
    layoutMenu() {
      if(this.host.hidden)return;
      const target=this.host.parentElement;
      const height=target===document.body?innerHeight:Math.min(target.clientHeight,innerHeight);
      this.host.style.setProperty('--bili-ambient-menu-height',`${Math.max(120,height-(this.fullscreen?110:76))}px`);
    }
    scheduleFrame() {
      if(this.pending||!this.video||this.video.paused||document.hidden||this.blocked||this.root.hidden)return;
      const pending=this.pending={video:this.video};
      const callback=now=>{
        if(this.pending!==pending)return;
        clearTimeout(pending.watchdog);this.pending=null;this.frame(now);
      };
      if(this.settings.frameSync==='video'&&this.video.requestVideoFrameCallback) {
        pending.type='video';pending.id=this.video.requestVideoFrameCallback(callback);
        // Offscreen decoding and some Bilibili players stop delivering video callbacks.
        pending.watchdog=setTimeout(()=> {
          if(this.pending!==pending)return;
          pending.video.cancelVideoFrameCallback(pending.id);callback(performance.now());
        },500);
      } else {pending.type='raf';pending.id=requestAnimationFrame(callback);}
    }
    cancelFrame() {
      if(!this.pending)return;
      clearTimeout(this.pending.watchdog);
      if(this.pending.type==='video')this.pending.video.cancelVideoFrameCallback(this.pending.id);
      else cancelAnimationFrame(this.pending.id);
      this.pending=null;
    }
    frame(now) {
      if(this.destroyed||!this.video||document.hidden||this.blocked)return;
      const limit=this.settings.energySaver&&this.staticFrames>=3?1000:1000/this.settings.fps;
      if(now-this.lastDraw>=limit-1&&this.video.readyState>=2) {
        if(this.geometryDirty)this.layout();
        if(!this.root.hidden)this.draw(now);
      }
      this.scheduleFrame();
    }
    draw(now) {
      if(!this.video||!this.renderer||this.blocked||this.video.readyState<2)return;
      try {
        const v=this.video,s=this.settings;
        const ratio=s.resolution/Math.max(v.videoWidth,v.videoHeight);
        const sw=Math.max(1,Math.round(v.videoWidth*ratio)),sh=Math.max(1,Math.round(v.videoHeight*ratio));
        if(!Number.isFinite(sh)||!v.videoWidth)return;
        if(this.sample.width!==sw||this.sample.height!==sh){
          this.sample.width=this.blended.width=sw;this.sample.height=this.blended.height=sh;this.blendInitialized=false;this.securityChecked=false;
        }
        this.root.dataset.sampleSize=`${sw}×${sh}`;
        if((s.detectHorizontal||s.detectVertical||s.energySaver)&&now-this.lastBar>500) {
          this.probeCtx.drawImage(v,0,0,128,72);
          const data=this.probeCtx.getImageData(0,0,128,72).data;
          if(s.detectHorizontal||s.detectVertical) {
            const detected=A.detectBars(data,128,72,{horizontal:s.detectHorizontal,vertical:s.detectVertical,colored:s.detectColored});
            const candidate=JSON.stringify(detected);
            this.barCount=candidate===this.barCandidate?this.barCount+1:1;this.barCandidate=candidate;
            if(this.barCount>=4&&(detected.x!==this.autoCrop.x||detected.y!==this.autoCrop.y)) {
              this.autoCrop=detected;this.blendInitialized=false;this.layout();
            }
          }
          let diff=0,total=0;
          for(let i=0;i<data.length;i+=64) {
            const value=(data[i]+data[i+1]+data[i+2])/3;
            if(this.signature)diff+=Math.abs(value-this.signature[i/64]);
            total++;
          }
          this.staticFrames=this.signature&&diff/total<1?this.staticFrames+1:0;
          this.signature=Array.from({length:total},(_,i)=>(data[i*64]+data[i*64+1]+data[i*64+2])/3);
          this.lastBar=now;
        }
        const crop=A.mergeCrop(s,this.autoCrop);
        this.root.dataset.crop=JSON.stringify(crop);
        this.sampleCtx.save();
        if(this.state?.mirrored){this.sampleCtx.translate(sw,0);this.sampleCtx.scale(-1,1);}
        try {this.sampleCtx.drawImage(v,v.videoWidth*crop.x,v.videoHeight*crop.y,v.videoWidth*(1-2*crop.x),v.videoHeight*(1-2*crop.y),0,0,sw,sh);}
        finally {this.sampleCtx.restore();}
        if(!this.securityChecked){this.sampleCtx.getImageData(0,0,1,1);this.securityChecked=true;}
        const elapsed=Number.isFinite(this.lastDraw)?now-this.lastDraw:1000/s.fps;
        let alpha=this.blendInitialized?A.blendAlpha(elapsed,s.fadeDuration):1;
        if(s.flickerReduction) {
          this.toneCtx.drawImage(this.sample,0,0,8,8);
          const pixels=this.toneCtx.getImageData(0,0,8,8).data;let luma=0;
          for(let i=0;i<pixels.length;i+=4)luma+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;
          luma/=64;
          if(this.blendInitialized)alpha=Math.min(alpha,A.flickerAlpha(elapsed,s.flickerReduction,this.displayLuma,luma));
          this.displayLuma=this.displayLuma==null?luma:this.displayLuma+(luma-this.displayLuma)*alpha;
        }
        this.blendCtx.globalAlpha=alpha;this.blendCtx.drawImage(this.sample,0,0);this.blendCtx.globalAlpha=1;
        this.blendInitialized=true;
        this.renderer.draw(this.blended);
        this.frames++;this.lastDraw=now;this.root.dataset.frames=String(this.frames);
        this.updateStatus(now);
      } catch(error) {
        this.blocked=true;this.cancelFrame();this.renderer.clear();this.root.hidden=true;
        this.setStatus(error.name==='SecurityError'?'视频不允许读取像素（跨域或受保护内容）；氛围光已暂停，原视频可正常播放。':`取帧失败：${error.message}`);
      }
    }
    updateStatus(now=performance.now()) {
      if(this.blocked)return;
      if(now-(this.lastStats||0)<1000)return;
      const elapsed=(now-(this.lastStats||now-1000))/1000;
      const fps=Math.round((this.frames-(this.statsFrames||0))/elapsed);
      this.statsFrames=this.frames;this.lastStats=now;
      const message=`${this.video?.paused?'已暂停 · ':''}${this.renderer?.type||''} · ${fps} fps · ${this.settings.resolution}px${this.fallback?' · 兼容模式':''}`;
      this.setStatus(message);this.stats.textContent=message;
    }
    apply(settings) {
      const previous=this.settings;this.settings=settings;this.ui.update(settings);
      this.geometryDirty=true;
      this.cancelFrame();this.needsRedraw=true;
      if(previous.renderer!==settings.renderer){this.renderer?.destroy();this.renderer=null;this.fallback=null;this.blocked=false;}
      if(previous.fixedPosition!==settings.fixedPosition)this.fixedRect=null;
      if(previous.detectHorizontal!==settings.detectHorizontal||previous.detectVertical!==settings.detectVertical||previous.detectColored!==settings.detectColored){this.autoCrop={x:0,y:0};this.barCandidate=null;this.barCount=0;this.lastBar=-Infinity;}
      this.blendInitialized=false;
      this.displayLuma=null;
      this.reconcile();
    }
    togglePanel(open=this.host.hidden) {
      const returnFocus=document.activeElement===this.host;
      this.host.hidden=!open;this.launcher.setAttribute('aria-expanded',String(open));
      this.menuPlayer?.classList.toggle('bili-ambient-menu-open',open);
      if(open){this.layoutMenu();this.ui.focus();}else if(returnFocus)this.launcher.focus({preventScroll:true});
    }
    destroy() {
      this.destroyed=true;this.cancelFrame();clearInterval(this.interval);
      this.commentsAdapter.destroy();
      if(this.layoutFrame)cancelAnimationFrame(this.layoutFrame);
      this.globalEvents.abort();this.videoEvents?.abort();this.observer.disconnect();this.resizeObserver?.disconnect();this.playerObserver?.disconnect();
      this.restoreVideo();this.surface?.classList.remove('bili-ambient-surface');this.renderer?.destroy();
      this.menuPlayer?.classList.remove('bili-ambient-menu-open');this.menuAnchor?.classList.remove('bili-ambient-menu-anchor');
      for(const e of [this.root,this.host,this.launcher,this.stats])e.remove();
      for(const e of [document.body,document.documentElement])e.classList.remove('bili-ambient-page','bili-ambient-dark');
      for(const key of ['blendHeader','blendSidebar','blendDanmaku','blendComments','textShadow','at-top','hide-header'])document.body.classList.remove(`bili-ambient-${key}`);
      document.body.style.removeProperty('--bili-ambient-content-opacity');
    }
  }
  (async()=> {
    try {
      const controller=globalThis.__biliAmbientController=new Controller(await A.readSettings());
      chrome.storage.onChanged.addListener(async(_changes,area)=> {
        if(area!=='local'||controller.destroyed)return;
        try{controller.apply(await A.readSettings());}catch{controller.setStatus('扩展已更新，请刷新页面。');}
      });
      chrome.runtime.onMessage.addListener((message,_sender,respond)=> {
        if(message?.type!=='bili-ambient-status')return;
        respond({message:controller.message,frames:controller.frames,renderer:controller.renderer?.type||null});
      });
    } catch(error) { console.warn('[Ambient light for Bilibili™] 初始化失败',error.message); }
  })();
})();
