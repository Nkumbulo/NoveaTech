/*=========================================
NOVEATECH
TESTIMONIAL SLIDER
=========================================*/


(function () {

    const slidesWrap = document.querySelector(".testimonial-slides");
    const slides = document.querySelectorAll(".testimonial-slide");
    const dotsWrap = document.querySelector(".slider-dots");
    const prevBtn = document.querySelector(".slider-arrow.prev");
    const nextBtn = document.querySelector(".slider-arrow.next");

    if (!slidesWrap || !slides.length) return;

    let index = 0;
    let autoplayTimer = null;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // build dots

    slides.forEach((_, i) => {

        const dot = document.createElement("span");
        if (i === 0) dot.classList.add("active");
        dot.addEventListener("click", () => goTo(i));
        dotsWrap.appendChild(dot);

    });

    const dots = dotsWrap.querySelectorAll("span");


    function render() {

        slidesWrap.style.transform = `translateX(-${index * 100}%)`;

        dots.forEach((d, i) => d.classList.toggle("active", i === index));

    }


    function goTo(i) {

        index = (i + slides.length) % slides.length;
        render();
        restartAutoplay();

    }


    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }


    if (nextBtn) nextBtn.addEventListener("click", next);
    if (prevBtn) prevBtn.addEventListener("click", prev);


    function startAutoplay() {

        if (prefersReducedMotion) return;

        autoplayTimer = setInterval(next, 5500);

    }

    function restartAutoplay() {

        clearInterval(autoplayTimer);
        startAutoplay();

    }


    // touch swipe

    let touchStartX = 0;

    slidesWrap.addEventListener("touchstart", (e) => {

        touchStartX = e.touches[0].clientX;
        clearInterval(autoplayTimer);

    }, { passive: true });

    slidesWrap.addEventListener("touchend", (e) => {

        const diff = e.changedTouches[0].clientX - touchStartX;

        if (diff > 50) prev();
        else if (diff < -50) next();
        else restartAutoplay();

        startAutoplay();

    }, { passive: true });


    render();
    startAutoplay();

})();
