/*=========================================
NOVEATECH
MAIN JAVASCRIPT
=========================================*/


const isTouch = window.matchMedia("(hover:none), (pointer:coarse)").matches;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


// ================================
// MOBILE MENU
// ================================


const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector(".mobile-menu");


if (menuToggle && mobileMenu) {

    menuToggle.addEventListener("click", () => {

        menuToggle.classList.toggle("active");
        mobileMenu.classList.toggle("active");
        document.body.style.overflow = mobileMenu.classList.contains("active") ? "hidden" : "";

    });


    // CLOSE MENU WHEN A BUTTON/LINK IS CLICKED

    const mobileButtons = document.querySelectorAll(".mobile-grid button, .mobile-grid a");

    mobileButtons.forEach(button => {

        button.addEventListener("click", () => {

            menuToggle.classList.remove("active");
            mobileMenu.classList.remove("active");
            document.body.style.overflow = "";

        });

    });

}



// ================================
// NAVBAR GLASS EFFECT
// ================================


const header = document.querySelector(".header");


function updateHeader() {

    if (window.scrollY > 40) {

        header.classList.add("scrolled");
        header.style.background = "rgba(5,5,5,.75)";
        header.style.backdropFilter = "blur(20px)";
        header.style.borderBottom = "1px solid rgba(255,255,255,.08)";

    } else {

        header.classList.remove("scrolled");
        header.style.background = "transparent";
        header.style.backdropFilter = "none";
        header.style.borderBottom = "none";

    }

}


if (header) {

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

}



// ================================
// ACTIVE NAV LINK ON SCROLL
// ================================


const navAnchors = document.querySelectorAll(".desktop-menu a[href^='#']");
const sections = Array.from(navAnchors)
    .map(a => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);


function updateActiveLink() {

    let current = sections[0];

    sections.forEach(sec => {

        if (window.scrollY >= sec.offsetTop - 140) current = sec;

    });

    navAnchors.forEach(a => {

        a.classList.toggle("active", a.getAttribute("href") === "#" + current.id);

    });

}


if (sections.length) {

    updateActiveLink();
    window.addEventListener("scroll", updateActiveLink, { passive: true });

}



// ================================
// HERO CURSOR GLOW + TILT
// ================================


const hero = document.querySelector(".hero");
const heroGlow = document.querySelector(".hero-glow");


if (hero && heroGlow && !isTouch && !prefersReducedMotion) {

    hero.addEventListener("mousemove", (e) => {

        const rect = hero.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        heroGlow.style.left = x + "px";
        heroGlow.style.top = y + "px";
        heroGlow.style.opacity = "1";

    });

    hero.addEventListener("mouseleave", () => {

        heroGlow.style.opacity = "0";

    });

}



// ================================
// FLOATING PARTICLES (HERO)
// ================================


const particleField = document.querySelector(".hero-particles");


if (particleField && !prefersReducedMotion) {

    const count = isTouch ? 10 : 22;

    for (let i = 0; i < count; i++) {

        const p = document.createElement("span");
        p.className = "particle";

        const startX = Math.random() * 100;
        const startY = 60 + Math.random() * 40;
        const dx = (Math.random() - 0.5) * 120;
        const dy = -(120 + Math.random() * 160);
        const duration = 6 + Math.random() * 8;
        const delay = Math.random() * 8;

        p.style.left = startX + "%";
        p.style.top = startY + "%";
        p.style.setProperty("--dx", dx + "px");
        p.style.setProperty("--dy", dy + "px");
        p.style.animationDuration = duration + "s";
        p.style.animationDelay = delay + "s";

        particleField.appendChild(p);

    }

}



// ================================
// MAGNETIC BUTTONS
// ================================


const magnets = document.querySelectorAll(".primary-btn, .secondary-btn, .nav-cta");


magnets.forEach(btn => {

    btn.classList.add("magnetic");

    if (isTouch || prefersReducedMotion) return;

    btn.addEventListener("mousemove", (e) => {

        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.35 - 4}px)`;

    });

    btn.addEventListener("mouseleave", () => {

        btn.style.transform = "translate(0,0)";

    });

});



// ================================
// CARD TILT (SERVICES / WHY / PORTFOLIO)
// ================================


const tiltCards = document.querySelectorAll(".service-card, .why-card, .portfolio-card");


tiltCards.forEach(card => {

    card.classList.add("tilt");

    if (isTouch || prefersReducedMotion) return;

    card.addEventListener("mousemove", (e) => {

        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        const rotateX = Math.max(-2, Math.min(2, -y / 8));
        const rotateY = Math.max(-2, Math.min(2, x / 8));

        card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;

    });

    card.addEventListener("mouseleave", () => {

        card.style.transform = "";

    });

});



// ================================
// BACK TO TOP
// ================================


const backToTop = document.querySelector(".back-to-top");


if (backToTop) {

    window.addEventListener("scroll", () => {

        backToTop.classList.toggle("show", window.scrollY > 500);

    }, { passive: true });

    backToTop.addEventListener("click", () => {

        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });

    });

}



// ================================
// CONTACT FORM
// ================================


const contactForm = document.querySelector(".contact-form form, .contact-form");


if (contactForm && contactForm.tagName === "FORM") {

    contactForm.addEventListener("submit", (e) => {

        e.preventDefault();

        const btn = contactForm.querySelector("button");
        const original = btn.textContent;

        btn.textContent = "Message Sent ✓";
        btn.style.opacity = "0.85";

        setTimeout(() => {

            btn.textContent = original;
            btn.style.opacity = "1";
            contactForm.reset();

        }, 2400);

    });

}



const newsletterForm = document.querySelector(".newsletter-form");


if (newsletterForm) {

    newsletterForm.addEventListener("submit", (e) => {

        e.preventDefault();

        const btn = newsletterForm.querySelector("button");
        const original = btn.textContent;

        btn.textContent = "✓";

        setTimeout(() => {

            btn.textContent = original;
            newsletterForm.reset();

        }, 2000);

    });

}


/* =========================
   DIAGNOSTIC LIVE UPDATES
   ========================= */
(function(){
  const mainProgress = document.getElementById('mainProgress');
  const storeProgress = document.getElementById('storeProgress');
  const perfProgress = document.getElementById('perfProgress');
  const mainPercent = document.getElementById('mainPercent');
  const storePercent = document.getElementById('storePercent');
  const perfPercent = document.getElementById('perfPercent');
  const mainStatus = document.getElementById('mainStatus');
  const liveTime = document.getElementById('liveTime');

  if(!mainProgress) return;

  const mainCirc = 2 * Math.PI * 52; // 326.56
  const miniCirc = 2 * Math.PI * 32; // 201.06

  function setCircular(el, value, circ){
    const offset = circ - (value/100)*circ;
    el.style.strokeDashoffset = offset;
  }

  let battery = 87;
  let storage = 68;
  let perf = 94;
  let checks = [
    { bar: 'bar1', val: 'checkVal1', value: 100 },
    { bar: 'bar2', val: 'checkVal2', value: 92 },
    { bar: 'bar3', val: 'checkVal3', value: 88 },
    { bar: 'bar4', val: 'checkVal4', value: 76 },
    { bar: 'bar5', val: 'checkVal5', value: 68 },
  ];

  function updateTime(){
    if(liveTime){
      const now = new Date();
      liveTime.textContent = 'Live • ' + now.toLocaleTimeString('en-GB', {hour12:false});
    }
  }

  setInterval(updateTime, 1000);
  updateTime();

  function tick(){
    // battery drifts 84-91
    const drift = (Math.random()-0.5)*2.2;
    battery += drift;
    if(battery < 84) battery = 84 + Math.random()*0.8;
    if(battery > 91) battery = 91 - Math.random()*0.8;

    storage += (Math.random()-0.5)*1.2;
    storage = Math.min(78, Math.max(62, storage));

    perf += (Math.random()-0.5)*1;
    perf = Math.min(98, Math.max(89, perf));

    checks = checks.map((c, i)=>{
      if(i===0) return c;
      let v = c.value + (Math.random()-0.5)*3;
      if(i===1) v = Math.min(97, Math.max(88, v));
      else v = Math.min(100, Math.max(60, v));
      return {...c, value: v};
    });

    // apply
    setCircular(mainProgress, battery, mainCirc);
    setCircular(storeProgress, storage, miniCirc);
    setCircular(perfProgress, perf, miniCirc);

    if(mainPercent) mainPercent.textContent = Math.round(battery)+'%';
    if(storePercent) storePercent.textContent = Math.round(storage)+'%';
    if(perfPercent) perfPercent.textContent = Math.round(perf)+'%';
    if(mainStatus) mainStatus.textContent = battery>85 ? 'Excellent' : battery>78 ? 'Good' : 'Fair';

    checks.forEach(c=>{
      const barEl = document.getElementById(c.bar);
      const valEl = document.getElementById(c.val);
      if(barEl) barEl.style.width = c.value+'%';
      if(valEl) valEl.textContent = Math.round(c.value)+'%';
    });
  }

  setInterval(tick, 1200);

  setInterval(()=>{
    const target = 84 + Math.random()*7;
    battery = battery*0.7 + target*0.3;
  }, 2500);

  // init
  setCircular(mainProgress, battery, mainCirc);
  setCircular(storeProgress, storage, miniCirc);
  setCircular(perfProgress, perf, miniCirc);
})();
