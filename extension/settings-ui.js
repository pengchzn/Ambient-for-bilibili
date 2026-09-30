/* SPDX-License-Identifier: MIT */
(() => {
  const A = globalThis.BiliAmbient;
  const css = `
    :host { all:initial; font:13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif; color:#eee; color-scheme:dark; }
    * { box-sizing:border-box; } .panel { width:100%; max-width:320px; max-height:var(--bili-ambient-menu-height,580px); display:flex; flex-direction:column; overflow:hidden; background:rgba(28,28,28,.94); border:1px solid #ffffff14; border-radius:12px; box-shadow:0 8px 30px #0005; animation:appear .15s ease-out; text-align:left; }
    header { display:flex; align-items:center; justify-content:space-between; padding:11px 14px 5px; flex-shrink:0; } h1 { font-size:14px; margin:0; font-weight:600; }
    button,select { font:inherit; color:inherit; background:#ffffff0c; border:1px solid #ffffff14; border-radius:5px; padding:4px 8px; cursor:pointer; } button:hover { background:#ffffff1a; }
    .close { border:0; background:transparent; font:22px/1 sans-serif; padding:2px; width:26px; height:26px; color:#bbb; } .close:hover { color:#fff; }
    button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible { outline:2px solid #00aeec; outline-offset:2px; }
    .status { margin:0; padding:0 14px 10px; color:#aaa; font-size:11px; overflow-wrap:anywhere; flex-shrink:0; }
    .scroll { min-height:0; flex:1; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:#ffffff45 transparent; }
    details { border-top:1px solid #ffffff12; } summary { display:flex; align-items:center; justify-content:space-between; list-style:none; cursor:pointer; font-size:12px; font-weight:500; color:#ccc; padding:10px 14px; } summary::-webkit-details-marker { display:none; } summary::after { content:'›'; font-size:17px; color:#999; line-height:1; } details[open]>summary::after { transform:rotate(90deg); } summary:hover,.field:hover { background:#ffffff09; }
    .field { display:block; padding:8px 14px; } .line { display:flex; justify-content:space-between; gap:10px; align-items:center; min-height:22px; } .line>span { flex:1; }
    output { color:#bbb; font-variant-numeric:tabular-nums; font-size:12px; white-space:nowrap; }
    input[type=range] { display:block; appearance:none; width:100%; height:3px; border-radius:3px; margin:11px 0 6px; padding:0; background:linear-gradient(to right,#ddd var(--fill,0%),#ffffff30 var(--fill,0%)); cursor:pointer; }
    input[type=range]::-webkit-slider-thumb { appearance:none; width:11px; height:11px; border:0; border-radius:50%; background:#fff; box-shadow:0 1px 3px #0005; }
    input[type=range]::-moz-range-thumb { width:11px; height:11px; border:0; border-radius:50%; background:#fff; }
    input[type=checkbox] { appearance:none; position:relative; width:30px; height:16px; flex-shrink:0; margin:0; border:0; border-radius:9px; background:#ffffff38; cursor:pointer; transition:background .12s; }
    input[type=checkbox]::after { content:''; position:absolute; left:2px; top:2px; width:12px; height:12px; border-radius:50%; background:#ccc; transition:transform .12s; }
    input[type=checkbox]:checked { background:#00aeec; } input[type=checkbox]:checked::after { background:#fff; transform:translateX(14px); }
    select { max-width:170px; font-size:12px; padding:3px 5px; } option { background:#242424; }
    .tools { display:flex; gap:6px; flex-wrap:wrap; padding:10px 14px 0; border-top:1px solid #ffffff12; flex-shrink:0; } .tools button { font-size:11px; }
    .notice { font-size:10px; color:#888; margin:0; padding:7px 14px 10px; flex-shrink:0; } .message:empty { display:none; } .message { padding-bottom:0; } .error { color:#ffb6bb; }
    @keyframes appear { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
    @media (prefers-reduced-motion:reduce) { .panel { animation:none; } input[type=checkbox],input[type=checkbox]::after { transition:none; } }
  `;
  const element = (tag, text, attrs = {}) => {
    const e = document.createElement(tag); if (text) e.textContent=text;
    for (const [key,value] of Object.entries(attrs)) e.setAttribute(key,value);
    return e;
  };
  A.createSettingsUI = (host, settings, onChange, onClose) => {
    const shadow=host.attachShadow({mode:'open'});
    const style=element('style',css), panel=element('section',null,{class:'panel','aria-label':'Ambient light for Bilibili 设置'});
    shadow.append(style,panel);
    const header=element('header'), title=element('div');
    title.append(element('h1','Ambient light for Bilibili'));
    header.append(title); panel.append(header);
    if(onClose) { const close=element('button','×',{'aria-label':'关闭设置',class:'close'}); close.addEventListener('click',onClose); header.append(close); }
    const status=element('div','正在寻找播放器…',{class:'status',role:'status','aria-live':'polite'});
    panel.append(status);
    const scroll=element('div',null,{class:'scroll'}); panel.append(scroll);
    const controls=new Map(); let section;
    const message=element('div',null,{class:'notice message',role:'status'});
    let current={...settings};
    const commit=async(patch)=> {
      current={...current,...patch}; update(current);
      try { await onChange(patch); message.textContent='设置已保存'; message.classList.remove('error'); }
      catch { message.textContent='保存失败。扩展更新后请刷新此页面。'; message.classList.add('error'); }
    };
    for(const f of A.fields) {
      if(f.section) {
        section=element('details'); if(f.section==='氛围光') section.open=true;
        section.append(element('summary',f.section)); scroll.append(section); continue;
      }
      const label=element('label',null,{class:'field'}), row=element('span',null,{class:'line'});
      const text=element('span',f.label), input=element(f.type==='select'?'select':'input',null,{'aria-label':f.label});
      row.append(text); label.append(row);
      let output;
      if(f.type==='checkbox') { input.type='checkbox'; row.append(input); }
      else if(f.type==='select') {
        for(const [value,title] of f.options) input.append(element('option',title,{value})); row.append(input);
      } else {
        input.type='range'; input.min=f.min; input.max=f.max; input.step=f.step||1;
        output=element('output'); row.append(output); label.append(input);
      }
      const handler=()=>commit({[f.key]:f.type==='checkbox'?input.checked:typeof f.value==='number'?Number(input.value):input.value});
      input.addEventListener(f.type?'change':'input',handler);
      controls.set(f.key,{input,output,field:f}); section.append(label);
    }
    const tools=element('div',null,{class:'tools'}); panel.append(tools,message);
    const preset=(label,patch)=> { const b=element('button',label); b.addEventListener('click',()=>commit(patch)); tools.append(b); };
    preset('默认',{...A.defaults});
    preset('沉浸',{enabled:true,darkPage:true,spread:45,blur:45,saturation:120,opacity:100,fadeDuration:250,fullscreenScale:85});
    preset('省电',{renderer:'webgl',resolution:128,fps:15,energySaver:true,fadeDuration:0,blur:30,spread:17});
    const exportButton=element('button','导出');
    exportButton.addEventListener('click',()=> {
      const url=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));
      const a=element('a',null,{href:url,download:'bilibili-ambilight-settings.json'}); shadow.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    }); tools.append(exportButton);
    const file=element('input',null,{type:'file',accept:'.json,application/json'}); file.hidden=true; panel.append(file);
    const importButton=element('button','导入'); importButton.addEventListener('click',()=>file.click()); tools.append(importButton);
    file.addEventListener('change',async()=> {
      try {
        const selected=file.files[0]; if(!selected) return;
        if(selected.size>65536) throw new Error('文件过大');
        const parsed=JSON.parse(await selected.text());
        if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) throw new Error('无效配置');
        await commit(A.sanitize(parsed));
      } catch { message.textContent='导入失败：请选择有效的设置 JSON 文件（最大 64 KB）。'; message.classList.add('error'); }
      file.value='';
    });
    panel.append(element('p','Alt + Shift + A 开关氛围光。全屏时缩小画面可为周围光效留出空间。',{class:'notice'}));
    const update=(next)=> {
      current={...next};
      for(const [key,{input,output,field}] of controls) {
        if(field.type==='checkbox') input.checked=current[key]; else input.value=current[key];
        if(output) {output.textContent=`${current[key]}${field.unit?' '+field.unit:''}`;input.style.setProperty('--fill',`${(current[key]-field.min)/(field.max-field.min)*100}%`);}
      }
    };
    update(settings);
    return {update,status(text){ if(status.textContent!==text) status.textContent=text; },focus(){shadow.querySelector('button,input')?.focus({preventScroll:true});}};
  };
})();
