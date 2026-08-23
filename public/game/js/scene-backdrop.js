/* =========================================================================
 * scene-backdrop.js — 场景氛围背景渲染器（UI 即场景版）
 *
 * 不再依赖图片，整屏氛围全部由 Canvas 程序化生成：
 *   底层：scene.field 色彩场 —— 底色 + 2~3 团缓慢漂移的径向渐辉光斑，
 *         随场景切换做约 1s 的叠化过渡；
 *   上层：scene.particle 环境粒子 —— rain 雨丝 / bokeh 漂浮光斑 /
 *         screen 屏幕微光脉动 / dust 阳光浮尘 / null 完全静止（冷场）。
 *
 * 入口：SceneBackdrop.render(canvas, scenario) / SceneBackdrop.stop()
 * ========================================================================= */

const SceneBackdrop = (() => {
  'use strict';

  let canvas = null, ctx = null, rafId = null;
  let scene = null;              // 当前场景氛围配置
  let dpr = 1;
  let particles = [];            // 粒子池
  let ripples = [];              // 雨滴涟漪
  let streaks = [];              // 偶发流光
  let lastRipple = 0, lastStreak = 0;
  let transSnap = null;          // 叠化用的上一帧快照
  let transStart = 0;            // 叠化起始时间
  const TRANS_MS = 1000;

  /* 场景符号线稿精灵层：一张缓存图 + 多个实例 */
  let motifKey = null, motifTone = null, motifImg = null;
  let motifItems = [], motifMini = [];

  /* ---------- 从 scenario 提取氛围配置（带兜底） ---------- */
  function resolve(s) {
    const sc = (s && s.scene) || {};
    return {
      tone: sc.tone || 'dark',
      field: sc.field || { base: '#0b0e1a', glows: [{ c: 'rgba(120,140,255,.22)', x: .5, y: .6, r: .8 }] },
      particle: sc.particle || null,
      motif: sc.motif || null,
      density: typeof sc.density === 'number' ? sc.density : .5,
      emoji: sc.emoji || '💬',
      location: sc.location, time: sc.time, weather: sc.weather, mood: sc.mood,
    };
  }

  /* ---------- 粒子池初始化 ---------- */
  function buildParticles(W, H) {
    particles = [];
    ripples = [];
    streaks = [];
    if (!scene || !scene.particle) return;
    const n = Math.round({
      rain: 90, bokeh: 16, dust: 26, screen: 0,
    }[scene.particle] * scene.density) || 0;

    for (let i = 0; i < n; i++) {
      if (scene.particle === 'rain') {
        particles.push({
          x: Math.random() * W * 1.2, y: Math.random() * H,
          len: 14 + Math.random() * 22, spd: 9 + Math.random() * 7,
          drift: 2.2, alpha: .10 + Math.random() * .16,
        });
      } else if (scene.particle === 'bokeh') {
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          r: 6 + Math.random() * 26, ph: Math.random() * Math.PI * 2,
          vx: .12 + Math.random() * .25, vy: -.05 - Math.random() * .12,
          alpha: .05 + Math.random() * .10,
        });
      } else if (scene.particle === 'dust') {
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          r: .8 + Math.random() * 1.8, ph: Math.random() * Math.PI * 2,
          vx: .06 + Math.random() * .12, vy: .03 + Math.random() * .08,
          alpha: .12 + Math.random() * .2,
        });
      }
    }
  }

  /* ---------- 场景符号线稿层：多实例散布、缓慢漂移、呼吸缩放 ---------- */
  function buildMotifItems(W, H) {
    motifItems = [];
    motifMini = [];
    if (!scene || !scene.motif) return;

    const count = 6 + Math.floor(scene.density * 5);        // 6~11 个主符号
    /* 最小间距采样：符号彼此保持距离，逐个可辨识，不叠成一团 */
    const minDist = Math.min(W, H) * 0.26;
    for (let i = 0; i < count; i++) {
      let x = 0, y = 0;
      for (let t = 0; t < 24; t++) {
        x = Math.random() * W; y = Math.random() * H;
        if (motifItems.every(p => (p.x - x) ** 2 + (p.y - y) ** 2 > minDist * minDist)) break;
      }
      motifItems.push({
        x, y,
        scale: 0.60 + Math.random() * 1.10,
        rot: (Math.random() - 0.5) * 0.9,
        phase: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.14,
        vr: (Math.random() - 0.5) * 0.0012,
        alpha: 0.09 + Math.random() * 0.065,
        breathe: 5000 + Math.random() * 6000,
      });
    }

    const miniCount = 14 + Math.floor(scene.density * 10);  // 14~24 个微点/短线
    for (let i = 0; i < miniCount; i++) {
      motifMini.push({
        type: Math.random() < 0.55 ? 'dot' : 'line',
        x: Math.random() * W, y: Math.random() * H,
        r: 1.0 + Math.random() * 2.6,
        len: 8 + Math.random() * 22,
        rot: Math.random() * Math.PI,
        phase: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.12,
        alpha: 0.02 + Math.random() * 0.03,
      });
    }
  }

  function updateAndDrawMotifs(c, W, H, now, dark) {
    if (!motifImg) return;
    const still = scene.pace === 'cold';
    const ink = dark ? 'rgba(255,255,255,.85)' : 'rgba(96,70,50,.85)';

    for (const p of motifItems) {
      if (!still) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.x < -180) p.x = W + 180;
        if (p.x > W + 180) p.x = -180;
        if (p.y < -180) p.y = H + 180;
        if (p.y > H + 180) p.y = -180;
      }
      const breath = 1 + Math.sin(now / p.breathe + p.phase) * 0.04;
      const s = p.scale * breath;
      c.save();
      c.globalAlpha = p.alpha;
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.scale(s, s);
      c.drawImage(motifImg, -100, -100, 200, 200);
      c.restore();
    }

    c.save();
    c.lineWidth = 1;
    c.lineCap = 'round';
    for (const m of motifMini) {
      if (!still) {
        m.x += m.vx; m.y += m.vy;
        if (m.x < -20) m.x = W + 20;
        if (m.x > W + 20) m.x = -20;
        if (m.y < -20) m.y = H + 20;
        if (m.y > H + 20) m.y = -20;
      }
      c.globalAlpha = m.alpha * (0.65 + 0.35 * Math.sin(now / 2600 + m.phase));
      c.fillStyle = ink;
      c.strokeStyle = ink;
      if (m.type === 'dot') {
        c.beginPath();
        c.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        c.fill();
      } else {
        c.beginPath();
        c.moveTo(m.x, m.y);
        c.lineTo(m.x + Math.cos(m.rot) * m.len, m.y + Math.sin(m.rot) * m.len);
        c.stroke();
      }
    }
    c.restore();
  }

  /* ---------- 绘制一帧 ---------- */
  function drawFrame(now, targetCtx, W, H) {
    const c = targetCtx;
    const f = scene.field;
    const dark = scene.tone !== 'light';

    // 底色
    c.fillStyle = f.base;
    c.fillRect(0, 0, W, H);

    // 漂移辉光斑（30~60s 一个呼吸周期）
    f.glows.forEach((g, i) => {
      const t = now / 1000;
      const gx = (g.x + Math.sin(t / (14 + i * 7) + i * 2.1) * .06) * W;
      const gy = (g.y + Math.cos(t / (18 + i * 5) + i * 1.3) * .05) * H;
      const gr = g.r * Math.max(W, H) * (1 + Math.sin(t / (9 + i * 4)) * .06);
      const grad = c.createRadialGradient(gx, gy, 0, gx, gy, gr);
      grad.addColorStop(0, g.c);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grad;
      c.fillRect(0, 0, W, H);
    });

    // 屏幕微光脉动（模拟手机亮屏的呼吸）
    if (scene.particle === 'screen') {
      const pulse = .5 + Math.sin(now / 1400) * .5;
      const g0 = f.glows[0];
      const px = g0.x * W, py = g0.y * H;
      const grad = c.createRadialGradient(px, py, 0, px, py, g0.r * Math.max(W, H) * .9);
      grad.addColorStop(0, g0.c.replace(/[\d.]+\)$/, (parseFloat(g0.c.match(/[\d.]+\)$/) || [.25])[0] * (0.7 + pulse * .6)).toFixed(3) + ')'));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grad;
      c.fillRect(0, 0, W, H);
    }

    // 场景符号线稿层（主符号 + 微点，在粒子后方、色场上方）
    updateAndDrawMotifs(c, W, H, now, dark);

    // 粒子
    for (const p of particles) {
      if (scene.particle === 'rain') {
        p.y += p.spd; p.x += p.drift;
        if (p.y > H + 30) { p.y = -30; p.x = Math.random() * W * 1.2; }
        c.strokeStyle = `rgba(180,200,235,${p.alpha})`;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - p.drift * (p.len / p.spd), p.y - p.len);
        c.stroke();
      } else if (scene.particle === 'bokeh') {
        p.x += p.vx; p.y += p.vy;
        if (p.x > W + 40) p.x = -40;
        if (p.y < -40) p.y = H + 40;
        const tw = .6 + Math.sin(now / 900 + p.ph) * .4;
        const warm = scene.tone === 'light' ? '255,240,220' : '255,190,120';
        const grad = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, `rgba(${warm},${(p.alpha * tw).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = grad;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
      } else if (scene.particle === 'dust') {
        p.x += p.vx; p.y += p.vy;
        if (p.x > W + 10) p.x = -10;
        if (p.y > H + 10) p.y = -10;
        const tw = .5 + Math.sin(now / 1600 + p.ph) * .5;
        c.fillStyle = `rgba(120,110,90,${(p.alpha * tw).toFixed(3)})`;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
      }
    }

    // ---- 灵动感增强层 ----

    // 雨丝落地涟漪（rain 场景专属）
    if (scene.particle === 'rain') {
      if (now - lastRipple > 650 && ripples.length < 6) {
        lastRipple = now;
        ripples.push({ x: Math.random() * W, y: H * (0.72 + Math.random() * 0.24), r: 2, born: now });
      }
      ripples = ripples.filter(rp => now - rp.born < 1400);
      for (const rp of ripples) {
        const k = (now - rp.born) / 1400;
        c.strokeStyle = `rgba(180,200,235,${(0.22 * (1 - k)).toFixed(3)})`;
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(rp.x, rp.y, rp.r + k * 34, (rp.r + k * 34) * 0.32, 0, 0, Math.PI * 2);
        c.stroke();
      }
    }

    // 偶发流光（bokeh 场景：一颗亮斑快速划过，像远处车灯扫过）
    if (scene.particle === 'bokeh') {
      if (now - lastStreak > 5200 + Math.random() * 3000) {
        lastStreak = now;
        streaks.push({ x: -60, y: H * (0.15 + Math.random() * 0.6), spd: 6 + Math.random() * 5, born: now });
      }
      streaks = streaks.filter(st => st.x < W + 80);
      for (const st of streaks) {
        st.x += st.spd;
        const grad = c.createLinearGradient(st.x - 90, st.y, st.x, st.y);
        grad.addColorStop(0, 'rgba(255,210,150,0)');
        grad.addColorStop(1, 'rgba(255,220,170,.34)');
        c.fillStyle = grad;
        c.beginPath();
        c.ellipse(st.x, st.y, 90, 3.2, 0, 0, Math.PI * 2);
        c.fill();
      }
    }

    // 阳光光束（dust 场景：一道缓慢摇摆的斜向光带，浮尘在光里）
    if (scene.particle === 'dust') {
      const sway = Math.sin(now / 16000) * 0.06;
      c.save();
      c.translate(W * 0.62, H * 0.4);
      c.rotate(-0.42 + sway);
      const shaft = c.createLinearGradient(-W * 0.22, 0, W * 0.22, 0);
      shaft.addColorStop(0, 'rgba(255,250,230,0)');
      shaft.addColorStop(0.5, 'rgba(255,250,230,.14)');
      shaft.addColorStop(1, 'rgba(255,250,230,0)');
      c.fillStyle = shaft;
      c.fillRect(-W * 0.22, -H, W * 0.44, H * 2);
      c.restore();
    }

    // 整体呼吸：色温/亮度以约 20s 周期极轻振荡，画面"活着"
    const breath = 0.5 + Math.sin(now / 20000 * Math.PI * 2) * 0.5;
    c.fillStyle = dark
      ? `rgba(255,200,150,${(0.02 + breath * 0.03).toFixed(3)})`
      : `rgba(255,255,255,${(0.02 + breath * 0.04).toFixed(3)})`;
    c.fillRect(0, 0, W, H);

    // 胶片颗粒：每帧稀疏噪点，模拟电影质感（暗场亮点 / 亮场暗点）
    const grainN = 110;
    for (let i = 0; i < grainN; i++) {
      const gx = Math.random() * W, gy = Math.random() * H;
      const ga = Math.random() * 0.05;
      c.fillStyle = dark ? `rgba(255,255,255,${ga.toFixed(3)})` : `rgba(70,58,44,${ga.toFixed(3)})`;
      c.fillRect(gx, gy, dpr, dpr);
    }

    // 暗角（暗场压四边聚焦，亮场轻压）
    const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .42, W / 2, H / 2, Math.max(W, H) * .78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, dark ? 'rgba(0,0,0,.42)' : 'rgba(60,50,40,.16)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
  }

  /* ---------- 主循环（含叠化过渡） ---------- */
  function loop(now) {
    rafId = window.requestAnimationFrame(loop);
    const W = canvas.width, H = canvas.height;
    drawFrame(now, ctx, W, H);

    // 叠化：把上一场景快照盖在上面，逐渐透明
    if (transSnap) {
      const k = (now - transStart) / TRANS_MS;
      if (k >= 1) { transSnap = null; }
      else {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(transSnap, 0, 0, W, H);
        ctx.restore();
      }
    }
  }

  /* ---------- 入口 ---------- */
  function render(el, scenario) {
    if (canvas && canvas !== el) stop();
    const first = !canvas;
    canvas = el;
    dpr = window.devicePixelRatio || 1;
    resizeCanvas();
    if (!ctx) ctx = canvas.getContext('2d');

    // 切换前快照旧画面用于叠化
    if (!first && scene) {
      transSnap = document.createElement('canvas');
      transSnap.width = canvas.width; transSnap.height = canvas.height;
      transSnap.getContext('2d').drawImage(canvas, 0, 0);
      transStart = performance.now();
    }

    scene = resolve(scenario);
    buildParticles(canvas.width, canvas.height);
    buildMotifItems(canvas.width, canvas.height);

    // 异步加载并缓存当前场景的符号线稿图
    const newKey = scene.motif;
    const newTone = scene.tone;
    if (newKey && (newKey !== motifKey || newTone !== motifTone)) {
      motifKey = newKey; motifTone = newTone; motifImg = null;
      Motifs.loadImage(newKey, newTone).then(img => {
        if (scene && scene.motif === newKey && scene.tone === newTone) {
          motifImg = img;
          buildMotifItems(canvas.width, canvas.height);
        }
      }).catch(() => { /* 无图时不绘制符号层 */ });
    }

    if (!rafId) rafId = window.requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  }

  function stop() {
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
    canvas = null; ctx = null; scene = null; particles = []; ripples = []; streaks = []; transSnap = null;
    motifKey = null; motifTone = null; motifImg = null; motifItems = []; motifMini = [];
  }

  window.addEventListener('resize', () => {
    if (canvas) {
      resizeCanvas();
      buildParticles(canvas.width, canvas.height);
      buildMotifItems(canvas.width, canvas.height);
    }
  });

  /* ---------- 当前场景明暗（供 app 同步 UI 色调） ---------- */
  function tone() { return scene ? scene.tone : 'dark'; }

  return { render, stop, tone };
})();

window.SceneBackdrop = SceneBackdrop;
