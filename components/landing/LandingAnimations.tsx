'use client';

import { useEffect } from 'react';

/**
 * LandingAnimations — mounts GSAP ScrollTrigger timelines for the landing page.
 * Dynamically imports GSAP to avoid SSR issues.
 * All selectors target data attributes or stable class names to avoid coupling.
 *
 * Safety guarantee: a 2500ms timeout clears all GSAP inline styles so content
 * is always visible even if rAF is throttled (background tab, slow device, etc).
 */

/** All data-attribute selectors that GSAP animates from opacity:0 */
const ANIMATED_SELECTORS = [
  '[data-hero-pill]',
  '[data-hero-content]',
  '[data-hero-image]',
  '[data-features-header]',
  '[data-feature-card]',
  '[data-how-header]',
  '[data-step-card]',
  '[data-stat-number]',
  '[data-stat-label]',
].join(',');

function clearGsapInlineStyles() {
  document.querySelectorAll<HTMLElement>(ANIMATED_SELECTORS).forEach((el) => {
    el.style.opacity = '';
    el.style.transform = '';
    el.style.visibility = '';
  });
}

export function LandingAnimations() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    // Safety net: if GSAP animations don't complete within 2.5s (throttled rAF,
    // slow dynamic imports, background tab), force all elements visible.
    const safetyTimer = setTimeout(clearGsapInlineStyles, 2500);

    async function init() {
      // Parallel imports — avoids 3 sequential round-trips on cold starts
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);

      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        // ── Hero: headline pill-reveal on load ──────────────────────────────
        const heroPills = gsap.utils.toArray<HTMLElement>('[data-hero-pill]');
        if (heroPills.length > 0) {
          gsap.from(heroPills, {
            yPercent: 110,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out',
            stagger: 0.15,
            delay: 0.2,
            clearProps: 'all',
          });
        }

        // Hero subtitle + CTA fade-up
        const heroContent = gsap.utils.toArray<HTMLElement>('[data-hero-content]');
        if (heroContent.length > 0) {
          gsap.from(heroContent, {
            y: 24,
            opacity: 0,
            duration: 0.7,
            ease: 'power2.out',
            stagger: 0.1,
            delay: 0.5,
            clearProps: 'all',
          });
        }

        // Hero image stretch-in
        const heroImage = document.querySelector<HTMLElement>('[data-hero-image]');
        if (heroImage) {
          gsap.from(heroImage, {
            scaleY: 0.92,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            delay: 0.1,
            clearProps: 'all',
          });
        }

        // ── Features: stagger cards on scroll ──────────────────────────────
        const featuresHeader = document.querySelector<HTMLElement>('[data-features-header]');
        if (featuresHeader) {
          gsap.from(featuresHeader, {
            scrollTrigger: {
              trigger: featuresHeader,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
            y: 32,
            opacity: 0,
            duration: 0.7,
            ease: 'power2.out',
            clearProps: 'all',
          });
        }

        const featureCards = gsap.utils.toArray<HTMLElement>('[data-feature-card]');
        if (featureCards.length > 0) {
          gsap.from(featureCards, {
            scrollTrigger: {
              trigger: featureCards[0],
              start: 'top 80%',
              toggleActions: 'play none none none',
            },
            y: 40,
            opacity: 0,
            duration: 0.6,
            ease: 'power2.out',
            stagger: 0.15,
            clearProps: 'all',
          });
        }

        // ── Stats: count-up on scroll ───────────────────────────────────────
        const statNumbers = gsap.utils.toArray<HTMLElement>('[data-stat-number]');
        statNumbers.forEach((el) => {
          const target = parseFloat(el.getAttribute('data-value') ?? el.textContent ?? '0');
          const isDecimal = target % 1 !== 0;
          const proxy = { value: 0 };
          gsap.fromTo(
            proxy,
            { value: 0 },
            {
              scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                toggleActions: 'play none none none',
              },
              value: target,
              duration: 1.8,
              ease: 'power2.out',
              onUpdate() {
                el.textContent = isDecimal
                  ? proxy.value.toFixed(1)
                  : Math.round(proxy.value).toString();
              },
            }
          );
        });

        const statLabels = gsap.utils.toArray<HTMLElement>('[data-stat-label]');
        if (statLabels.length > 0) {
          gsap.from(statLabels, {
            scrollTrigger: {
              trigger: statLabels[0],
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
            y: 16,
            opacity: 0,
            duration: 0.5,
            ease: 'power2.out',
            stagger: 0.1,
            clearProps: 'all',
          });
        }

        // ── How It Works: step cards stagger ───────────────────────────────
        const howHeader = document.querySelector<HTMLElement>('[data-how-header]');
        if (howHeader) {
          gsap.from(howHeader, {
            scrollTrigger: {
              trigger: howHeader,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
            y: 32,
            opacity: 0,
            duration: 0.7,
            ease: 'power2.out',
            clearProps: 'all',
          });
        }

        const stepCards = gsap.utils.toArray<HTMLElement>('[data-step-card]');
        if (stepCards.length > 0) {
          gsap.from(stepCards, {
            scrollTrigger: {
              trigger: stepCards[0],
              start: 'top 80%',
              toggleActions: 'play none none none',
            },
            y: 40,
            opacity: 0,
            duration: 0.6,
            ease: 'power2.out',
            stagger: 0.15,
            clearProps: 'all',
          });
        }
      });

      cleanup = () => ctx.revert();
    }

    init()
      .catch((err) => {
        // Init failed (e.g. import error) — cancel timer and force-clear immediately
        console.error('[LandingAnimations] GSAP init failed, clearing inline styles:', err);
        clearTimeout(safetyTimer);
        clearGsapInlineStyles();
      });
    // Note: do NOT cancel safetyTimer on success. init() resolves when GSAP *starts*
    // animations, not when they *finish*. The timer runs as a guaranteed fallback.

    return () => {
      clearTimeout(safetyTimer);
      cleanup?.();
    };
  }, []);

  // Renders nothing — pure side-effect component
  return null;
}
