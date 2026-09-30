/* SPDX-License-Identifier: MIT */
(() => {
  const A = globalThis.BiliAmbient = globalThis.BiliAmbient || {};
  A.STORAGE_KEY = 'biliAmbientSettings';
  A.fields = [
    { section: '氛围光' },
    { key: 'enabled', label: '启用氛围光', type: 'checkbox', value: true },
    { key: 'darkPage', label: '暗色页面', type: 'checkbox', value: true },
    { key: 'blur', label: '模糊', min: 0, max: 100, value: 30, unit: '%' },
    { key: 'spread', label: '扩散范围', min: 0, max: 200, value: 17, unit: '%' },
    { key: 'opacity', label: '氛围光强度', min: 0, max: 100, value: 100, unit: '%' },
    { key: 'fadeDuration', label: '颜色过渡', min: 0, max: 2000, step: 50, value: 0, unit: 'ms' },
    { key: 'flickerReduction', label: '闪烁抑制', min: 0, max: 100, value: 0, unit: '%' },
    { section: '色彩' },
    { key: 'brightness', label: '亮度', min: 0, max: 200, value: 100, unit: '%' },
    { key: 'saturation', label: '饱和度', min: 0, max: 200, value: 100, unit: '%' },
    { key: 'vibrance', label: '色彩鲜活度（WebGL）', min: 0, max: 200, value: 100, unit: '%' },
    { key: 'contrast', label: '对比度', min: 0, max: 200, value: 100, unit: '%' },
    { key: 'noise', label: '去色带噪点（WebGL）', min: 0, max: 100, value: 0, unit: '%' },
    { section: '画面与黑边' },
    { key: 'detectHorizontal', label: '自动检测上下黑边', type: 'checkbox', value: false },
    { key: 'detectVertical', label: '自动检测左右黑边', type: 'checkbox', value: false },
    { key: 'detectColored', label: '同时检测纯色边框', type: 'checkbox', value: false },
    { key: 'cropHorizontal', label: '手动上下裁剪（每侧）', min: 0, max: 40, step: 0.5, value: 0, unit: '%' },
    { key: 'cropVertical', label: '手动左右裁剪（每侧）', min: 0, max: 40, step: 0.5, value: 0, unit: '%' },
    { key: 'fillVideo', label: '放大视频以填满检测到的黑边', type: 'checkbox', value: false },
    { key: 'videoScale', label: '普通模式画面尺寸', min: 50, max: 100, value: 100, unit: '%' },
    { key: 'fullscreenScale', label: '全屏画面尺寸', min: 50, max: 100, value: 88, unit: '%' },
    { section: '性能与布局' },
    { key: 'renderer', label: '渲染器', type: 'select', value: 'webgl', options: [['webgl', 'WebGL（推荐）'], ['2d', 'Canvas 2D（兼容模式）']] },
    { key: 'resolution', label: '采样最长边', type: 'select', value: 256, options: [[128, '128（省电）'], [256, '256（均衡）'], [512, '512（细腻）']] },
    { key: 'fps', label: '帧率上限', min: 5, max: 60, value: 60, unit: 'fps' },
    { key: 'frameSync', label: '同步方式', type: 'select', value: 'video', options: [['video', '跟随视频帧'], ['display', '跟随屏幕刷新']] },
    { key: 'energySaver', label: '静止画面省电', type: 'checkbox', value: false },
    { key: 'fullscreenEnabled', label: '全屏 / 网页全屏启用', type: 'checkbox', value: true },
    { key: 'normalEnabled', label: '普通 / 宽屏模式启用', type: 'checkbox', value: true },
    { key: 'scrollBackground', label: '浏览评论时保留全页氛围光', type: 'checkbox', value: true },
    { key: 'fixedPosition', label: '滚动时固定氛围光位置', type: 'checkbox', value: false },
    { key: 'showStats', label: '显示帧率和渲染状态', type: 'checkbox', value: false },
    { section: '页面融合' },
    { key: 'blendHeader', label: '页首融入背景', type: 'checkbox', value: true },
    { key: 'hideHeaderWide', label: '宽屏时自动隐藏页首', type: 'checkbox', value: false },
    { key: 'blendSidebar', label: '侧栏与播放列表融入背景', type: 'checkbox', value: true },
    { key: 'blendDanmaku', label: '弹幕输入栏融入背景', type: 'checkbox', value: true },
    { key: 'blendComments', label: '评论输入框融入背景', type: 'checkbox', value: true },
    { key: 'textShadow', label: '文字可读性阴影', type: 'checkbox', value: true },
    { key: 'contentOpacity', label: '页面卡片背景强度', min: 0, max: 100, value: 55, unit: '%' },
    { section: '高级扩散' },
    { key: 'edge', label: '投射层间距', min: 2, max: 50, value: 12, unit: '%' },
    { key: 'fadeStart', label: '边缘渐隐起点', min: -50, max: 100, value: 15, unit: '%' },
    { key: 'fadeCurve', label: '边缘渐隐曲线', min: 1, max: 100, value: 35 },
    { key: 'top', label: '上方氛围光', type: 'checkbox', value: true },
    { key: 'right', label: '右侧氛围光', type: 'checkbox', value: true },
    { key: 'bottom', label: '下方氛围光', type: 'checkbox', value: true },
    { key: 'left', label: '左侧氛围光', type: 'checkbox', value: true }
  ];
  A.defaults = Object.fromEntries(A.fields.filter(f => f.key).map(f => [f.key, f.value]));
  A.sanitize = (input) => {
    const settings = { ...A.defaults };
    if (!input || typeof input !== 'object' || Array.isArray(input)) return settings;
    for (const f of A.fields) {
      if (!f.key || !Object.hasOwn(input, f.key)) continue;
      const v = input[f.key];
      if (f.type === 'checkbox') { if (typeof v === 'boolean') settings[f.key] = v; }
      else if (f.type === 'select') {
        const option = f.options.find(([value]) => value === v);
        if (option) settings[f.key] = option[0];
      } else if (typeof v === 'number' && Number.isFinite(v)) {
        settings[f.key] = Math.min(f.max, Math.max(f.min, v));
      }
    }
    return settings;
  };
  // Each field has its own storage key: simultaneous edits in different tabs cannot overwrite other fields.
  A.readSettings = async () => {
    const data = await chrome.storage.local.get([A.STORAGE_KEY, ...Object.keys(A.defaults)]);
    return A.sanitize({ ...(data[A.STORAGE_KEY] || {}), ...data });
  };
  A.writeSettings = async (patch) => {
    const valid = A.sanitize(patch);
    await chrome.storage.local.set(Object.fromEntries(Object.keys(patch).filter(k => Object.hasOwn(A.defaults, k)).map(k => [k, valid[k]])));
  };
})();
