/* Paint intro: covers the screen while the page loads, then dissolves on the first scroll / swipe / key / click. */
(() => {
  const intro = document.getElementById('intro');
  const root = document.documentElement;
  if (!intro) { root.classList.remove('is-intro'); return; }

  const bar = document.getElementById('introBar');
  const pct = document.getElementById('introPct');
  const enter = document.getElementById('introEnter');
  const MIN_SHOW = 2300;      // let the paint finish before inviting the visitor in
  const AUTO_EXIT = 9000;     // after the page is ready, don't trap anyone who never scrolls
  const started = performance.now();
  let progress = 0, ready = false, leaving = false, autoTimer = 0;

  const setProgress = (p) => {
    progress = Math.max(progress, Math.min(100, p));
    bar.style.width = progress + '%';
    pct.textContent = Math.round(progress) + '%';
  };

  // Real loading signals: fonts, stylesheet, above-the-fold images, window load.
  const tasks = [];
  if (document.fonts && document.fonts.ready) tasks.push(document.fonts.ready);
  tasks.push(new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))));
  const imgs = [...document.images].filter((i) => !i.closest('.intro') && i.loading !== 'lazy');
  imgs.forEach((img) => tasks.push(img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); })));
  let done = 0;
  tasks.forEach((t) => t.then(() => { done++; setProgress(15 + (done / tasks.length) * 85); }));

  // Smooth "creep" so the bar always moves, even while waiting on the network.
  const creep = setInterval(() => { if (progress < 90) setProgress(progress + Math.max(0.6, (90 - progress) * 0.06)); }, 120);

  const hardTimeout = new Promise((r) => setTimeout(r, 8000)); // never wait forever on a slow asset
  Promise.race([Promise.all(tasks), hardTimeout]).then(() => {
    const wait = Math.max(0, MIN_SHOW - (performance.now() - started));
    setTimeout(() => {
      clearInterval(creep);
      setProgress(100);
      ready = true;
      intro.classList.add('is-ready');
      enter.tabIndex = 0;
      autoTimer = setTimeout(leave, AUTO_EXIT);
    }, wait);
  });

  function leave() {
    if (!ready || leaving) return;
    leaving = true;
    clearTimeout(autoTimer);
    try { sessionStorage.setItem('gm-intro', '1'); } catch (e) {}
    intro.classList.add('is-leaving');
    window.scrollTo(0, 0);
    // Let the hero's own entrance play as the paint pulls away.
    setTimeout(() => root.classList.remove('is-intro'), 450);
    setTimeout(() => { intro.remove(); cleanup(); }, 1600);
  }

  // The first gesture enters the site instead of scrolling it.
  const onWheel = (e) => { e.preventDefault(); if (Math.abs(e.deltaY) > 2 || Math.abs(e.deltaX) > 2) leave(); };
  let touchY = null;
  const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
  const onTouchMove = (e) => { e.preventDefault(); if (touchY !== null && Math.abs(e.touches[0].clientY - touchY) > 24) leave(); };
  const onKey = (e) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Spacebar', 'Enter', 'Home', 'End'].includes(e.key)) { e.preventDefault(); leave(); }
  };
  const onClick = () => leave();

  addEventListener('wheel', onWheel, { passive: false });
  intro.addEventListener('touchstart', onTouchStart, { passive: true });
  intro.addEventListener('touchmove', onTouchMove, { passive: false });
  addEventListener('keydown', onKey);
  intro.addEventListener('click', onClick);

  function cleanup() {
    removeEventListener('wheel', onWheel);
    removeEventListener('keydown', onKey);
    clearInterval(creep);
  }
})();
