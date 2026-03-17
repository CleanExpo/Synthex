"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AnimatedGroup } from "@/components/ui/animated-group";

const transitionVariants = {
  item: {
    hidden: { opacity: 0, filter: "blur(12px)", y: 12 },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: { type: "spring" as const, bounce: 0.3, duration: 1.5 },
    },
  },
};

export interface CustomerLogo {
  src: string;
  alt: string;
  height: number;
}

interface StatsSectionProps {
  customers?: CustomerLogo[];
  className?: string;
}

const defaultCustomers: CustomerLogo[] = [
  { src: "https://html.tailus.io/blocks/customers/nvidia.svg", alt: "Nvidia", height: 20 },
  { src: "https://html.tailus.io/blocks/customers/column.svg", alt: "Column", height: 16 },
  { src: "https://html.tailus.io/blocks/customers/github.svg", alt: "GitHub", height: 16 },
  { src: "https://html.tailus.io/blocks/customers/nike.svg", alt: "Nike", height: 20 },
  { src: "https://html.tailus.io/blocks/customers/lemonsqueezy.svg", alt: "Lemon Squeezy", height: 20 },
  { src: "https://html.tailus.io/blocks/customers/laravel.svg", alt: "Laravel", height: 16 },
  { src: "https://html.tailus.io/blocks/customers/lilly.svg", alt: "Lilly", height: 28 },
  { src: "https://html.tailus.io/blocks/customers/openai.svg", alt: "OpenAI", height: 24 },
];

export function StatsSection({ customers = defaultCustomers, className }: StatsSectionProps) {
  return (
    <section className={`pb-16 pt-16 md:pb-32 bg-[#0a1628] ${className ?? ""}`}>
      <div className="group relative m-auto max-w-5xl px-6">
        <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
          <Link href="/" className="block text-sm text-white/40 duration-150 hover:text-white/70">
            <span>Meet Our Customers</span>
            <ChevronRight className="ml-1 inline-block size-3" />
          </Link>
        </div>
        <p className="text-center text-white/40 text-sm mb-8">Trusted by teams at</p>
        <AnimatedGroup
          variants={{
            container: {
              visible: {
                transition: { staggerChildren: 0.05, delayChildren: 0.75 },
              },
            },
            ...transitionVariants,
          }}
          className="group-hover:blur-xs mx-auto mt-6 grid max-w-2xl grid-cols-4 gap-x-12 gap-y-8 transition-all duration-500 group-hover:opacity-50 sm:gap-x-16 sm:gap-y-14"
        >
          {customers.map((logo, index) => (
            <div key={index} className="flex">
              <img
                className="mx-auto h-auto w-fit opacity-40 hover:opacity-70 transition-opacity duration-300 dark:invert"
                src={logo.src}
                alt={logo.alt}
                height={logo.height}
                width="auto"
              />
            </div>
          ))}
        </AnimatedGroup>
      </div>
    </section>
  );
}
