/*=========================================
NOVEATECH
SCROLL + INTERACTION ANIMATIONS
=========================================*/


// ================================
// SCROLL REVEAL
// ================================


const revealTargets = document.querySelectorAll(
    ".reveal, .reveal-left, .reveal-right, .reveal-scale"
);


if (revealTargets.length) {

    const revealObserver = new IntersectionObserver((entries) => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                entry.target.classList.add("in");
                revealObserver.unobserve(entry.target);

            }

        });

    }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });

    revealTargets.forEach(el => revealObserver.observe(el));

}



// ================================
// PROCESS TRACK
// Scroll-linked progress line + step activation
// ================================

const processTrack = document.querySelector(".process-track");
const processFill = document.querySelector(".process-line-fill");
const processSteps = document.querySelectorAll(".process-step");

if (processTrack && processFill && processSteps.length) {

    const mobileQuery = window.matchMedia("(max-width: 700px)");
    const reduceMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Entrance reveal
    const processObserver = new IntersectionObserver((entries) => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                const i = [...processSteps].indexOf(entry.target);
                const delay = reduceMotion ? 0 : i * 90;

                setTimeout(() => {
                    entry.target.classList.add("in");
                }, delay);

                processObserver.unobserve(entry.target);
            }

        });

    }, {
        threshold: 0.15
    });

    processSteps.forEach(step => {
        processObserver.observe(step);
    });


    // ==========================================
    // SCROLL-LINKED PROCESS PROGRESS
    // ==========================================

    let processTicking = false;

    function updateProcessProgress() {

        const rect = processTrack.getBoundingClientRect();
        const vh = window.innerHeight;

        /*
         * IMPORTANT:
         * This does NOT create a separate scroll area.
         * Everything remains controlled by the main page scroll.
         */

        const start = vh * 0.75;
        const end = -rect.height * 0.15;

        const range = Math.max(start - end, 1);

        const progress = Math.min(
            Math.max(
                (start - rect.top) / range,
                0
            ),
            1
        );


        // Desktop
        if (!mobileQuery.matches) {

            processFill.style.height = "";

            processFill.style.width =
                (progress * 80) + "%";

        }

        // Mobile
        else {

            processFill.style.width = "";

            processFill.style.height =
                (progress * 100) + "%";
        }


        // Activate process steps
        const total = processSteps.length;

        processSteps.forEach((step, i) => {

            const threshold =
                (i + 0.5) / total - 0.1;

            step.classList.toggle(
                "active",
                progress >= threshold
            );

        });

    }


    // ==========================================
    // MAIN PAGE SCROLL ONLY
    // ==========================================

    function onProcessScroll() {

        if (processTicking) return;

        processTicking = true;

        requestAnimationFrame(() => {

            updateProcessProgress();

            processTicking = false;

        });

    }


    /*
     * Passive = the Process section can NEVER
     * block the browser's normal scrolling.
     */

    window.addEventListener(
        "scroll",
        onProcessScroll,
        { passive: true }
    );

    window.addEventListener(
        "resize",
        onProcessScroll,
        { passive: true }
    );


    // Initial state
    updateProcessProgress();

}


// ================================
// ANIMATED COUNTERS
// ================================


const counters = document.querySelectorAll(".count-up");


function animateCounter(el) {

    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || "";
    const decimals = el.dataset.target.includes(".") ? 1 : 0;
    const duration = 1800;
    const start = performance.now();

    function tick(now) {

        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = target * eased;

        el.textContent = value.toFixed(decimals) + suffix;

        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = target.toFixed(decimals) + suffix;

    }

    requestAnimationFrame(tick);

}


if (counters.length) {

    const counterObserver = new IntersectionObserver((entries) => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);

            }

        });

    }, { threshold: 0.6 });

    counters.forEach(el => counterObserver.observe(el));

}



// ================================
// FAQ ACCORDION
// ================================


const faqItems = document.querySelectorAll(".faq-item");


faqItems.forEach(item => {

    const question = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");

    question.addEventListener("click", () => {

        const isOpen = item.classList.contains("open");

        faqItems.forEach(other => {

            other.classList.remove("open");
            other.querySelector(".faq-answer").style.maxHeight = null;

        });

        if (!isOpen) {

            item.classList.add("open");
            answer.style.maxHeight = answer.scrollHeight + "px";

        }

    });

});



// ================================
// PORTFOLIO FILTER
// ================================


const filterButtons = document.querySelectorAll(".filter-btn");
const portfolioCards = document.querySelectorAll(".portfolio-card");


filterButtons.forEach(btn => {

    btn.addEventListener("click", () => {

        filterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const filter = btn.dataset.filter;

        portfolioCards.forEach(card => {

            const match = filter === "all" || card.dataset.category === filter;
            card.classList.toggle("hide", !match);

        });

    });

});