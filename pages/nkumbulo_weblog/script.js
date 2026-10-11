// ===== Mobile menu toggle =====
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
const bar1 = document.getElementById('bar1');
const bar2 = document.getElementById('bar2');
let menuOpen = false;

function setMenu(open) {
  menuOpen = open;
  mobileMenu.style.maxHeight = open ? mobileMenu.scrollHeight + 'px' : '0px';
  bar1.style.transform = open ? 'rotate(45deg) translateY(3.5px)' : 'none';
  bar2.style.transform = open ? 'rotate(-45deg) translateY(-3.5px)' : 'none';
}

navToggle.addEventListener('click', () => setMenu(!menuOpen));
document.querySelectorAll('.mobile-link').forEach((a) => {
  a.addEventListener('click', () => setMenu(false));
});

// ===== Typewriter effect over role strings =====
const roles = [
  "Software Developer • Apple Technician",
  "SwiftUI • Web Designer",
  "Logic Board • Python • Microsoldering"
];
const typewriterEl = document.getElementById('typewriter');
let roleIndex = 0;

function typeRole() {
  const text = roles[roleIndex];
  let charIndex = 0;
  typewriterEl.textContent = '';
  const interval = setInterval(() => {
    charIndex++;
    typewriterEl.textContent = text.slice(0, charIndex);
    if (charIndex >= text.length) {
      clearInterval(interval);
      setTimeout(() => {
        roleIndex = (roleIndex + 1) % roles.length;
        typeRole();
      }, 2200);
    }
  }, 38);
}
typeRole();

// ===== Scroll parallax on hero visual =====
const heroVisual = document.getElementById('heroVisual');
window.addEventListener('scroll', () => {
  const parallax = window.scrollY * 0.12;
  heroVisual.style.transform = `translateY(${parallax * -0.35}px)`;
}, { passive: true });

// ===== Reveal-on-scroll for [data-reveal] elements =====
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('in-view');
  });
}, { threshold: 0.12 });
document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));

// ===== Animated stat counters =====
const statEls = document.querySelectorAll('.stat-num');
let statsAnimated = false;
const statsRow = document.getElementById('stats-row');

function animateStats() {
  statEls.forEach((el) => {
    const target = parseInt(el.dataset.value, 10);
    let current = 0;
    const step = target / 60;
    function tick() {
      current += step;
      if (current < target) {
        el.textContent = Math.floor(current);
        requestAnimationFrame(tick);
      } else {
        el.textContent = target;
      }
    }
    requestAnimationFrame(tick);
  });
}

if (statsRow) {
  const statsObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !statsAnimated) {
      statsAnimated = true;
      animateStats();
    }
  }, { threshold: 0.5 });
  statsObserver.observe(statsRow);
}

// ===== Footer year =====
document.getElementById('year').textContent = new Date().getFullYear();
