/* SPDX-License-Identifier: MIT */
(() => {
  const A=globalThis.BiliAmbient;
  const hostSelector='bili-comments,bili-comments-header-renderer';
  const css=`
    .bili-comments-bottom-fixed-wrapper > div {
      background-color:var(--bili-ambient-card,rgba(21,24,32,.55))!important;
      backdrop-filter:blur(18px) saturate(1.15);
      border-top:1px solid var(--line_regular,#ffffff1a)!important;
      border-radius:12px 12px 0 0;
      box-shadow:0 -6px 24px #0002;
    }
    .bili-comments-bottom-fixed-wrapper bili-comment-box {
      --bg1:rgba(var(--bili-ambient-card-rgb,21,24,32),.48);
      --bg3:rgba(var(--bili-ambient-card-rgb,21,24,32),.24);
      --Ga1:var(--line_regular,#ffffff26);
    }
  `;
  // Bilibili teleports the composer into its header Shadow DOM after scrolling.
  // Styling the wrapper locally keeps --bg1 on login masks and popovers intact.
  A.CommentsAdapter=class {
    constructor() {
      this.roots=new Map();this.enabled=false;
      this.onMutations=mutations=> {
        if(mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(n=>
          n.nodeType===1&&(n.matches(hostSelector)||n.querySelector(hostSelector)))))this.queueRefresh();
      };
      this.observer=new MutationObserver(this.onMutations);
    }
    update(enabled) {
      if(enabled!==this.enabled) {
        this.enabled=enabled;
        if(!enabled){this.clear();return;}
        this.observer.observe(document.body,{childList:true,subtree:true});this.refresh();
      } else if(enabled&&performance.now()-this.lastScan>1000)this.refresh();
    }
    queueRefresh() {
      if(!this.enabled||this.frame)return;
      this.frame=requestAnimationFrame(()=>{this.frame=null;this.refresh();});
    }
    register(host) {
      const root=host.shadowRoot;if(!root)return;
      let entry=this.roots.get(root);
      if(!entry) {
        const style=document.createElement('style');style.dataset.biliAmbientCommentDock='';style.textContent=css;
        const observer=new MutationObserver(this.onMutations);observer.observe(root,{childList:true,subtree:true});
        entry={host,style,observer};this.roots.set(root,entry);
      }
      if(entry.style.parentNode!==root)root.append(entry.style);
    }
    refresh() {
      if(!this.enabled)return;
      this.lastScan=performance.now();
      for(const [root,entry] of this.roots)if(!entry.host.isConnected) {
        entry.observer.disconnect();entry.style.remove();this.roots.delete(root);
      }
      for(const comments of document.querySelectorAll('bili-comments')) {
        this.register(comments);
        for(const header of comments.shadowRoot?.querySelectorAll('bili-comments-header-renderer')||[])this.register(header);
      }
    }
    clear() {
      this.observer.disconnect();
      if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;
      for(const {style,observer} of this.roots.values()){observer.disconnect();style.remove();}
      this.roots.clear();
    }
    destroy() {this.enabled=false;this.clear();}
  };
})();
