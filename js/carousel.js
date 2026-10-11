/**
 * NoveaTech Carousel - ULTRA SMOOTH v3
 * Fixed: teleport jank, blur jank, perspective double, easing overshoot
 */

document.addEventListener('DOMContentLoaded', () => {
  const track = document.getElementById('noveaTrack');
  if (!track) return;
  const cards = Array.from(track.querySelectorAll('.nc-card'));
  const dotsContainer = document.getElementById('noveaDots');
  const prevBtn = document.querySelector('.nc-prev');
  const nextBtn = document.querySelector('.nc-next');
  const progressBar = document.getElementById('noveaProgress');
  if (!cards.length) return;

  let active = 0;
  let autoplayTimer = null;
  let resumeTimer = null;
  let isHovering = false;
  let prevOffsets = new Map(); // to detect teleport

  const AUTOPLAY_MS = 4000;
  const RESUME_DELAY = 2500;
  const DURATION = 650;

  function getGap() {
    const w = window.innerWidth;
    if (w < 480) return 180;
    if (w < 768) return 200;
    if (w < 1100) return 280;
    return 340;
  }

  function getWrappedOffset(index) {
    let offset = index - active;
    const total = cards.length;
    // minimal distance wrapping
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;
    return offset;
  }

  function render() {
    const gap = getGap();

    cards.forEach((card, i) => {
      const offset = getWrappedOffset(i);
      const abs = Math.abs(offset);
      const isCenter = offset === 0;

      const prev = prevOffsets.get(i);
      const willTeleport = prev !== undefined && Math.abs(offset - prev) > cards.length / 2;

      // If teleporting across the loop, kill transition for one frame
      if (willTeleport) {
        card.style.transition = 'none';
      }

      // Position
      const x = offset * gap;
      const y = isCenter ? -14 : 18 + abs * 4;
      const scale = isCenter ? 1 : Math.max(0.78, 0.84 - abs * 0.07);
      const rotY = offset * -8;
      const z = 30 - abs * 5;

      card.classList.toggle('center', isCenter);
      card.classList.toggle('side', !isCenter);
      card.style.zIndex = String(z);

      // PURE GPU TRANSFORM - no % inside, no perspective() inside
      // We use margin centering in CSS, so only translate3d + scale + rotate
      card.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotateY(${rotY}deg)`;

      // NO BLUR - blur is the #1 jank cause. Use opacity + brightness instead
      if (abs > 2) {
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';
        card.style.visibility = 'hidden';
      } else {
        card.style.visibility = 'visible';
        card.style.pointerEvents = isCenter ? '' : '';
        if (isCenter) {
          card.style.opacity = '1';
        } else {
          card.style.opacity = abs === 1 ? '0.68' : '0.35';
        }
      }

      // Restore transition after teleport frame
      if (willTeleport) {
        // force reflow
        void card.offsetHeight;
        card.style.transition = '';
      }

      prevOffsets.set(i, offset);
    });

    // dots
    if (dotsContainer) {
      [...dotsContainer.children].forEach((d, idx) => d.classList.toggle('active', idx === active));
    }

    restartProgress();
  }

  function restartProgress() {
    if (!progressBar) return;
    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!isHovering) {
          progressBar.style.transition = `width ${AUTOPLAY_MS}ms linear`;
          progressBar.style.width = '100%';
        }
      });
    });
  }

  function go(n) {
    active = (n + cards.length) % cards.length;
    render();
    resetAutoplay();
  }

  function resetAutoplay() {
    clearInterval(autoplayTimer);
    clearTimeout(resumeTimer);
    autoplayTimer = null;
    if (!isHovering) {
      autoplayTimer = setInterval(() => go(active + 1), AUTOPLAY_MS);
    }
    restartProgress();
  }

  function pause() {
    if (isHovering) return;
    isHovering = true;
    clearInterval(autoplayTimer);
    autoplayTimer = null;
    clearTimeout(resumeTimer);
    if (progressBar) {
      const cur = progressBar.getBoundingClientRect().width;
      const parent = progressBar.parentElement.getBoundingClientRect().width || 1;
      progressBar.style.transition = 'none';
      progressBar.style.width = `${(cur / parent) * 100}%`;
    }
  }

  function resume() {
    if (!isHovering) return;
    isHovering = false;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      resetAutoplay();
    }, RESUME_DELAY);
  }

  // init dots
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    cards.forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'nc-dot' + (i === 0 ? ' active' : '');
      b.setAttribute('aria-label', `Go to slide ${i + 1}`);
      b.addEventListener('click', () => go(i));
      dotsContainer.appendChild(b);
    });
  }

  // clicks
  cards.forEach((c, i) => c.addEventListener('click', (e) => {
    if (i !== active) go(i);
  }));
  prevBtn?.addEventListener('click', () => go(active - 1));
  nextBtn?.addEventListener('click', () => go(active + 1));

  track.addEventListener('mouseenter', pause);
  track.addEventListener('mouseleave', resume);

  // touch - simple swipe
  let sx = 0;
  track.addEventListener('touchstart', e => { sx = e.touches[0].clientX; pause(); }, {passive:true});
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) dx > 0 ? go(active - 1) : go(active + 1);
    isHovering = false;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => resetAutoplay(), RESUME_DELAY);
  }, {passive:true});

  // resize debounced
  let rT;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(render, 100);
  });

  // visibility
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(autoplayTimer);
    else resetAutoplay();
  });

  // initial
  render();
  resetAutoplay();
});
