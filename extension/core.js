/* SPDX-License-Identifier: MIT */
(() => {
  const A = globalThis.BiliAmbient;
  A.isPlaybackPage = (url) => {
    const u = new URL(url);
    return u.hostname === 'player.bilibili.com' ||
      (u.hostname === 'live.bilibili.com' && /^\/(?:blanc\/)?\d+(?:\/|$)/.test(u.pathname)) ||
      (u.hostname === 'www.bilibili.com' && /^\/(video\/|bangumi\/play\/|cheese\/play\/|medialist\/play\/|list\/|festival\/)/.test(u.pathname));
  };
  A.scales = (width, height, settings) => {
    // Ported from youtube-ambilight Ambientlight.resizeCanvasses / recreateProjectors (MIT).
    const levels = Math.max(2, Math.round(settings.spread / settings.edge) + 3);
    const longest = Math.max(width, height);
    const stepX = settings.edge / 100 * longest / width;
    const stepY = settings.edge / 100 * longest / height;
    return Array.from({ length: levels }, (_, i) => ({
      x: Math.max(1 / width, 1 + stepX * (i - 2)),
      y: Math.max(1 / height, 1 + stepY * (i - 2))
    }));
  };
  A.containRect = (box, videoWidth, videoHeight) => {
    if (!videoWidth || !videoHeight) return { ...box };
    const ratio = Math.min(box.width / videoWidth, box.height / videoHeight);
    const width = videoWidth * ratio, height = videoHeight * ratio;
    return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
  };
  A.cropRect = (rect, crop) => ({
    x: rect.x + rect.width * crop.x, y: rect.y + rect.height * crop.y,
    width: rect.width * (1 - 2 * crop.x), height: rect.height * (1 - 2 * crop.y)
  });
  A.detectBars = (pixels, width, height, { horizontal = true, vertical = true, colored = false } = {}) => {
    const lineIsBar = (index, rows) => {
      const count = rows ? width : height;
      const refOffset = rows ? (index * width + Math.floor(width * 0.15)) * 4 : (Math.floor(height * 0.15) * width + index) * 4;
      const reference = Array.from(pixels.slice(refOffset, refOffset + 3));
      if (!colored && Math.max(...reference) > 20) return false;
      let good = 0, total = 0;
      for (let i = Math.floor(count * 0.1); i < count * 0.9; i++) {
        const offset = (rows ? index * width + i : i * width + index) * 4;
        total++;
        if (colored ? reference.every((v, c) => Math.abs(v - pixels[offset + c]) < 12) : Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 24) good++;
      }
      return good / total > 0.97;
    };
    const scan = (length, rows) => {
      let start = 0, end = 0;
      const limit = Math.floor(length * 0.3);
      while (start < limit && lineIsBar(start, rows)) start++;
      while (end < limit && lineIsBar(length - end - 1, rows)) end++;
      // All-dark frames and uneven scene objects must not change the crop.
      if (start >= limit || end >= limit || Math.abs(start - end) > Math.max(2, length * 0.025)) return 0;
      return Math.max(0, Math.min(start, end) - 1) / length;
    };
    return { x: vertical ? scan(width, false) : 0, y: horizontal ? scan(height, true) : 0 };
  };
  A.mergeCrop = (settings, auto) => ({
    x: Math.min(0.4, Math.max(settings.cropVertical / 100, settings.detectVertical ? auto.x : 0)),
    y: Math.min(0.4, Math.max(settings.cropHorizontal / 100, settings.detectHorizontal ? auto.y : 0))
  });
  A.blendAlpha = (elapsedMs, durationMs) => durationMs > 0 ? 1 - Math.exp(-Math.max(1, elapsedMs) * 3 / durationMs) : 1;
  A.flickerAlpha = (elapsedMs, strength, previousLuma, targetLuma) => {
    const delta=Math.abs(targetLuma-previousLuma);
    if(!strength || previousLuma==null || delta<1) return 1;
    const allowed=(1-strength/105)*12*Math.max(1,elapsedMs)/16.67;
    return Math.min(1,Math.max(.005,allowed/delta));
  };
})();
