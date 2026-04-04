/**
 * Type declarations for canvas-confetti
 * @see https://www.npmjs.com/package/canvas-confetti
 */
declare module 'canvas-confetti' {
  interface Options {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: Array<'square' | 'circle' | 'star'>;
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  interface ConfettiCannon {
    (options?: Options): Promise<null>;
    reset: () => void;
  }

  function confetti(options?: Options): Promise<null>;
  namespace confetti {
    function reset(): void;
    function create(
      canvas: HTMLCanvasElement,
      options?: { resize?: boolean; useWorker?: boolean }
    ): ConfettiCannon;
  }

  export = confetti;
}
