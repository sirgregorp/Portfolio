(() => {
  let SITE = { projects: [] };
  try { SITE = JSON.parse(document.getElementById('site-data').textContent); } catch (e) {}
  const ALL = Array.isArray(SITE.projects) ? SITE.projects : [];
  const PROJECTS = ALL.filter((p) => !p.hidden);
  window.GM = { SITE, ALL };
  // Stat: projects from the newest year shown
  (function () {
    const yrs = PROJECTS.map((p) => +p.year || 0); const top = Math.max(0, ...yrs);
    const el = document.querySelector('[data-stat="yearcount"]'); const lab = document.querySelector('[data-stat="yearlabel"]');
    if (el && top) { el.dataset.count = String(yrs.filter((y) => y === top).length); }
    if (lab && top) { lab.dataset.es = 'proyectos nuevos en ' + top; lab.dataset.en = 'new projects in ' + top; }
  })();

  let lang = 'es';
  try { lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('gm-lang') || (navigator.language || 'es').slice(0, 2); } catch (e) {}
  if (lang !== 'en') lang = 'es';

  const grid = document.getElementById('grid');
  const t = (o) => (o && (o[lang] || o.es)) || '';

  function renderGrid() {
    grid.innerHTML = '';
    PROJECTS.forEach((p) => {
      const card = document.createElement('button');
      card.type = 'button';
      const size = p.size || (p.full ? 'full' : p.wide ? 'wide' : p.half ? 'half' : 'normal');
      card.className = 'card reveal' + (size !== 'normal' ? ' ' + size : '') + (p.contain ? ' contain' : '');
      card.dataset.cat = p.cat.join(' ');
      card.dataset.id = p.id;
      card.setAttribute('aria-label', t(p.title));
      const media = document.createElement('span');
      media.className = 'card-media';
      const img = document.createElement('img');
      img.src = p.cover; img.alt = ''; img.loading = 'lazy';
      media.appendChild(img);
      if (p.video) {
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
        v.src = p.video;
        media.appendChild(v);
      }
      const badge = document.createElement('span');
      badge.className = 'card-badge';
      badge.innerHTML = (p.video ? '<span class="play">▶ Video</span>' : '') + `<span>${t(p.tag)}</span>`;
      media.appendChild(badge);
      const info = document.createElement('span');
      info.className = 'card-info';
      info.innerHTML = `<span><span class="card-title"></span><span class="card-desc"></span></span><span class="yr">${p.year}</span>`;
      info.querySelector('.card-title').textContent = t(p.title);
      info.querySelector('.card-desc').textContent = t(p.desc).split('. ')[0].replace(/\.$/, '') + '.';
      card.append(media, info);
      grid.appendChild(card);
    });
    applyFilter(currentFilter);
    observeReveals();
  }

  // Filters
  let currentFilter = 'all';
  function applyFilter(f) {
    currentFilter = f;
    grid.querySelectorAll('.card').forEach((c) => {
      c.classList.toggle('is-hidden', f !== 'all' && !c.dataset.cat.includes(f));
    });
  }
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      applyFilter(chip.dataset.filter);
    });
  });

  // Hover video preview
  const canHover = matchMedia('(hover:hover)').matches;
  grid.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.card'); if (!card) return;
    const v = card.querySelector('video'); if (v) { v.play().catch(() => {}); }
  });
  grid.addEventListener('mouseout', (e) => {
    const card = e.target.closest('.card'); if (!card || card.contains(e.relatedTarget)) return;
    const v = card.querySelector('video'); if (v) { v.pause(); }
  });
  // On touch devices, autoplay the preview when the card is on screen
  if (!canHover && 'IntersectionObserver' in window) {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const v = en.target.querySelector('video'); if (!v) return;
        if (en.isIntersecting) { en.target.classList.add('is-playing'); v.play().catch(() => {}); }
        else { en.target.classList.remove('is-playing'); v.pause(); }
      });
    }, { threshold: 0.6 });
    const watch = () => grid.querySelectorAll('.card').forEach((c) => vio.observe(c));
    const mo = new MutationObserver(watch); mo.observe(grid, { childList: true }); watch();
  }

  // Modal
  const modal = document.getElementById('modal');
  const mMedia = document.getElementById('modalMedia');
  const ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
    vol: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5M5 4.5V9h4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const L = (es, en) => (lang === 'en' ? en : es);
  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function buildPlayer(p) {
    const wrap = document.createElement('div');
    wrap.className = 'player is-paused' + (p.vertical ? ' is-vertical' : '');
    wrap.innerHTML = `
      <video playsinline preload="auto"></video>
      <button class="player-big" type="button"></button>
      <div class="player-bar">
        <button class="pbtn p-play" type="button"></button>
        <span class="p-time mono"><span class="p-cur">0:00</span> / <span class="p-dur">0:00</span></span>
        <input class="p-seek" type="range" min="0" max="1000" step="1" value="0">
        <button class="pbtn p-mute" type="button"></button>
        <button class="pbtn p-full" type="button"></button>
      </div>`;
    const v = wrap.querySelector('video');
    v.src = p.video; if (p.poster) v.poster = p.poster;
    const big = wrap.querySelector('.player-big'), play = wrap.querySelector('.p-play'), mute = wrap.querySelector('.p-mute'),
      full = wrap.querySelector('.p-full'), seek = wrap.querySelector('.p-seek'), cur = wrap.querySelector('.p-cur'), dur = wrap.querySelector('.p-dur');
    const label = () => {
      const paused = v.paused;
      wrap.classList.toggle('is-paused', paused);
      play.innerHTML = paused ? (v.ended ? ICONS.replay : ICONS.play) : ICONS.pause;
      play.setAttribute('aria-label', paused ? L('Reproducir', 'Play') : L('Pausar', 'Pause'));
      big.innerHTML = v.ended ? ICONS.replay : ICONS.play;
      big.setAttribute('aria-label', v.ended ? L('Repetir', 'Replay') : L('Reproducir', 'Play'));
      mute.innerHTML = v.muted ? ICONS.mute : ICONS.vol;
      mute.setAttribute('aria-label', v.muted ? L('Activar sonido', 'Unmute') : L('Silenciar', 'Mute'));
      full.innerHTML = ICONS.full; full.setAttribute('aria-label', L('Pantalla completa', 'Full screen'));
      seek.setAttribute('aria-label', L('Línea de tiempo', 'Timeline'));
    };
    const toggle = () => { if (v.paused) v.play().catch(() => { v.muted = true; v.play().catch(() => {}); label(); }); else v.pause(); };
    const paint = () => {
      const d = v.duration || 0, pct = d ? (v.currentTime / d) * 100 : 0;
      if (!seeking) seek.value = Math.round(pct * 10);
      seek.style.setProperty('--p', pct + '%');
      cur.textContent = fmt(v.currentTime); dur.textContent = fmt(d);
    };
    let seeking = false;
    big.addEventListener('click', toggle); play.addEventListener('click', toggle);
    v.addEventListener('click', toggle);
    mute.addEventListener('click', () => { v.muted = !v.muted; label(); });
    full.addEventListener('click', () => {
      const el = wrap;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    });
    seek.addEventListener('input', () => { seeking = true; const d = v.duration || 0; v.currentTime = (seek.value / 1000) * d; seek.style.setProperty('--p', seek.value / 10 + '%'); cur.textContent = fmt(v.currentTime); });
    seek.addEventListener('change', () => { seeking = false; });
    ['play', 'pause', 'ended', 'volumechange'].forEach((ev) => v.addEventListener(ev, label));
    ['timeupdate', 'loadedmetadata', 'durationchange'].forEach((ev) => v.addEventListener(ev, paint));
    wrap.addEventListener('keydown', (e) => {
      if (e.target === seek) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
      else if (e.key === 'm') { v.muted = !v.muted; label(); }
    });
    label();
    // Try to autoplay with sound; browsers that block it get muted autoplay.
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); label(); });
    return wrap;
  }

  function openProject(p) {
    mMedia.querySelectorAll('video').forEach((v) => v.pause());
    mMedia.innerHTML = '';
    modal.style.setProperty('--acc', p.accent || 'var(--accent)');
    if (p.video) mMedia.appendChild(buildPlayer(p));
    (p.gallery || []).forEach((src, i) => {
      const im = document.createElement('img');
      im.src = src; im.alt = t(p.title) + ' — ' + L('imagen', 'image') + ' ' + (i + 1); im.loading = 'lazy'; im.decoding = 'async';
      mMedia.appendChild(im);
    });
    mMedia.scrollTop = 0;
    document.getElementById('modalTag').textContent = t(p.tag);
    document.getElementById('modalTitle').textContent = t(p.title);
    document.getElementById('modalDesc').textContent = t(p.desc);
    const meta = document.getElementById('modalMeta'); meta.innerHTML = '';
    (p.meta ? t(p.meta) : []).forEach(([k, val]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = val;
      meta.append(dt, dd);
    });
    const link = document.getElementById('modalLink');
    if (p.link) { link.hidden = false; link.href = p.link; link.textContent = L('Ver sitio web ↗', 'Visit website ↗'); }
    else link.hidden = true;
    document.body.classList.add('modal-open');
    if (typeof modal.showModal === 'function') { if (!modal.open) modal.showModal(); } else modal.setAttribute('open', '');
    mMedia.scrollTop = 0;
  }
  function closeModal() {
    mMedia.querySelectorAll('video').forEach((v) => v.pause());
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    modal.close ? modal.close() : modal.removeAttribute('open');
  }
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card'); if (!card) return;
    openProject(PROJECTS.find((p) => p.id === card.dataset.id));
  });
  document.getElementById('modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  modal.addEventListener('close', () => {
    mMedia.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
    document.body.classList.remove('modal-open');
  });

  // Custom cursor over cards
  const cursor = document.getElementById('cursor');
  if (canHover) {
    let x = 0, y = 0, cx = 0, cy = 0;
    addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; });
    (function loop() { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; cursor.style.transform = `translate(${cx}px,${cy}px) scale(${cursor.classList.contains('on') ? 1 : 0})`; requestAnimationFrame(loop); })();
    grid.addEventListener('mouseover', (e) => { if (e.target.closest('.card')) cursor.classList.add('on'); });
    grid.addEventListener('mouseleave', () => cursor.classList.remove('on'));
    grid.addEventListener('mouseout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.card')) cursor.classList.remove('on'); });
  }

  // Reveal on scroll
  let io;
  function observeReveals() {
    if (!('IntersectionObserver' in window)) { document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')); return; }
    io = io || new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal:not(.in)').forEach((el, i) => { el.style.transitionDelay = (i % 3) * 80 + 'ms'; io.observe(el); });
  }

  // Counters
  const counters = document.querySelectorAll('[data-count]');
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target, end = +el.dataset.count, t0 = performance.now();
      (function tick(now) { const p = Math.min((now - t0) / 1200, 1); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0);
      cio.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach((c) => cio.observe(c));

  // Nav background
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 20);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Language
  function setLang(l) {
    lang = l;
    document.documentElement.lang = l;
    try { localStorage.setItem('gm-lang', l); } catch (e) {}
    document.querySelectorAll('[data-es]').forEach((el) => { el.textContent = el.dataset[l]; });
    document.getElementById('modalClose').setAttribute('aria-label', l === 'en' ? 'Close' : 'Cerrar');
    document.querySelectorAll('.lang [data-l]').forEach((s) => s.classList.toggle('on', s.dataset.l === l));
    renderGrid();
  }
  document.getElementById('langBtn').addEventListener('click', () => setLang(lang === 'es' ? 'en' : 'es'));
  setLang(lang);
})();
