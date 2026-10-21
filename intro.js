/* Green paint intro: a splat bursts to cover the screen, reacts to the pointer, then is consumed to reveal the page. */
(() => {
  const intro = document.getElementById('intro');
  const root = document.documentElement;
  if (!intro) { root.classList.remove('is-intro'); return; }

  const NS = 'http://www.w3.org/2000/svg';
  const splat = document.getElementById('splatUse');
  const dropsG = document.getElementById('drops');
  const holesG = document.getElementById('holes');
  const pctEl = document.getElementById('introPct');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const INNER = 197;            // inscribed radius of the splat shape, in its own path units
  const MIN_SHOW = 2800;        // ms the paint stays before it can be consumed
  const MAX_WAIT = 7000;        // never wait longer than this for slow assets
  let W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2;
  let coverScale = 1;
  const resize = () => {
    W = innerWidth; H = innerHeight; cx = W / 2; cy = H / 2;
    coverScale = (Math.hypot(W, H) / 2) / INNER * 1.08;
  };
  resize(); addEventListener('resize', resize);

  // ---------- easing ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOutBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const easeInBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // ---------- droplets (white in the mask = paint) ----------
  const drops = [];
  const mkCircle = (parent) => { const c = document.createElementNS(NS, 'circle'); parent.appendChild(c); return c; };
  function spawnBurst(x, y, n, speed, rMin, rMax) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      drops.push({ el: mkCircle(dropsG), x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rMin + Math.random() * (rMax - rMin), life: 1, decay: 0, g: 0 });
    }
  }

  // ---------- holes (black in the mask = page peeks through) ----------
  const holes = [];
  let lastHole = 0;
  function addHole(x, y, r, decay) {
    if (holes.length > 70) { const h = holes.shift(); h.el.remove(); }
    holes.push({ el: mkCircle(holesG), x, y, r, r0: r, decay });
  }

  // ---------- state machine ----------
  let phase = 'in';          // in -> hold -> out -> done
  let t0 = performance.now(), outStart = 0, rot = 0, outRot = 0;
  let loaded = false, minDone = false, wantOut = false;

  // Burst: paint flies out of the center as the splat lands.
  spawnBurst(cx, cy, reduce ? 0 : 22, Math.max(W, H) * 0.035, 14, 46);
  requestAnimationFrame(() => intro.classList.add('is-in'));

  function frame(now) {
    const t = (now - t0) / 1000;
    let s;
    if (phase === 'in') {
      const k = clamp(t / 0.95);
      s = coverScale * (reduce ? 1 : easeOutBack(k));
      rot = (1 - k) * -14;
      if (k >= 0.7 && !intro.classList.contains('is-covered')) intro.classList.add('is-covered');
      if (k >= 1) phase = 'hold';
    } else if (phase === 'hold') {
      s = coverScale * (1 + Math.sin(t * 2.2) * 0.012);   // the paint breathes
      rot = Math.sin(t * 0.7) * 1.5;
      if (wantOut && loaded && minDone) startOut(now);
    }
    if (phase === 'out') {
      const k = clamp((now - outStart) / (reduce ? 300 : 1250));
      s = coverScale * (1 - easeInBack(k));
      rot = outRot + easeOutCubic(k) * 28;
      if (k >= 1) finish();
    }
    if (phase === 'done') return;
    splat.setAttribute('transform', `translate(${cx} ${cy}) rotate(${rot.toFixed(2)}) scale(${Math.max(0, s).toFixed(2)})`);

    // droplets: fly, slow down, then (when consuming) fall and shrink
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vx *= 0.94; d.vy = d.vy * 0.94 + d.g;
      d.x += d.vx; d.y += d.vy;
      d.life -= d.decay;
      if (d.life <= 0 || d.y > H + 120) { d.el.remove(); drops.splice(i, 1); continue; }
      d.el.setAttribute('cx', d.x.toFixed(1)); d.el.setAttribute('cy', d.y.toFixed(1)); d.el.setAttribute('r', (d.r * d.life).toFixed(1));
    }
    // holes: close slowly behind the cursor
    for (let i = holes.length - 1; i >= 0; i--) {
      const h = holes[i];
      h.r -= h.decay;
      if (h.r <= 0.5) { h.el.remove(); holes.splice(i, 1); continue; }
      h.el.setAttribute('cx', h.x); h.el.setAttribute('cy', h.y); h.el.setAttribute('r', h.r.toFixed(1));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function startOut(now) {
    if (phase === 'out' || phase === 'done') return;
    phase = 'out'; outStart = now || performance.now(); outRot = rot;
    intro.classList.add('is-out');
    try { sessionStorage.setItem('gm-intro2', '1'); } catch (e) {}
    // Drips: paint runs off as the splat is consumed.
    if (!reduce) {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, dist = Math.min(W, H) * (0.15 + Math.random() * 0.35);
        drops.push({ el: mkCircle(dropsG), x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist, vx: Math.cos(a) * 2, vy: -2 - Math.random() * 3, r: 10 + Math.random() * 30, life: 1, decay: 0.012 + Math.random() * 0.01, g: 0.55 });
      }
    }
    // The hero starts its entrance while the paint is still pulling away.
    setTimeout(() => root.classList.remove('is-intro'), 650);
  }
  function finish() {
    phase = 'done';
    intro.classList.add('is-done');
    cleanup();
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

  // ---------- interaction ----------
  // Moving over the paint opens liquid holes that let the page peek through.
  const onMove = (e) => {
    if (phase === 'done' || phase === 'out') return;
    const p = e.touches ? e.touches[0] : e;
    const now = performance.now();
    if (now - lastHole < 16) return;
    lastHole = now;
    addHole(p.clientX, p.clientY, 38 + Math.random() * 16, 0.55);
  };
  // A click / tap splashes: a bigger hole plus green droplets.
  const onDown = (e) => {
    if (phase === 'done' || phase === 'out') return;
    const p = e.touches ? e.touches[0] : e;
    addHole(p.clientX, p.clientY, 90, 0.9);
    spawnBurst(p.clientX, p.clientY, 7, 14, 8, 22);
  };
  // Scrolling, a key, or a swipe asks to enter right away (once the page is ready).
  const onWheel = (e) => { e.preventDefault(); wantOut = true; };
  const onKey = (e) => { if (['ArrowDown', 'PageDown', ' ', 'Enter', 'Escape'].includes(e.key)) { e.preventDefault(); wantOut = true; } };
  intro.addEventListener('pointermove', onMove);
  intro.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
  intro.addEventListener('pointerdown', onDown);
  addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKey);
  function cleanup() {
    removeEventListener('wheel', onWheel);
    removeEventListener('keydown', onKey);
    removeEventListener('resize', resize);
    clearInterval(creep);
  }
})();
