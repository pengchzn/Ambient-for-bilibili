/* SPDX-License-Identifier: MIT */
(async () => {
  const A=globalThis.BiliAmbient;
  const ui=A.createSettingsUI(document.getElementById('settings'),await A.readSettings(),A.writeSettings);
  chrome.storage.onChanged.addListener(async(_changes,area)=>{if(area==='local')ui.update(await A.readSettings());});
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const status=await chrome.tabs.sendMessage(tab.id,{type:'bili-ambient-status'});
    ui.status(status.message);
  } catch { ui.status('打开哔哩哔哩视频后生效；首次安装后需刷新视频页。'); }
})();
