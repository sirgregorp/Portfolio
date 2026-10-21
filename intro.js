/* Green paint intro (Canvas 2D — smooth on phones).
   A splat bursts to cover the screen, reacts to the pointer, then is consumed to reveal the page. */
(() => {
  const intro = document.getElementById('intro');
  const root = document.documentElement;
  if (!intro) { root.classList.remove('is-intro'); return; }

  const canvas = document.getElementById('introCanvas');
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  const splat = new Path2D(document.getElementById('splatPath').innerHTML.trim());
  const pctEl = document.getElementById('introPct');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;

  const INNER = 197;            // inscribed radius of the splat path, in its own units
  const MIN_SHOW = 2800;        // ms the paint stays before it is consumed
  const MAX_WAIT = 7000;        // never wait longer than this for slow assets
  const MAX_DROPS = touch ? 22 : 40;
  const MAX_TRAIL = touch ? 26 : 48;

  let W, H, cx, cy, coverScale, dpr, grad;
  function resize() {
    W = innerWidth; H = innerHeight; cx = W / 2; cy = H / 2;
    dpr = Math.min(devicePixelRatio || 1, touch ? 1.5 : 2);   // fewer pixels on phones
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    coverScale = (Math.hypot(W, H) / 2) / INNER * 1.08;
    grad = ctx.createRadialGradient(W * 0.45, H * 0.4, 0, W * 0.45, H * 0.4, Math.hypot(W, H) * 0.75);
    grad.addColorStop(0, '#E4FF6A'); grad.addColorStop(0.55, '#C6F432'); grad.addColorStop(1, '#9DD11E');
  }
  resize();
  addEventListener('resize', resize);

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOutBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const easeInBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // ---------- droplets ----------
  const drops = [];
  function burst(x, y, n, speed, rMin, rMax) {
    for (let i = 0; i < n && drops.length < MAX_DROPS; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rMin + Math.random() * (rMax - rMin), life: 1, decay: 0, g: 0 });
    }
  }

  // ---------- pointer trail (erases paint so the page peeks through) ----------
  const trail = [];
  function addPoint(x, y, r, decay) {
    trail.push({ x, y, r, decay });
    if (trail.length > MAX_TRAIL) trail.shift();
  }

  // ---------- state ----------
  let phase = 'in', t0 = performance.now(), last = t0, outStart = 0, rot = 0, outRot = 0, raf = 0;
  let loaded = false, minDone = false, wantOut = false;
  burst(cx, cy, reduce ? 0 : (touch ? 14 : 22), Math.max(W, H) * 0.035, 14, 46);
  requestAnimationFrame(() => intro.classList.add('is-in'));

  function frame(now) {
    // frame-rate independent motion (phones may run at 60 or 120 Hz, or drop frames)
    const dt = Math.min(3, (now - last) / 16.667); last = now;
    const t = (now - t0) / 1000;
    let s;
    if (phase === 'in') {
      const k = clamp(t / 0.95);
      s = coverScale * (reduce ? 1 : easeOutBack(k));
      rot = (1 - k) * -14;
      if (k >= 0.7 && !intro.classList.contains('is-covered')) intro.classList.add('is-covered');
      if (k >= 1) phase = 'hold';
    } else if (phase === 'hold') {
      s = coverScale * (1 + Math.sin(t * 2.2) * 0.012);
      rot = Math.sin(t * 0.7) * 1.5;
      if (wantOut && loaded && minDone) startOut(now);
    }
    if (phase === 'out') {
      const k = clamp((now - outStart) / (reduce ? 300 : 1250));
      s = coverScale * (1 - easeInBack(k));
      rot = outRot + easeOutCubic(k) * 28;
      if (k >= 1) { finish(); return; }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = grad;

    // While the splat fully covers the screen, a plain rect is far cheaper than the path.
    if (phase === 'hold' && s >= coverScale * 0.985) {
      ctx.fillRect(0, 0, W, H);
    } else if (s > 0.01) {
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180); ctx.scale(s, s);
      ctx.fill(splat);
      ctx.restore();
    }

    // droplets
    if (drops.length) {
      ctx.beginPath();
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        const f = Math.pow(0.94, dt);
        d.vx *= f; d.vy = d.vy * f + d.g * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        d.life -= d.decay * dt;
        if (d.life <= 0 || d.y > H + 120) { drops.splice(i, 1); continue; }
        const r = d.r * d.life;
        ctx.moveTo(d.x + r, d.y); ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // pointer trail: one smooth liquid stroke, erased out of the paint
    if (trail.length) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = trail.length - 1; i >= 0; i--) { trail[i].r -= trail[i].decay * dt; if (trail[i].r <= 0.5) trail.splice(i, 1); }
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        const q = trail[i + 1];
        if (q && Math.hypot(q.x - p.x, q.y - p.y) < 140) {
          ctx.lineWidth = Math.min(p.r, q.r) * 2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function startOut(now) {
    if (phase === 'out' || phase === 'done') return;
    phase = 'out'; outStart = now || performance.now(); outRot = rot;
    intro.classList.add('is-out');
    try { sessionStorage.setItem('gm-intro3', '1'); } catch (e) {}
    if (!reduce) {
      const n = touch ? 14 : 26;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, dist = Math.min(W, H) * (0.15 + Math.random() * 0.35);
        drops.push({ x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist, vx: Math.cos(a) * 2, vy: -2 - Math.random() * 3, r: 10 + Math.random() * 30, life: 1, decay: 0.012 + Math.random() * 0.01, g: 0.55 });
      }
    }
    setTimeout(() => root.classList.remove('is-intro'), 650);
  }
  function finish() {
    phase = 'done';
    cancelAnimationFrame(raf);
    intro.classList.add('is-done');
    cleanup();
    canvas.width = canvas.height = 0;   // free the canvas memory right away
    setTimeout(() => intro.remove(), 50);
  }

  // ---------- loading ----------
  let progress = 0;
  const show = (p) => { progress = Math.max(progress, Math.min(100, p)); pctEl.textContent = Math.round(progress); };
  const tasks = [];
  if (document.fonts && document.fonts.ready) tasks.push(document.fonts.ready);
  tasks.push(new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))));
  [...document.images].filter((i) => i.loading !== 'lazy').forEach((img) => tasks.push(img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); })));
  let done = 0;
  tasks.forEach((p) => p.then(() => { done++; show(20 + (done / tasks.length) * 80); }));
  const creep = setInterval(() => { if (progress < 92) show(progress + Math.max(0.8, (92 - progress) * 0.07)); }, 110);
  Promise.race([Promise.all(tasks), new Promise((r) => setTimeout(r, MAX_WAIT))]).then(() => { loaded = true; clearInterval(creep); show(100); wantOut = true; });
  setTimeout(() => { minDone = true; }, MIN_SHOW);

  // ---------- interaction (pointer events cover mouse, pen and touch) ----------
  let lastPt = 0;
  const onMove = (e) => {
    if (phase === 'out' || phase === 'done') return;
    const now = performance.now();
    if (now - lastPt < (touch ? 24 : 16)) return;
    lastPt = now;
    addPoint(e.clientX, e.clientY, (touch ? 44 : 38) + Math.random() * 14, 0.55);
  };
  const onDown = (e) => {
    if (phase === 'out' || phase === 'done') return;
    addPoint(e.clientX, e.clientY, 90, 0.9);
    burst(e.clientX, e.clientY, touch ? 5 : 7, 14, 8, 22);
  };
  const onWheel = (e) => { e.preventDefault(); wantOut = true; };
  const onKey = (e) => { if (['ArrowDown', 'PageDown', ' ', 'Enter', 'Escape'].includes(e.key)) { e.preventDefault(); wantOut = true; } };
  const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (phase !== 'done') { last = performance.now(); raf = requestAnimationFrame(frame); } };
  intro.addEventListener('pointermove', onMove, { passive: true });
  intro.addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVis);
  function cleanup() {
    removeEventListener('wheel', onWheel);
    removeEventListener('keydown', onKey);
    removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVis);
    clearInterval(creep);
  }
})();
