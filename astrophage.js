/*!
 * astrophage.js
 * Bioluminescent particle field — Project Hail Mary astrophage scene
 *
 * Usage:
 *   const scene = Astrophage.init('container-id', { count: 1200, sourceZ: 0.75 })
 *   scene.setOptions({ count: 2000 })
 *   scene.stop()
 *   scene.start()
 *   scene.destroy()
 *
 * Options (all optional, defaults shown):
 *   count      {number}  1200    particle count
 *   driftSpeed {number}  0.30    z advancement rate
 *   sourceZ    {number}  0.75    perspective depth of radiation source
 *                                  low  → tight tunnel from centre
 *                                  high → nearly uniform spread
 *   baseSize   {number}  14      size scale factor (px)
 *   mouseParallax {bool} true    VP follows mouse
 *   background {bool}    true    draw dark crimson background on canvas
 *   onFps      {fn}      null    called each second with current fps number
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();                // CommonJS / Node
  } else if (typeof define === 'function' && define.amd) {
    define(factory);                           // AMD
  } else {
    root.Astrophage = factory();               // Browser global
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ─── defaults ────────────────────────────────────────────────────
  const DEFAULTS = {
    count:         1200,
    driftSpeed:    0.30,
    sourceZ:       0.75,
    baseSize:      14,
    mouseParallax: true,
    background:    true,
    onFps:         null,
  };

  // ─── AstrophageScene class ────────────────────────────────────────
  function AstrophageScene(container, userOpts) {
    // ── state ───────────────────────────────────────────────────────
    this._cfg       = Object.assign({}, DEFAULTS, userOpts);
    this._particles = [];
    this._running   = false;
    this._rafId     = null;
    this._lastT     = 0;
    this._fpsArr    = [];
    this._fpsLast   = 0;
    this._W = this._H = 0;
    this._vpX = this._vpY = this._vpTX = this._vpTY = 0;

    // ── canvas ──────────────────────────────────────────────────────
    this._canvas = document.createElement('canvas');
    const s = this._canvas.style;
    s.position   = 'absolute';
    s.inset      = '0';
    s.width      = '100%';
    s.height     = '100%';
    s.display    = 'block';
    s.pointerEvents = 'none';

    if (typeof container === 'string') {
      this._container = document.getElementById(container);
    } else {
      this._container = container;
    }
    if (!this._container) throw new Error('Astrophage: container not found');

    // Container must be positioned so absolute canvas sits inside it
    const pos = getComputedStyle(this._container).position;
    if (pos === 'static') this._container.style.position = 'relative';

    this._container.appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');

    // ── bound handlers ──────────────────────────────────────────────
    this._onResize = this._resize.bind(this);
    this._onMouse  = this._onMouseMove.bind(this);
    this._loop     = this._loop.bind(this);

    window.addEventListener('resize', this._onResize);
    if (this._cfg.mouseParallax) {
      window.addEventListener('mousemove', this._onMouse);
    }

    this._resize();
    this.start();
  }

  // ── public API ────────────────────────────────────────────────────

  AstrophageScene.prototype.start = function () {
    if (this._running) return;
    this._running = true;
    this._lastT   = performance.now();
    this._rafId   = requestAnimationFrame(this._loop);
    return this;
  };

  AstrophageScene.prototype.stop = function () {
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    return this;
  };

  AstrophageScene.prototype.destroy = function () {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('mousemove', this._onMouse);
    if (this._canvas.parentNode) this._canvas.parentNode.removeChild(this._canvas);
  };

  /**
   * Update one or more options at runtime.
   * Changing count immediately adds/removes particles.
   * Changing baseSize reassigns radii on existing particles.
   */
  AstrophageScene.prototype.setOptions = function (opts) {
    const prev = Object.assign({}, this._cfg);
    Object.assign(this._cfg, opts);

    if (opts.baseSize !== undefined && opts.baseSize !== prev.baseSize) {
      this._particles.forEach(p => { p.baseR = this._randR(); });
    }
    if (opts.count !== undefined && opts.count !== prev.count) {
      this._syncDensity();
    }
    if (opts.mouseParallax !== undefined) {
      if (opts.mouseParallax) {
        window.addEventListener('mousemove', this._onMouse);
      } else {
        window.removeEventListener('mousemove', this._onMouse);
        this._vpTX = this._W / 2;
        this._vpTY = this._H / 2;
      }
    }
    return this;
  };

  // ── internals ─────────────────────────────────────────────────────

  AstrophageScene.prototype._resize = function () {
    const rect = this._container.getBoundingClientRect();
    this._W = this._canvas.width  = rect.width  || window.innerWidth;
    this._H = this._canvas.height = rect.height || window.innerHeight;
    this._vpX = this._vpTX = this._W / 2;
    this._vpY = this._vpTY = this._H / 2;
    if (this._particles.length === 0) this._initParticles();
  };

  AstrophageScene.prototype._onMouseMove = function (e) {
    this._vpTX = this._W / 2 + (e.clientX - this._W / 2) * 0.05;
    this._vpTY = this._H / 2 + (e.clientY - this._H / 2) * 0.04;
  };

  // ── particle factory ─────────────────────────────────────────────

  AstrophageScene.prototype._randR = function () {
    const s = this._cfg.baseSize, r = Math.random();
    if (r < 0.65) return 0.8 + Math.random() * s * 0.16;
    if (r < 0.88) return s * (0.30 + Math.random() * 0.75);
    if (r < 0.97) return s * (1.0  + Math.random() * 1.8);
    return               s * (3.0  + Math.random() * 4.5);
  };

  AstrophageScene.prototype._makeParticle = function (z0) {
    const baseR     = this._randR();
    const speedMult = 0.35 + Math.random() * 1.30;
    const z         = z0 !== undefined ? z0 : Math.random() * 0.06 + 0.001;
    return {
      angle: Math.random() * Math.PI * 2,
      z, baseR, speedMult,

      blinkState: 0, blinkAlpha: 1,
      blinkFadeSpd:  0.5 + Math.random() * 0.9,
      blinkHideDur:  0.6 + Math.random() * 5.0,
      blinkHideTimer: 0,
      blinkChance: 0.00006 + Math.random() * 0.00016,

      flareActive: false, flareAlpha: 0, flarePhase: 0,
      flareChance:  baseR > 5 ? 0.00004 + Math.random() * 0.00009 : 0,
      flareFadeSpd: 0.8 + Math.random() * 0.7,

      shimPhase: Math.random() * Math.PI * 2,
      shimFreq:  0.2 + Math.random() * 1.0,

      birth: performance.now(),
      fadeInDur: 0.15 + Math.random() * 0.50,
      alpha: 0,

      _sx: 0, _sy: 0, _r: 0,
    };
  };

  AstrophageScene.prototype._initParticles = function () {
    this._particles = [];
    for (let i = 0; i < this._cfg.count; i++) {
      const p = this._makeParticle(Math.random());
      p.alpha = 1;
      this._particles.push(p);
    }
  };

  AstrophageScene.prototype._syncDensity = function () {
    while (this._particles.length > this._cfg.count) this._particles.pop();
    while (this._particles.length < this._cfg.count) {
      const p = this._makeParticle(Math.random()); p.alpha = 1;
      this._particles.push(p);
    }
  };

  // ── projection ───────────────────────────────────────────────────

  AstrophageScene.prototype._project = function (p) {
    const vz   = Math.max(0.02, this._cfg.sourceZ);
    const wz   = vz + p.z;
    const span = 1 / vz - 1 / (vz + 1);
    const zp   = (1 / vz - 1 / wz) / span;

    const spread = Math.hypot(this._W, this._H) * 0.62;
    p._sx = this._vpX + Math.cos(p.angle) * zp * spread;
    p._sy = this._vpY + Math.sin(p.angle) * zp * spread;
    p._r  = p.baseR * (0.12 + Math.pow(Math.max(p.z, 0), 0.48) * 3.1);
  };

  // ── update ───────────────────────────────────────────────────────

  AstrophageScene.prototype._update = function (dt, now) {
    const cfg = this._cfg;
    const ps  = this._particles;
    const W = this._W, H = this._H;

    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.z    += cfg.driftSpeed * p.speedMult * dt * (0.03 + p.z * 0.09);
      p.alpha = Math.min(1, (now - p.birth) / 1000 / p.fadeInDur);

      this._tickBlink(p, dt);
      this._tickFlare(p, dt);
      this._project(p);

      const m = p._r * 2 + 60;
      if (p.z >= 1 || p._sx < -m || p._sx > W + m || p._sy < -m || p._sy > H + m) {
        ps[i] = this._makeParticle(Math.random() * 0.05 + 0.001);
      }
    }
    ps.sort((a, b) => a.z - b.z);
  };

  AstrophageScene.prototype._tickBlink = function (p, dt) {
    switch (p.blinkState) {
      case 0: if (Math.random() < p.blinkChance) p.blinkState = 1; p.blinkAlpha = 1; break;
      case 1:
        p.blinkAlpha -= p.blinkFadeSpd * dt;
        if (p.blinkAlpha <= 0) { p.blinkAlpha = 0; p.blinkState = 2; p.blinkHideTimer = p.blinkHideDur; }
        break;
      case 2:
        p.blinkHideTimer -= dt;
        if (p.blinkHideTimer <= 0) p.blinkState = 3;
        break;
      case 3:
        p.blinkAlpha += p.blinkFadeSpd * dt;
        if (p.blinkAlpha >= 1) { p.blinkAlpha = 1; p.blinkState = 0; }
        break;
    }
  };

  AstrophageScene.prototype._tickFlare = function (p, dt) {
    if (!p.flareActive) {
      if (p.blinkState === 0 && Math.random() < p.flareChance) {
        p.flareActive = true; p.flareAlpha = 0; p.flarePhase = 0;
      }
    } else {
      if (p.flarePhase === 0) {
        p.flareAlpha += p.flareFadeSpd * dt;
        if (p.flareAlpha >= 1) { p.flareAlpha = 1; p.flarePhase = 1; }
      } else {
        p.flareAlpha -= p.flareFadeSpd * 0.45 * dt;
        if (p.flareAlpha <= 0) { p.flareAlpha = 0; p.flareActive = false; }
      }
    }
  };

  // ── draw ─────────────────────────────────────────────────────────

  AstrophageScene.prototype._drawBackground = function () {
    const ctx = this._ctx, W = this._W, H = this._H;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#120001';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * .5, H * .5, 0, W * .5, H * .5, Math.hypot(W, H) * .55);
    g.addColorStop(0,    'rgba(100, 4, 10, 0.55)');
    g.addColorStop(0.45, 'rgba( 55, 2,  6, 0.30)');
    g.addColorStop(1,    'rgba(  0, 0,  0, 0.00)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  AstrophageScene.prototype._draw = function (t) {
    const ctx = this._ctx, W = this._W, H = this._H;
    ctx.clearRect(0, 0, W, H);
    if (this._cfg.background) this._drawBackground();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const p of this._particles) {
      const { _sx: sx, _sy: sy, _r: r } = p;
      if (r < 0.4 || p.alpha <= 0 || p.blinkAlpha <= 0) continue;
      const shim = 0.88 + 0.12 * Math.sin(p.shimPhase + t * p.shimFreq);
      const a    = p.alpha * p.blinkAlpha * shim;
      if (a < 0.004) continue;

      this._drawBokeh(ctx, sx, sy, r, a);
      if (p.flareActive && p.flareAlpha > 0.01)
        this._drawBokehWhite(ctx, sx, sy, r, a * p.flareAlpha);
    }

    ctx.restore();
  };

  AstrophageScene.prototype._drawBokeh = function (ctx, sx, sy, r, alpha) {
    const PI2    = Math.PI * 2;
    const cl     = v => Math.min(1, v);
    const outerR = r * 1.10;
    const rn     = r / outerR;
    const g      = ctx.createRadialGradient(sx, sy, 0, sx, sy, outerR);

    if (r < 2.5) {
      g.addColorStop(0,    `rgba(255, 140, 150, ${cl(alpha * 0.90)})`);
      g.addColorStop(0.22, `rgba(255,  90, 105, ${cl(alpha * 0.65)})`);
      g.addColorStop(0.55, `rgba(200,  30,  45, ${cl(alpha * 0.25)})`);
      g.addColorStop(1,    'rgba(0,0,0,0)');
    } else {
      g.addColorStop(0,                     `rgba(255, 100, 115, ${cl(alpha * 0.55)})`);
      g.addColorStop(rn * 0.45,            `rgba(252,  88, 104, ${cl(alpha * 0.52)})`);
      g.addColorStop(rn * 0.68,            `rgba(235,  55,  72, ${cl(alpha * 0.45)})`);
      g.addColorStop(rn * 0.88,            `rgba(200,  22,  38, ${cl(alpha * 0.36)})`);
      g.addColorStop(rn,                    `rgba(162,  10,  22, ${cl(alpha * 0.26)})`);
      g.addColorStop(rn + (1 - rn) * 0.5, `rgba(110,   5,  12, ${cl(alpha * 0.08)})`);
      g.addColorStop(1,                     'rgba(0,0,0,0)');
    }

    ctx.beginPath();
    ctx.arc(sx, sy, outerR, 0, PI2);
    ctx.fillStyle = g;
    ctx.fill();
  };

  AstrophageScene.prototype._drawBokehWhite = function (ctx, sx, sy, r, alpha) {
    const PI2    = Math.PI * 2;
    const cl     = v => Math.min(1, v);
    const outerR = r * 1.30;
    const g      = ctx.createRadialGradient(sx, sy, 0, sx, sy, outerR);
    g.addColorStop(0,    `rgba(255, 255, 255, ${cl(alpha)})`);
    g.addColorStop(0.40, `rgba(255, 240, 240, ${cl(alpha * 0.88)})`);
    g.addColorStop(0.75, `rgba(255, 200, 210, ${cl(alpha * 0.60)})`);
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(sx, sy, outerR, 0, PI2);
    ctx.fillStyle = g;
    ctx.fill();
  };

  // ── main loop ────────────────────────────────────────────────────

  AstrophageScene.prototype._loop = function (now) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._loop);

    const dt = Math.min((now - this._lastT) / 1000, 1 / 20);
    this._lastT = now;

    this._vpX += (this._vpTX - this._vpX) * 0.08;
    this._vpY += (this._vpTY - this._vpY) * 0.08;

    this._update(dt, now);
    this._draw(now / 1000);

    // FPS reporting
    if (this._cfg.onFps) {
      this._fpsArr.push(1 / Math.max(dt, 0.001));
      if (now - this._fpsLast > 600) {
        const fps = (this._fpsArr.reduce((a, b) => a + b, 0) / this._fpsArr.length) | 0;
        this._cfg.onFps(fps);
        this._fpsArr = []; this._fpsLast = now;
      }
    }
  };

  // ── static entry point ───────────────────────────────────────────

  return {
    /**
     * Create and start an astrophage scene.
     * @param  {string|HTMLElement} container  element id or DOM node
     * @param  {object}             [options]  see DEFAULTS above
     * @returns {AstrophageScene}
     */
    init: function (container, options) {
      return new AstrophageScene(container, options || {});
    },
  };
}));
