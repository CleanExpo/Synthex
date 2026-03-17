'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Testimonial = {
  quote: string;
  name: string;
  designation: string;
  src: string;
};

export const AnimatedTestimonials = ({
  testimonials,
  autoplay = false,
  className,
}: {
  testimonials: Testimonial[];
  autoplay?: boolean;
  className?: string;
}) => {
  const [active, setActive] = useState(0);

  const handleNext = useCallback(() => {
    setActive(prev => (prev + 1) % testimonials.length);
  }, [testimonials.length]);

  const handlePrev = useCallback(() => {
    setActive(prev => (prev - 1 + testimonials.length) % testimonials.length);
  }, [testimonials.length]);

  const isActive = (index: number) => index === active;

  useEffect(() => {
    if (autoplay) {
      const interval = setInterval(handleNext, 5000);
      return () => clearInterval(interval);
    }
  }, [autoplay, handleNext]);

  const randomRotateY = () => Math.floor(Math.random() * 21) - 10;

  return (
    <div
      className={cn(
        'max-w-sm md:max-w-4xl mx-auto px-4 md:px-8 lg:px-12 py-20',
        className
      )}
    >
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-20">
        <div>
          <div className="relative h-80 w-full">
            <AnimatePresence>
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.src}
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                    z: -100,
                    rotate: randomRotateY(),
                  }}
                  animate={{
                    opacity: isActive(index) ? 1 : 0.7,
                    scale: isActive(index) ? 1 : 0.95,
                    z: isActive(index) ? 0 : -100,
                    rotate: isActive(index) ? 0 : randomRotateY(),
                    zIndex: isActive(index)
                      ? 999
                      : testimonials.length + 2 - index,
                    y: isActive(index) ? [0, -80, 0] : 0,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    z: 100,
                    rotate: randomRotateY(),
                  }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="absolute inset-0 origin-bottom"
                >
                  <Image
                    src={testimonial.src}
                    alt={testimonial.name}
                    width={500}
                    height={500}
                    draggable={false}
                    className="h-full w-full rounded-sm object-cover object-center"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex justify-between flex-col py-4">
          <motion.div
            key={active}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <h3 className="text-2xl font-bold text-white">
              {testimonials[active].name}
            </h3>
            <p className="text-sm text-white/60">
              {testimonials[active].designation}
            </p>
            <motion.p className="text-lg text-white/60 mt-8">
              {testimonials[active].quote.split(' ').map((word, index) => (
                <motion.span
                  key={index}
                  initial={{ filter: 'blur(10px)', opacity: 0, y: 5 }}
                  animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: 'easeInOut',
                    delay: 0.02 * index,
                  }}
                  className="inline-block"
                >
                  {word}&nbsp;
                </motion.span>
              ))}
            </motion.p>
          </motion.div>
          <div className="flex gap-4 pt-12 md:pt-0">
            <button
              onClick={handlePrev}
              className="h-7 w-7 rounded-sm border-[0.5px] border-white/[0.08] bg-white/[0.04] flex items-center justify-center group/button hover:bg-white/[0.08] transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-white/60 group-hover/button:text-white group-hover/button:rotate-12 transition-transform duration-300" />
            </button>
            <button
              onClick={handleNext}
              className="h-7 w-7 rounded-sm border-[0.5px] border-white/[0.08] bg-white/[0.04] flex items-center justify-center group/button hover:bg-white/[0.08] transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-white/60 group-hover/button:text-white group-hover/button:-rotate-12 transition-transform duration-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Default export with Synthex testimonials data
const synthexTestimonials: Testimonial[] = [
  {
    quote:
      'Synthex cut our content creation time by 80%. The AI actually sounds like us — our engagement went up 340% in the first month.',
    name: 'Maya Chen',
    designation: 'Social Media Manager, Bloom & Co.',
    src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=500&auto=format&fit=crop',
  },
  {
    quote:
      'I was sceptical about AI content, but Synthex learned my voice from day one. My TikTok following went from 12K to 87K in 6 months.',
    name: 'Jake Morrison',
    designation: 'Founder, The Fitness Blueprint',
    src: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=500&auto=format&fit=crop',
  },
  {
    quote:
      'We manage 8 brand accounts across every major platform. Synthex is the only tool that actually scales with us without losing brand consistency.',
    name: 'Priya Nair',
    designation: 'Marketing Director, Nexora Tech',
    src: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=500&auto=format&fit=crop',
  },
  {
    quote:
      "The ROI is insane. I'm spending $99/month and saving 20+ hours of work. That's worth more than any employee I could hire.",
    name: 'Tom Gallagher',
    designation: 'E-commerce Entrepreneur',
    src: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=500&auto=format&fit=crop',
  },
  {
    quote:
      'I post daily on LinkedIn, Twitter, and Instagram. Synthex keeps my voice consistent across all three without me having to think about it.',
    name: 'Aisha Williams',
    designation: 'Content Creator · LinkedIn Top Voice',
    src: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=500&auto=format&fit=crop',
  },
  {
    quote:
      'We onboarded 15 clients onto the Agency plan in 3 weeks. The white-label feature alone is worth every dollar.',
    name: 'Carlos Rivera',
    designation: 'Agency Owner, Elevate Digital',
    src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=500&auto=format&fit=crop',
  },
];

export function TestimonialsSection({ className }: { className?: string }) {
  return (
    <section className={cn('py-20 md:py-28 bg-[#0a1628]', className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            10,000+ creators trust Synthex
          </h2>
          <p className="text-gray-400 mt-4 text-base max-w-xl mx-auto">
            Real results from real users — not generic AI content.
          </p>
        </div>
        <AnimatedTestimonials testimonials={synthexTestimonials} autoplay />
      </div>
    </section>
  );
}

export { TestimonialsSection as Testimonials };
