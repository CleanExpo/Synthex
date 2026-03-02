'use client';

import { useEffect } from 'react';

/**
 * LandingAnimations — mounts GSAP ScrollTrigger timelines for the landing page.
 * Dynamically imports GSAP to avoid SSR issues.
 * All selectors target data attributes or stable class names to avoid coupling.
 */
export function LandingAnimations() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init() {
      const { default: gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      const { SplitText } = await import('gsap/SplitText');

      gsap.registerPlugin(ScrollTrigger, SplitText);

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
          });
        }
      });

      cleanup = () => ctx.revert();
    }

    init().catch(console.error);

    return () => cleanup?.();
  }, []);

  // Renders nothing — pure side-effect component
  return null;
}
