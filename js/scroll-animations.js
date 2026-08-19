/* ============================================================
   SCROLL ANIMATION ENGINE
   Lightweight IntersectionObserver-based scroll reveals
   ============================================================ */
const ScrollAnimations = (function() {
  'use strict';

  const selectors = {
    reveal: '.scroll-reveal',
    staggerChildren: '.stagger-children',
    scale: '.scroll-scale',
    blur: '.scroll-blur',
    slideLeft: '.scroll-slide-left',
    slideRight: '.scroll-slide-right',
    counter: '.counter[data-count]',
    fadeInUp: '.fade-in-up',
      fadeInDown: '.fade-in-down',
      scaleIn: '.scale-in',
      revealOnScroll: '.reveal-on-scroll',
  };

  let observers = [];
  let parallaxElements = [];
  let countersAnimated = new Set();
  let prefersReducedMotion = false;
  let scrollProgress = null;

  let animationObserver, scaleObserver, counterObserver;

  function init() {
    // Check prefers-reduced-motion
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Make all elements immediately visible
      document.querySelectorAll([
        selectors.reveal,
        selectors.staggerChildren + ' > *',
        selectors.scale,
        selectors.blur,
        selectors.slideLeft,
        selectors.slideRight,
        selectors.fadeInUp,
        selectors.fadeInDown,
        selectors.scaleIn,
      ].join(', ')).forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.style.filter = 'none';
        el.style.transition = 'none';
      });
      document.querySelectorAll(selectors.staggerChildren).forEach(el => el.classList.add('is-visible'));
      return;
    }

    // Create scroll progress indicator
    createScrollProgress();

    // Initialize observers
    initAnimationObservers();
    initCounterObserver();

    // Scroll listener for parallax and progress
    let ticking = false;
    window.addEventListener('scroll', onScroll, { passive: true });

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateHeroParallax();
          updateScrollProgress();
          ticking = false;
        });
        ticking = true;
      }
    }
  }

  function updateHeroParallax() {
    const heroLayers = document.querySelectorAll('.hero-visual-layer');
    if (!heroLayers.length) return;
    const hero = document.getElementById('heroSection');
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const progress = Math.max(0, Math.min(1, -rect.top / rect.height));
    heroLayers.forEach(layer => {
      const speed = parseFloat(layer.dataset.parallaxSpeed) || 0;
      const maxShift = 30;
      const value = Math.max(-maxShift, Math.min(maxShift, progress * speed * 100));
      layer.style.transform = `translateY(${value}px)`;
    });
  }

  function createScrollProgress() {
    scrollProgress = document.createElement('div');
    scrollProgress.className = 'scroll-progress';
    document.body.appendChild(scrollProgress);
  }

  function updateScrollProgress() {
    if (!scrollProgress) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? scrollTop / docHeight : 0;
    scrollProgress.style.transform = `scaleX(${Math.min(progress, 1)})`;
  }

  function initAnimationObservers() {
    animationObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        } else {
          entry.target.classList.remove('is-visible');
        }
      });
    }, {
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.1,
    });

    scaleObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        } else {
          entry.target.classList.remove('is-visible');
        }
      });
    }, {
      rootMargin: '0px 0px -15% 0px',
      threshold: 0.1,
    });

    const regularAnimationSelectors = [
      selectors.reveal,
      selectors.staggerChildren,
      selectors.blur,
      selectors.slideLeft,
      selectors.slideRight,
      selectors.fadeInUp,
      selectors.fadeInDown,
      selectors.revealOnScroll,
     ].join(', ');

    const scaleAnimationSelectors = [
        selectors.scale,
        selectors.scaleIn
    ].join(', ');

    document.querySelectorAll(regularAnimationSelectors).forEach(el => animationObserver.observe(el));
    document.querySelectorAll(scaleAnimationSelectors).forEach(el => scaleObserver.observe(el));

    observers.push(animationObserver, scaleObserver);
  }

  function initCounterObserver() {
    counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !countersAnimated.has(entry.target)) {
          countersAnimated.add(entry.target);
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -20% 0px',
      threshold: 0.5,
    });

    document.querySelectorAll(selectors.counter).forEach(el => counterObserver.observe(el));
    observers.push(counterObserver);
  }

  function animateCounter(element) {
    const target = parseFloat(element.dataset.count);
    const duration = 2000;
    const startTime = performance.now();
    const isDecimal = target % 1 !== 0;
    const suffix = element.dataset.suffix || '';

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = target * eased;

      if (isDecimal) {
        element.textContent = current.toFixed(1) + suffix;
      } else {
        element.textContent = Math.floor(current).toLocaleString() + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = isDecimal ? target.toFixed(1) + suffix : target.toLocaleString() + suffix;
      }
    }

    requestAnimationFrame(updateCounter);
  }



  // Public API
  return {
    init,
    // For dynamically added content
    observe: (element) => {
      if (prefersReducedMotion || !element) return;

      const selectorsMap = [
        { selector: [selectors.reveal, selectors.staggerChildren, selectors.blur, selectors.slideLeft, selectors.slideRight, selectors.fadeInUp, selectors.fadeInDown].join(', '), observer: animationObserver },
        { selector: [selectors.scale, selectors.scaleIn].join(', '), observer: scaleObserver },
        { selector: selectors.counter, observer: counterObserver }
      ];

      selectorsMap.forEach(({ selector, observer }) => {
        if (!observer) return;
        if (element.matches(selector)) {
          observer.observe(element);
        }
        element.querySelectorAll(selector).forEach(el => {
          observer.observe(el);
        });
      });
    },
    destroy: () => {
      observers.forEach(obs => obs.disconnect());
      observers = [];
      if (scrollProgress) scrollProgress.remove();
      animationObserver = null;
      scaleObserver = null;
      counterObserver = null;
    }
  };
})();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ScrollAnimations.init);
} else {
  ScrollAnimations.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScrollAnimations;
}