/* SPDX-License-Identifier: MIT
 * Bilibili state and style integration informed by iceorange-dev/bilibili-ambilight.
 * Copyright (c) 2026 iceorange-dev (Bilibili port)
 */
(() => {
  const A=globalThis.BiliAmbient;
  // Screen-and-rays glyph adapted from iceorange-dev's settings button (MIT).
  A.createLauncher=()=> {
    const button=document.createElement('button');button.id='bili-ambient-launcher';button.type='button';
    button.className='bpx-player-ctrl-btn';
    button.setAttribute('aria-label','Ambient light for Bilibili 设置');button.setAttribute('aria-haspopup','dialog');
    button.setAttribute('aria-controls','bili-ambient-settings');button.setAttribute('aria-expanded','false');
    const icon=document.createElement('span');icon.className='bpx-player-ctrl-btn-icon';
    const wrapper=document.createElement('span');wrapper.className='bpx-common-svg-icon';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value] of Object.entries({viewBox:'0 0 22 22',width:'22',height:'22','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);
    for(const [tag,attrs] of [
      ['rect',{x:'5.5',y:'7',width:'11',height:'8',rx:'1.5',fill:'none',stroke:'currentColor','stroke-width':'1.8'}],
      ['path',{d:'M11 1.5v2.5M11 18v2.5M1.5 11H3.5M18.5 11h2M3.8 3.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 3.8l-1.6 1.6M5.4 16.6l-1.6 1.6',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round',class:'bili-ambient-rays'}]
    ]) {
      const node=document.createElementNS(svg.namespaceURI,tag);
      for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
      svg.append(node);
    }
    wrapper.append(svg);icon.append(wrapper);
    const tooltip=document.createElement('span');tooltip.className='bili-ambient-tooltip';tooltip.textContent='氛围光设置';tooltip.setAttribute('aria-hidden','true');
    button.append(icon,tooltip);return button;
  };
  A.playerState=video=> {
    const player=video?.closest('.bpx-player-container,.bilibili-player,#bilibili-player,#live-player');
    const ancestors=[];
    for(let node=video;node&&node!==document.body;node=node.parentElement)ancestors.push(node);
    const mode=ancestors.map(n=>n.getAttribute('data-screen')).find(v=>['normal','wide','web','full','mini'].includes(v))||'normal';
    const full=!!document.fullscreenElement||mode==='web'||mode==='full'||ancestors.some(n=>n.matches('.mode-webscreen,.mode-fullscreen,.bpx-state-web,.bilibili-player-fullscreen,.bilibili-player-web-fullscreen,.web-fullscreen'));
    let mirrored=ancestors.some(n=>n.classList.contains('bpx-state-mirror'));
    // A site's transform remains intact: CSS scale is an independent property.
    if(!mirrored&&video) {
      let flips=0;
      for(const n of ancestors.slice(0,3)) {
        const transform=getComputedStyle(n).transform;
        if(transform!=='none') {try {if(new DOMMatrixReadOnly(transform).a<0)flips++;}catch {}}
      }
      mirrored=flips%2===1;
    }
    return {player,mode,full,mirrored};
  };
  A.captureVideoStyle=video=>Object.fromEntries(['scale','clip-path'].map(key=>[key,{
    value:video.style.getPropertyValue(key),priority:video.style.getPropertyPriority(key)
  }]));
  A.restoreProperty=(video,key,previous)=> {
    if(previous?.value)video.style.setProperty(key,previous.value,previous.priority);
    else video.style.removeProperty(key);
  };
  A.setVideoProperty=(video,key,value)=> {
    if(video.style.getPropertyValue(key)!==value||video.style.getPropertyPriority(key)!=='important')video.style.setProperty(key,value,'important');
  };
})();
