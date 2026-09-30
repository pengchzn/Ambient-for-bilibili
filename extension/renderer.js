/* SPDX-License-Identifier: MIT
 * Multi-layer projection and vibrance shader adapted from Wessel Kroos' youtube-ambilight (MIT).
 * See LICENSE for retained MIT notices.
 */
(() => {
  const A = globalThis.BiliAmbient;
  const vertex = `attribute vec2 position; varying vec2 uv;
    void main() { uv = position * .5 + .5; gl_Position = vec4(position.x, -position.y, 0., 1.); }`;
  const fragment = `precision highp float;
    varying vec2 uv;
    uniform sampler2D image; uniform sampler2D shadow;
    uniform vec2 maxScale; uniform vec2 scaleStep;
    uniform float vibrance; uniform float noise;
    vec3 rgb2hsv(vec3 c) {
      vec4 K=vec4(0.,-1./3.,2./3.,-1.);
      vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
      vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
      float d=q.x-min(q.w,q.y); float e=1.e-10;
      return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);
    }
    vec3 hsv2rgb(vec3 c) {
      vec4 K=vec4(1.,2./3.,1./3.,3.);
      vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);
      return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);
    }
    float saturateV(float c,float v) {
      float x=v<0.?1.-c:c; float a=1.+5.*(1.-abs(v));
      float y=a*a-x*((a*a-1.)/(a*a))-(a-x/a)*(a-x/a);
      y=min(1.,x+(y-x)*5.); return v>=0.?y:1.-y;
    }
    void main() {
      // Upstream chooses the innermost scaled video layer that contains this pixel.
      vec2 direction=ceil(uv*2.)-1.;
      vec2 iUV=((direction-uv)*maxScale)/((direction-.5)*scaleStep);
      float i=floor(min(iUV.x,iUV.y));
      vec2 denominator=max(vec2(.001),maxScale-scaleStep*i);
      vec2 sampleUV=(uv-.5)*(maxScale/denominator)+.5;
      vec3 color=texture2D(image,clamp(sampleUV,0.,1.)).rgb;
      if(vibrance!=0.) { vec3 hsv=rgb2hsv(color); hsv.y=saturateV(hsv.y,vibrance); color=hsv2rgb(hsv); }
      float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
      color+=grain*noise/255.;
      gl_FragColor=vec4(color,1.-texture2D(shadow,uv).a);
    }`;
  class Renderer {
    constructor(parent, preferred, onFallback) {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'bili-ambient-canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.shadow = new A.ProjectorShadow(false);
      this.onFallback = onFallback;
      this.type = 'Canvas 2D';
      if (preferred === 'webgl') {
        try {
          const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, depth: false, antialias: false, preserveDrawingBuffer: false });
          if (!gl) throw new Error('WebGL 不可用');
          this.gl = gl;
          this.initializeGL();
          this.type = 'WebGL';
        } catch (error) {
          this.disposeGL();
          this.canvas = document.createElement('canvas');
          this.canvas.className = 'bili-ambient-canvas';
          onFallback(error.message);
        }
      }
      if (!this.gl) this.ctx = this.canvas.getContext('2d', { alpha: true });
      if (!this.ctx && !this.gl) throw new Error('浏览器无法创建绘图画布');
      this.canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        if(this.destroyed) return;
        this.onFallback('WebGL 上下文丢失，已切换 Canvas 2D');
        const replacement = document.createElement('canvas');
        replacement.className = this.canvas.className;
        this.canvas.replaceWith(replacement);
        this.disposeGL();
        this.canvas = replacement;
        this.ctx = replacement.getContext('2d');
        this.type = 'Canvas 2D';
        this.cacheKey = null;
      });
      parent.append(this.canvas);
    }
    initializeGL() {
      const g = this.gl;
      const program = g.createProgram();
      this.program = program;
      this.shaders = [];
      for (const [kind, source] of [[g.VERTEX_SHADER, vertex], [g.FRAGMENT_SHADER, fragment]]) {
        const shader = g.createShader(kind);
        this.shaders.push(shader);
        g.shaderSource(shader, source); g.compileShader(shader);
        if (!g.getShaderParameter(shader, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(shader));
        g.attachShader(program, shader);
      }
      g.linkProgram(program);
      if (!g.getProgramParameter(program, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(program));
      g.useProgram(program);
      this.buffer = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, this.buffer);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), g.STATIC_DRAW);
      const position = g.getAttribLocation(program, 'position');
      g.enableVertexAttribArray(position); g.vertexAttribPointer(position, 2, g.FLOAT, false, 0, 0);
      this.uniforms = Object.fromEntries(['image','shadow','maxScale','scaleStep','vibrance','noise'].map(k=>[k,g.getUniformLocation(program,k)]));
      this.textures = [0, 1].map(unit => {
        const t = g.createTexture(); g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D,t);
        for (const k of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER]) g.texParameteri(g.TEXTURE_2D,k,g.LINEAR);
        for (const k of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T]) g.texParameteri(g.TEXTURE_2D,k,g.CLAMP_TO_EDGE);
        return t;
      });
      g.uniform1i(this.uniforms.image,0); g.uniform1i(this.uniforms.shadow,1);
    }
    layout(rect, settings) {
      this.rect = rect; this.settings = settings;
      const scales = this.scales = A.scales(rect.width, rect.height, settings);
      this.lastScale = scales.at(-1);
      const width = rect.width * this.lastScale.x, height = rect.height * this.lastScale.y;
      const target = Math.min(1, 1600 / Math.max(width,height));
      const key = JSON.stringify([rect.width,rect.height,settings.edge,settings.spread,settings.fadeStart,settings.fadeCurve,settings.top,settings.right,settings.bottom,settings.left]);
      const resized=key !== this.cacheKey;
      if (resized) {
        this.canvas.width = Math.max(1, Math.round(width * target));
        this.canvas.height = Math.max(1, Math.round(height * target));
        this.shadow.rescale(this.lastScale, { w: rect.width, h: rect.height }, {
          spreadFadeCurve: settings.fadeCurve, spreadFadeStart: settings.fadeStart,
          directionTopEnabled: settings.top, directionRightEnabled: settings.right,
          directionBottomEnabled: settings.bottom, directionLeftEnabled: settings.left
        });
        if (this.gl) {
          const g = this.gl;
          g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D,this.textures[1]);
          g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,this.shadow.elem);
        } else {
          const mask = this.mask = document.createElement('canvas');
          mask.width = mask.height = 512;
          const ctx = mask.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0,0,512,512);
          ctx.globalCompositeOperation='destination-out'; ctx.drawImage(this.shadow.elem,0,0);
        }
        this.cacheKey = key;
      }
      Object.assign(this.canvas.style, {
        width: `${width}px`, height: `${height}px`,
        left: `${rect.x - (width - rect.width) / 2}px`, top: `${rect.y - (height - rect.height) / 2}px`,
        opacity: String(settings.opacity / 100),
        filter: `blur(${rect.height * .0025 * settings.blur}px) brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%)`
      });
      return resized;
    }
    draw(source) {
      if (!this.rect) return;
      const s = this.settings;
      if (this.gl) {
        const g = this.gl;
        if (g.isContextLost()) return;
        g.viewport(0,0,this.canvas.width,this.canvas.height);
        g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D,this.textures[0]);
        g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,source);
        g.uniform2f(this.uniforms.maxScale,this.lastScale.x,this.lastScale.y);
        const longest=Math.max(this.rect.width,this.rect.height);
        g.uniform2f(this.uniforms.scaleStep,s.edge/100*longest/this.rect.width,s.edge/100*longest/this.rect.height);
        const v=s.vibrance/100-1;
        g.uniform1f(this.uniforms.vibrance,Math.sign(v)*(1-Math.pow(1-Math.abs(v),3)));
        g.uniform1f(this.uniforms.noise,s.noise/100*8);
        g.drawArrays(g.TRIANGLES,0,6);
      } else {
        const ctx = this.ctx, w=this.canvas.width, h=this.canvas.height;
        ctx.clearRect(0,0,w,h);
        ctx.globalCompositeOperation='source-over';
        for (const scale of [...this.scales].reverse()) {
          const sw=w*scale.x/this.lastScale.x, sh=h*scale.y/this.lastScale.y;
          ctx.drawImage(source,(w-sw)/2,(h-sh)/2,sw,sh);
        }
        ctx.globalCompositeOperation='destination-in'; ctx.drawImage(this.mask,0,0,w,h);
        ctx.globalCompositeOperation='source-over';
      }
    }
    clear() {
      if(this.gl) { this.gl.clearColor(0,0,0,0); this.gl.clear(this.gl.COLOR_BUFFER_BIT); }
      else this.ctx?.clearRect(0,0,this.canvas.width,this.canvas.height);
    }
    disposeGL() {
      if(!this.gl) return;
      for(const t of this.textures || []) this.gl.deleteTexture(t);
      for(const s of this.shaders || []) this.gl.deleteShader(s);
      if(this.buffer) this.gl.deleteBuffer(this.buffer);
      if(this.program) this.gl.deleteProgram(this.program);
      this.gl = null;
    }
    destroy() { this.destroyed=true; this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); this.disposeGL(); this.canvas.remove(); }
  }
  A.Renderer = Renderer;
})();
