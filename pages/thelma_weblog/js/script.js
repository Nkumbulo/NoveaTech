/* ============================================================
   Thelma Ben Hair Atelier — site interactivity
   Split into clear sections so each feature is easy to find
   and edit independently.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initSmoothScroll();
  initJournalFilter();
  initTestimonialCarousel();
  initScrollReveal();
  initNewsletterForm();
  initExternalLinks();
});

/* ------------------------------------------------------------
   1. Mobile menu toggle (hamburger <-> X, slide-down panel)
   ------------------------------------------------------------ */
function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  const line1 = document.getElementById('menu-line-1');
  const line2 = document.getElementById('menu-line-2');
  if (!toggle || !menu) return;

  let open = false;

  function setOpen(next) {
    open = next;
    toggle.setAttribute('aria-expanded', String(open));

    menu.classList.toggle('menu-open', open);
    line1.classList.toggle('rotate-45', open);
    line1.classList.toggle('translate-y-[3.5px]', open);
    line2.classList.toggle('-rotate-45', open);
    line2.classList.toggle('-translate-y-[3.5px]', open);
  }

  toggle.addEventListener('click', () => setOpen(!open));

  // Close the menu whenever a link inside it is used to navigate
  menu.querySelectorAll('[data-scroll-target]').forEach((btn) => {
    btn.addEventListener('click', () => setOpen(false));
  });
}

/* ------------------------------------------------------------
   2. Smooth scroll for nav links / CTAs
   Any element with data-scroll-target="sectionId" will smooth
   scroll to that section. "top" scrolls to the very top.
   ------------------------------------------------------------ */
function initSmoothScroll() {
  document.querySelectorAll('[data-scroll-target]').forEach((el) => {
    el.addEventListener('click', () => {
      const targetId = el.getAttribute('data-scroll-target');

      if (targetId === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/* ------------------------------------------------------------
   3. Journal category filter
   Filter buttons carry data-filter="All | Bridal | ..."
   Article cards carry data-category="Bridal | ..."
   ------------------------------------------------------------ */
function initJournalFilter() {
  const filterBar = document.getElementById('journal-filters');
  const grid = document.getElementById('journal-grid');
  if (!filterBar || !grid) return;

  const buttons = filterBar.querySelectorAll('[data-filter]');
  const cards = grid.querySelectorAll('[data-category]');

  const ACTIVE = ['bg-[#1A1A1A]', 'text-[#FAF7F2]'];
  const INACTIVE = ['hover:bg-[#E8E0D6]/60', 'text-[#1A1A1A]/70'];

  function setActiveButton(activeBtn) {
    buttons.forEach((btn) => {
      const isActive = btn === activeBtn;
      ACTIVE.forEach((c) => btn.classList.toggle(c, isActive));
      INACTIVE.forEach((c) => btn.classList.toggle(c, !isActive));
    });
  }

  function applyFilter(category) {
    cards.forEach((card) => {
      const show = category === 'All' || card.getAttribute('data-category') === category;
      card.style.display = show ? '' : 'none';
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveButton(btn);
      applyFilter(btn.getAttribute('data-filter'));
    });
  });
}

/* ------------------------------------------------------------
   4. Testimonial carousel
   Edit the TESTIMONIALS array below to add/remove/change quotes.
   ------------------------------------------------------------ */
function initTestimonialCarousel() {
  const quoteEl = document.getElementById('testimonial-quote');
  const authorEl = document.getElementById('testimonial-author');
  const prevBtn = document.getElementById('testimonial-prev');
  const nextBtn = document.getElementById('testimonial-next');
  const dots = document.querySelectorAll('#testimonial-dots [data-dot]');
  if (!quoteEl || !authorEl) return;

  const TESTIMONIALS = [
    {
      quote: 'Thelma is the only stylist in Harare who told me to stop braiding. My edges returned in 4 months.',
      author: 'Chiedza M. — Harare',
    },
    {
      quote: 'Bridal hair that felt like couture, not costume. Pearls stayed put through a 14-hour day.',
      author: 'Tariro N. — Bridal, Dec 2025',
    },
    {
      quote: 'I flew in from London for a consultation. Clinical, calm, deeply knowledgeable.',
      author: 'Nandi K. — Virtual Client',
    },
  ];

  let index = 0;

  function render() {
    const t = TESTIMONIALS[index];
    quoteEl.textContent = t.quote;
    authorEl.textContent = t.author;

    dots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle('w-10', active);
      dot.classList.toggle('bg-[#C9A86A]', active);
      dot.classList.toggle('w-6', !active);
      dot.classList.toggle('bg-white/20', !active);
    });
  }

  function go(delta) {
    index = (index + delta + TESTIMONIALS.length) % TESTIMONIALS.length;
    render();
  }

  if (prevBtn) prevBtn.addEventListener('click', () => go(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => go(1));
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      index = i;
      render();
    });
  });
}

/* ------------------------------------------------------------
   5. Scroll reveal animation
   Any element with class="reveal" fades/rises into view the
   first time it enters the viewport. See .reveal / .reveal.in-view
   rules in styles.css.
   ------------------------------------------------------------ */
function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  if (!('IntersectionObserver' in window)) {
    // Fallback: just show everything
    revealEls.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach((el) => observer.observe(el));
}

/* ------------------------------------------------------------
   6. Newsletter signup form
   Currently just prevents a real page reload and shows a quick
   confirmation. Wire this up to your actual email provider
   (Mailchimp, ConvertKit, a backend endpoint, etc.) as needed.
   ------------------------------------------------------------ */
function initNewsletterForm() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const email = input ? input.value.trim() : '';
    if (!email) return;

    // TODO: replace with a real subscribe request to your email provider.
    const button = form.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.textContent = 'Subscribed ✓';
    button.disabled = true;
    input.value = '';

    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 3000);
  });
}

/* ------------------------------------------------------------
   7. External links open in a new tab
   Any <a href="..."> pointing to a different host gets
   target="_blank" + rel="noopener noreferrer".
   ------------------------------------------------------------ */
function initExternalLinks() {
  function markExternal(a) {
    const href = a.getAttribute('href');
    if (!href) return;
    try {
      const url = new URL(href, document.baseURI);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.host !== location.host) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    } catch (err) {
      /* ignore malformed URLs */
    }
  }

  document.querySelectorAll('a[href]').forEach(markExternal);
}
/* ============================================================
   Thelma Ben Hair Atelier — site interactivity (cleaned)
   Mobile-friendly enhancements
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initSmoothScroll();
  initJournalFilter();
  initTestimonialCarousel();
  initScrollReveal();
  initNewsletterForm();
  initExternalLinks();
  initReadingProgress();
});

// 1. Mobile menu toggle
function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  const line1 = document.getElementById('menu-line-1');
  const line2 = document.getElementById('menu-line-2');
  if (!toggle || !menu) return;

  let open = false;
  function setOpen(next) {
    open = next;
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('menu-open', open);
    if (line1) {
      line1.classList.toggle('rotate-45', open);
      line1.classList.toggle('translate-y-[3.5px]', open);
    }
    if (line2) {
      line2.classList.toggle('-rotate-45', open);
      line2.classList.toggle('-translate-y-[3.5px]', open);
    }
    document.body.style.overflow = open ? 'hidden' : '';
  }

  toggle.addEventListener('click', () => setOpen(!open));
  menu.querySelectorAll('[data-scroll-target]').forEach((btn) => {
    btn.addEventListener('click', () => setOpen(false));
  });
  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });
}

// 2. Smooth scroll
function initSmoothScroll() {
  document.querySelectorAll('[data-scroll-target]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const targetId = el.getAttribute('data-scroll-target');
      if (!targetId) return;
      if (targetId === 'top') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        const headerOffset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

// 3. Journal filter (defensive - only runs if elements exist)
function initJournalFilter() {
  const filterBar = document.getElementById('journal-filters');
  const grid = document.getElementById('journal-grid');
  if (!filterBar || !grid) return;

  const buttons = filterBar.querySelectorAll('[data-filter]');
  const cards = grid.querySelectorAll('[data-category]');

  function setActive(activeBtn) {
    buttons.forEach((btn) => {
      const isActive = btn === activeBtn;
      btn.classList.toggle('bg-[#1A1A1A]', isActive);
      btn.classList.toggle('text-[#FAF7F2]', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
  }

  function applyFilter(category) {
    cards.forEach((card) => {
      const show = category === 'All' || card.getAttribute('data-category') === category;
      card.style.display = show ? '' : 'none';
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActive(btn);
      applyFilter(btn.getAttribute('data-filter'));
    });
  });
}

// 4. Testimonial carousel
function initTestimonialCarousel() {
  const quoteEl = document.getElementById('testimonial-quote');
  const authorEl = document.getElementById('testimonial-author');
  const prevBtn = document.getElementById('testimonial-prev');
  const nextBtn = document.getElementById('testimonial-next');
  const dots = document.querySelectorAll('#testimonial-dots [data-dot]');
  if (!quoteEl || !authorEl) return;

  const TESTIMONIALS = [
    { quote: 'Thelma is the only stylist in Harare who told me to stop braiding. My edges returned in 4 months.', author: 'Chiedza M. — Harare' },
    { quote: 'Bridal hair that felt like couture, not costume. Pearls stayed put through a 14-hour day.', author: 'Tariro N. — Bridal, Dec 2025' },
    { quote: 'I flew in from London for a consultation. Clinical, calm, deeply knowledgeable.', author: 'Nandi K. — Virtual Client' },
  ];

  let index = 0;
  let timer;

  function render() {
    const t = TESTIMONIALS[index];
    quoteEl.textContent = t.quote;
    authorEl.textContent = t.author;
    dots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle('w-10', active);
      dot.classList.toggle('bg-[#C9A86A]', active);
      dot.classList.toggle('w-6', !active);
      dot.classList.toggle('bg-white/20', !active);
      dot.setAttribute('aria-selected', String(active));
    });
  }

  function go(delta) {
    index = (index + delta + TESTIMONIALS.length) % TESTIMONIALS.length;
    render();
    resetTimer();
  }

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => go(1), 6000);
  }

  if (prevBtn) prevBtn.addEventListener('click', () => go(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => go(1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => { index = i; render(); resetTimer(); }));
  resetTimer();
  render();
}

// 5. Scroll reveal
function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;
  if (!('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('in-view'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  revealEls.forEach((el) => observer.observe(el));
}

// 6. Newsletter
function initNewsletterForm() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const email = input ? input.value.trim() : '';
    if (!email) return;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    const originalText = button.textContent;
    button.textContent = 'Subscribed ✓';
    button.disabled = true;
    input.value = '';
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 3000);
  });
}

// 7. External links
function initExternalLinks() {
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    try {
      const url = new URL(href, document.baseURI);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.host !== location.host) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    } catch (err) {}
  });
}

// 8. Reading progress for article pages
function initReadingProgress() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  const onScroll = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
