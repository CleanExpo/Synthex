'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="w-full h-screen bg-[#080e1a] overflow-x-hidden flex justify-center items-center relative">
      <MessageDisplay />
      <CircleAnimation />
    </div>
  );
}

// 1. Message Display
function MessageDisplay() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute flex flex-col justify-center items-center w-[90%] h-[90%] z-[100]">
      <div
        className={`flex flex-col items-center transition-opacity duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="text-[22px] font-semibold text-white/60 m-[1%] tracking-wider uppercase">
          Page Not Found
        </div>
        <div className="text-[80px] font-bold text-white m-[1%] leading-none">
          404
        </div>
        <div className="text-[14px] w-1/2 min-w-[280px] text-center text-white/40 m-[1%]">
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </div>

        <div className="flex gap-4 mt-8">
          <Link
            href="javascript:history.back()"
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white/60 border-[0.5px] border-white/[0.06] rounded-sm hover:bg-white/[0.04] hover:text-white transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-orange-500/[0.08] border-[0.5px] border-orange-500/20 rounded-sm hover:bg-orange-500/[0.15] transition-all duration-200"
          >
            <Home className="w-4 h-4 text-orange-400" />
            Dashboard
          </Link>
        </div>

        {/* Back to home */}
        <div className="mt-10 pt-6 border-t border-white/[0.06] w-64 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Synthex
          </Link>

          {/* Public navigation */}
          <p className="text-xs text-white/40 mb-3">Pages</p>
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            <Link
              href="/pricing"
              className="text-orange-400 hover:text-orange-300 text-xs transition-colors"
            >
              Pricing
            </Link>
            <span className="text-white/50">•</span>
            <Link
              href="/contact"
              className="text-orange-400 hover:text-orange-300 text-xs transition-colors"
            >
              Contact
            </Link>
            <span className="text-white/50">•</span>
            <Link
              href="/dashboard"
              className="text-orange-400 hover:text-orange-300 text-xs transition-colors"
            >
              Dashboard
            </Link>
          </div>

          {/* Dashboard quick links */}
          <p className="text-xs text-white/40 mb-3">Dashboard</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              href="/dashboard/content"
              className="text-orange-400 hover:text-orange-300 text-xs transition-colors"
            >
              Content
            </Link>
            <span className="text-white/50">•</span>
            <Link
              href="/dashboard/analytics"
              className="text-orange-400 hover:text-orange-300 text-xs transition-colors"
            >
              Analytics
            </Link>
            <span className="text-white/50">•</span>
            <Link
              href="/dashboard/schedule"
              className="text-orange-400 hover:text-orange-300 text-xs transition-colors"
            >
              Schedule
            </Link>
            <span className="text-white/50">•</span>
            <Link
              href="/dashboard/settings"
              className="text-orange-400 hover:text-orange-300 text-xs transition-colors"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. Circle / particle animation on canvas
interface Particle {
  x: number;
  y: number;
  size: number;
}

function CircleAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestIdRef = useRef<number | undefined>(undefined);
  const timerRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);

  const initParticles = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    particlesRef.current = [];
    for (let i = 0; i < 300; i++) {
      const randomX =
        Math.floor(
          Math.random() * (canvas.width * 3 - canvas.width * 1.2 + 1)
        ) +
        canvas.width * 1.2;
      const randomY =
        Math.floor(Math.random() * (canvas.height - canvas.height * -0.2 + 1)) +
        canvas.height * -0.2;
      particlesRef.current.push({
        x: randomX,
        y: randomY,
        size: canvas.width / 1000,
      });
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    timerRef.current++;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const distanceX = canvas.width / 80;
    const growthRate = canvas.width / 1000;

    // Cyan-tinted particles for Synthex
    ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current.forEach(p => {
      ctx.beginPath();
      if (timerRef.current < 65) {
        p.x -= distanceX;
        p.size += growthRate;
      }
      if (timerRef.current > 65 && timerRef.current < 500) {
        p.x -= distanceX * 0.02;
        p.size += growthRate * 0.2;
      }
      ctx.arc(p.x, p.y, p.size, 0, 360);
      ctx.fill();
    });

    if (timerRef.current > 500) {
      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
      return;
    }

    requestIdRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    timerRef.current = 0;
    initParticles();
    draw();

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      timerRef.current = 0;
      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      initParticles();
      draw();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
    };
    // draw and initParticles use only refs — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full opacity-30" />;
}
