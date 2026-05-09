---
version: alpha
name: RestoreAssist Motion
description: Motion identity for RestoreAssist — paired with ra.design.md (visual) and ra.ts (runtime). Sweep signature; expo curves; field-instrument cadence (decisive, no decoration).
fps: 30
durations:
  fast: 8
  base: 18
  slow: 36
  hero: 24
  exit: 12
easings:
  expo-out:
    bezier: "cubic-bezier(0.22, 1, 0.36, 1)"
    use: "default entry"
  expo-in:
    bezier: "cubic-bezier(0.64, 0, 0.78, 0)"
    use: "default exit"
  expo-in-out:
    bezier: "cubic-bezier(0.83, 0, 0.17, 1)"
    use: "scene transitions"
  field-snap:
    bezier: "cubic-bezier(0.34, 1.2, 0.64, 1)"
    use: "data-readout reveals (slight overshoot)"
signature:
  name: sweep
  axis: x
  amplitude: 200px
  duration: "{durations.base}"
  easing: "{easings.expo-out}"
  description: "Horizontal left-to-right reveal. Decisive single-pass. No bounce, no overshoot — this is field-instrument motion, not consumer."
choreography:
  hero-stack:
    description: "Display headline → kicker → CTA. Each element waits for the previous."
    sequence:
      - target: "headline"
        start: 0
        motion: signature
      - target: "kicker"
        start: "{durations.fast}"
        motion: signature
      - target: "cta"
        start: "{durations.base}"
        motion: signature
  data-grid:
    description: "Mono identifiers (NIR codes) reveal in a stagger."
    stagger: 4
    motion: field-snap
spring:
  default:
    damping: 14
    stiffness: 140
    mass: 0.8
  hero:
    damping: 18
    stiffness: 180
    mass: 1.0
gsap:
  scrollTrigger:
    start: "top 80%"
    end: "bottom 20%"
    scrub: false
    markers: false
loops:
  pulse-cta:
    description: "Subtle CTA pulse for static page (web only, never video)."
    duration: "{durations.slow}"
    repeat: -1
    yoyo: true
    easing: "{easings.expo-in-out}"
performance:
  maxConcurrentAnimations: 6
  preferTransform: true
  prefersReducedMotion: respect
---

## Overview

RestoreAssist motion reads like a field-instrument readout — decisive, single-pass, no decoration. Sweep is the signature: horizontal left-to-right reveal at base 18 frames @ 30fps. Slight overshoot only on data-readouts (NIR codes, timestamps) where the `field-snap` curve adds a 1.2 amplitude hint of physical click.

No bounce on hero motion. No spring on body type. No loops in video output. Loops only exist for static web (subtle CTA pulse) and respect `prefers-reduced-motion`.

## Signature: sweep

The brand owns one motion. Every entry uses sweep unless there's a documented reason. New scenes default to `signature` and only override when the choreography demands it.

## Choreography

**hero-stack** — three-element stack revealing in sequence (headline → kicker → CTA), each waiting for the previous to complete its first 8 frames before starting. Used for opening title cards.

**data-grid** — NIR identifiers / inspection codes reveal in a 4-frame stagger using `field-snap` (the only place the slight overshoot appears). Used in evidence panels.

## Spring

Two presets: `default` (UI affordances, hover states) and `hero` (occasional dramatic reveal — e.g. final NIR verdict card). Mass 1.0 on hero gives a heftier landing.

## GSAP scroll defaults

For web pages built from this brand, scroll-triggered motion uses `top 80% → bottom 20%` window without scrub (motion completes in one pass on enter). Pin only on long-form NIR explainers.

## Do's and Don'ts

**Do:** lead every scene with sweep. Reserve `field-snap` for data. Respect reduced-motion.
**Don't:** never use bounce or elastic curves. Never loop motion in video. Never combine signatures in one scene.
