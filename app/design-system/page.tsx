'use client';

import { useState } from 'react';
import MarketingLayout from '@/components/marketing/MarketingLayout';

export default function DesignSystemPage() {
  const [activeTab, setActiveTab] = useState('colors');

  return (
    <MarketingLayout currentPage="design-system" showFooter={true}>
      <div className="min-h-screen text-white">
        {/* Header */}
        <header className="sticky top-20 z-40 border-b border-cyan-500/10 bg-surface-dark/80 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600" />
                <span className="text-xl font-bold">SYNTHEX Design System</span>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-300">v4.0</span>
              </div>
              <nav className="flex gap-1">
                {['colors', 'typography', 'components', 'effects'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-all ${
                      activeTab === tab
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-12">
          {/* Colors Section */}
          {activeTab === 'colors' && (
            <section className="space-y-12">
              <div>
                <h2 className="mb-2 text-3xl font-bold">Color System</h2>
                <p className="text-white/60">OLED-optimized dark theme with vibrant accents</p>
              </div>

              {/* Brand Colors */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Brand Colors</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <ColorSwatch name="Primary" color="#06B6D4" desc="Cyan - AI signature" />
                  <ColorSwatch name="Primary Light" color="#22D3EE" desc="Hover states" />
                  <ColorSwatch name="Secondary" color="#0891B2" desc="Cyan Dark - Depth" />
                  <ColorSwatch name="Accent" color="#DC2626" desc="Red - CTAs" />
                </div>
              </div>

              {/* Neutral Scale */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Neutral Scale</h3>
                <div className="grid grid-cols-3 gap-2 md:grid-cols-6 lg:grid-cols-12">
                  <ColorChip color="#0a1628" name="Navy" />
                  <ColorChip color="#0f172a" name="950" />
                  <ColorChip color="#111827" name="900" />
                  <ColorChip color="#1F2937" name="800" />
                  <ColorChip color="#374151" name="700" />
                  <ColorChip color="#4B5563" name="600" />
                  <ColorChip color="#6B7280" name="500" />
                  <ColorChip color="#9CA3AF" name="400" />
                  <ColorChip color="#D1D5DB" name="300" />
                  <ColorChip color="#E5E7EB" name="200" />
                  <ColorChip color="#F3F4F6" name="100" />
                  <ColorChip color="#FFFFFF" name="White" light />
                </div>
              </div>

              {/* Glass Surfaces */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Glass Surfaces</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  {[3, 6, 10, 14, 18].map((opacity) => (
                    <div
                      key={opacity}
                      className="relative overflow-hidden rounded-xl border border-cyan-500/10 p-6"
                      style={{ background: `rgba(6, 182, 212, ${opacity / 100})` }}
                    >
                      <div className="absolute inset-0 backdrop-blur-xl" />
                      <div className="relative">
                        <p className="text-sm font-medium">{opacity}% opacity</p>
                        <p className="text-xs text-white/60">Glass surface</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Semantic Colors */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Semantic Colors</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <ColorSwatch name="Success" color="#22C55E" desc="Positive actions" />
                  <ColorSwatch name="Warning" color="#F59E0B" desc="Caution states" />
                  <ColorSwatch name="Error" color="#EF4444" desc="Destructive" />
                  <ColorSwatch name="Info" color="#06B6D4" desc="Informational" />
                </div>
              </div>
            </section>
          )}

          {/* Typography Section */}
          {activeTab === 'typography' && (
            <section className="space-y-12">
              <div>
                <h2 className="mb-2 text-3xl font-bold">Typography</h2>
                <p className="text-white/60">Inter font family with clear hierarchy</p>
              </div>

              {/* Display Headlines */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Display Headlines</h3>
                <div className="space-y-4 rounded-2xl border border-cyan-500/10 bg-surface-dark/50 p-8">
                  <div className="border-b border-cyan-500/10 pb-4">
                    <span className="mb-2 block text-xs text-white/40">display-xl - 72px - Black (900)</span>
                    <h1 className="text-7xl font-black tracking-tighter">AI Marketing</h1>
                  </div>
                  <div className="border-b border-cyan-500/10 pb-4">
                    <span className="mb-2 block text-xs text-white/40">display-lg - 60px - Bold (700)</span>
                    <h1 className="text-6xl font-bold tracking-tight">Transform Your Brand</h1>
                  </div>
                  <div>
                    <span className="mb-2 block text-xs text-white/40">display-md - 48px - Bold (700)</span>
                    <h1 className="text-5xl font-bold tracking-tight">Powered by Intelligence</h1>
                  </div>
                </div>
              </div>

              {/* Section Headlines */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Section Headlines</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <span className="mb-2 block text-xs text-white/40">heading-xl - 36px</span>
                    <h2 className="text-4xl font-semibold">Features Overview</h2>
                  </div>
                  <div className="rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <span className="mb-2 block text-xs text-white/40">heading-lg - 30px</span>
                    <h2 className="text-3xl font-semibold">How It Works</h2>
                  </div>
                  <div className="rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <span className="mb-2 block text-xs text-white/40">heading-md - 24px</span>
                    <h3 className="text-2xl font-semibold">Content Generation</h3>
                  </div>
                  <div className="rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <span className="mb-2 block text-xs text-white/40">heading-sm - 20px</span>
                    <h4 className="text-xl font-medium">Quick Actions</h4>
                  </div>
                </div>
              </div>

              {/* Body Text */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Body Text</h3>
                <div className="space-y-4">
                  <div className="rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <span className="mb-2 block text-xs text-white/40">body-lg - 18px - Gray 300</span>
                    <p className="text-lg leading-relaxed text-gray-300">
                      Generate viral content with AI, analyze engagement patterns, and automate your social media presence across all platforms.
                    </p>
                  </div>
                  <div className="rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <span className="mb-2 block text-xs text-white/40">body-md - 16px - Gray 400</span>
                    <p className="text-base leading-normal text-gray-400">
                      Our platform uses advanced machine learning to understand your brand voice and create content that resonates with your audience.
                    </p>
                  </div>
                  <div className="rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <span className="mb-2 block text-xs text-white/40">body-sm - 14px - Gray 500</span>
                    <p className="text-sm leading-normal text-gray-500">
                      Last updated 2 hours ago - 1.2k views - 45 shares
                    </p>
                  </div>
                </div>
              </div>

              {/* Gradient Text */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Gradient Text</h3>
                <div className="rounded-2xl border border-cyan-500/10 bg-surface-dark/50 p-8">
                  <h1 className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 bg-clip-text text-6xl font-bold tracking-tight text-transparent">
                    Next-Gen Marketing
                  </h1>
                </div>
              </div>

              {/* Pill Headlines */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Pill Headlines (Reference Style)</h3>
                <div className="flex flex-wrap gap-4">
                  <span className="rounded-lg bg-surface-dark px-6 py-3 text-3xl font-black uppercase tracking-tight text-white border border-cyan-500/20">
                    AI Marketing
                  </span>
                  <span className="rounded-lg bg-white px-6 py-3 text-3xl font-black uppercase tracking-tight text-surface-dark">
                    Agency Guide
                  </span>
                  <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-6 py-3 text-3xl font-black uppercase tracking-tight text-white">
                    SYNTHEX
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Components Section */}
          {activeTab === 'components' && (
            <section className="space-y-12">
              <div>
                <h2 className="mb-2 text-3xl font-bold">Components</h2>
                <p className="text-white/60">Reusable UI elements with consistent styling</p>
              </div>

              {/* Buttons */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Buttons</h3>
                <div className="rounded-2xl border border-cyan-500/10 bg-surface-dark/50 p-8">
                  <div className="flex flex-wrap gap-4">
                    <button className="rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:from-cyan-400 hover:to-cyan-500 hover:shadow-cyan-500/40">
                      Primary Button
                    </button>
                    <button className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-cyan-500/20">
                      Secondary
                    </button>
                    <button className="rounded-lg border border-cyan-500/30 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-cyan-500/10">
                      Outline
                    </button>
                    <button className="rounded-lg px-6 py-3 text-sm font-semibold text-gray-400 transition-all hover:bg-cyan-500/10 hover:text-white">
                      Ghost
                    </button>
                    <button className="rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-all hover:from-red-500 hover:to-red-600">
                      Accent CTA
                    </button>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-4">
                    <button className="rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 px-6 py-3 text-sm font-semibold text-white">
                      Pill Button
                    </button>
                    <button className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white">
                      Small
                    </button>
                    <button className="rounded-lg bg-cyan-600 px-8 py-4 text-base font-semibold text-white">
                      Large
                    </button>
                  </div>
                </div>
              </div>

              {/* Pills & Badges */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Pills & Badges</h3>
                <div className="flex flex-wrap gap-3 rounded-2xl border border-cyan-500/10 bg-surface-dark/50 p-8">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-gray-300 backdrop-blur-md">
                    New Feature
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    AI Powered
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/15 px-3 py-1 text-xs font-medium text-cyan-300">
                    Beta
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs font-medium text-red-300">
                    Limited Time
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 text-xs font-medium text-green-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                    Live
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Cards</h3>
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Basic Card */}
                  <div className="rounded-xl border border-cyan-500/10 bg-surface-base p-6 transition-all hover:border-cyan-500/30">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
                      <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h4 className="mb-2 text-lg font-semibold">Basic Card</h4>
                    <p className="text-sm text-gray-400">Standard card with subtle hover effect and clean borders.</p>
                  </div>

                  {/* Glass Card */}
                  <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-6 backdrop-blur-xl transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
                      <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h4 className="mb-2 text-lg font-semibold">Glass Card</h4>
                    <p className="text-sm text-gray-400">Glassmorphism with backdrop blur and transparency.</p>
                  </div>

                  {/* Premium Card */}
                  <div className="group relative rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6 shadow-lg shadow-cyan-500/10 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-cyan-500/20">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600">
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <h4 className="mb-2 text-lg font-semibold">Premium Card</h4>
                    <p className="text-sm text-gray-400">Enhanced with glow effect and lift animation on hover.</p>
                  </div>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Stat Cards</h3>
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard label="Total Revenue" value="$24,500" change="+12.5%" positive />
                  <StatCard label="Active Users" value="8,420" change="+5.2%" positive />
                  <StatCard label="Bounce Rate" value="32.4%" change="-2.1%" positive />
                  <StatCard label="Avg. Session" value="4m 32s" change="-8.3%" positive={false} />
                </div>
              </div>

              {/* Inputs */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Inputs</h3>
                <div className="grid gap-4 rounded-2xl border border-cyan-500/10 bg-surface-dark/50 p-8 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-400">Standard Input</label>
                    <input
                      type="text"
                      placeholder="Enter your email..."
                      className="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-white placeholder-gray-500 transition-all focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-400">Large Input</label>
                    <input
                      type="text"
                      placeholder="Search anything..."
                      className="w-full rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-5 py-4 text-base text-white placeholder-gray-500 transition-all focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Avatars */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Avatars</h3>
                <div className="flex items-center gap-6 rounded-2xl border border-cyan-500/10 bg-surface-dark/50 p-8">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500 to-cyan-600 text-xs font-bold">
                    SM
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-400 to-cyan-500 text-sm font-bold">
                    MD
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500 to-cyan-600 text-base font-bold">
                    LG
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-400 to-cyan-600 text-lg font-bold">
                    XL
                  </div>
                  {/* Avatar Group */}
                  <div className="flex -space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-dark bg-cyan-500 text-xs font-bold">JD</div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-dark bg-cyan-600 text-xs font-bold">AK</div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-dark bg-cyan-400 text-xs font-bold">MR</div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-dark bg-cyan-500/30 text-xs font-bold">+5</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Effects Section */}
          {activeTab === 'effects' && (
            <section className="space-y-12">
              <div>
                <h2 className="mb-2 text-3xl font-bold">Effects & Animations</h2>
                <p className="text-white/60">Visual effects inspired by AI/tech aesthetic</p>
              </div>

              {/* Particle Effect */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Particle Dispersion Effect</h3>
                <div className="relative h-80 overflow-hidden rounded-2xl border border-cyan-500/10 bg-gradient-to-br from-[#0a1628] to-[#0f172a]">
                  {/* Particles */}
                  <div className="absolute inset-0">
                    {[...Array(30)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute h-1 w-1 animate-pulse rounded-full bg-cyan-400/40"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                          animationDelay: `${Math.random() * 2}s`,
                          animationDuration: `${2 + Math.random() * 3}s`,
                        }}
                      />
                    ))}
                  </div>
                  {/* Grid overlay */}
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)`,
                      backgroundSize: '40px 40px',
                    }}
                  />
                  {/* Content */}
                  <div className="relative flex h-full items-center justify-center">
                    <div className="text-center">
                      <h3 className="bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-4xl font-bold text-transparent">
                        Particle Field
                      </h3>
                      <p className="mt-2 text-gray-400">Ambient floating particles with grid overlay</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow Effects */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Glow Effects</h3>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-8 text-center shadow-lg shadow-cyan-500/20">
                    <span className="text-sm font-medium text-cyan-300">Primary Glow</span>
                  </div>
                  <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-8 text-center shadow-lg shadow-cyan-400/20">
                    <span className="text-sm font-medium text-cyan-300">Secondary Glow</span>
                  </div>
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center shadow-lg shadow-red-500/20">
                    <span className="text-sm font-medium text-red-300">Accent Glow</span>
                  </div>
                </div>
              </div>

              {/* Gradient Backgrounds */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Gradient Backgrounds</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="relative h-48 overflow-hidden rounded-xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f172a] to-[#0a1628]" />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6, 182, 212, 0.3), transparent 70%)',
                      }}
                    />
                    <div className="relative flex h-full items-center justify-center">
                      <span className="text-sm font-medium text-gray-300">Spotlight Gradient</span>
                    </div>
                  </div>
                  <div
                    className="relative h-48 overflow-hidden rounded-xl"
                    style={{
                      background: `
                        radial-gradient(at 40% 20%, rgba(6, 182, 212, 0.15) 0px, transparent 50%),
                        radial-gradient(at 80% 0%, rgba(34, 211, 238, 0.15) 0px, transparent 50%),
                        radial-gradient(at 0% 50%, rgba(6, 182, 212, 0.1) 0px, transparent 50%),
                        rgb(10, 22, 40)
                      `,
                    }}
                  >
                    <div className="flex h-full items-center justify-center">
                      <span className="text-sm font-medium text-gray-300">Mesh Gradient</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Animation Examples */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Animations</h3>
                <div className="grid gap-6 md:grid-cols-4">
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <div className="h-12 w-12 animate-pulse rounded-lg bg-cyan-500/50" />
                    <span className="text-xs text-gray-400">Pulse</span>
                  </div>
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <div className="h-12 w-12 animate-bounce rounded-lg bg-cyan-400/50" />
                    <span className="text-xs text-gray-400">Bounce</span>
                  </div>
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <div className="h-12 w-12 animate-spin rounded-lg border-2 border-cyan-500/50 border-t-cyan-500" />
                    <span className="text-xs text-gray-400">Spin</span>
                  </div>
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-cyan-500/10 bg-surface-dark/50 p-6">
                    <div className="h-12 w-12 animate-ping rounded-full bg-green-500/50" />
                    <span className="text-xs text-gray-400">Ping</span>
                  </div>
                </div>
              </div>

              {/* Hover Effects Demo */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Hover Effects</h3>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="cursor-pointer rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-8 text-center transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-cyan-500/20">
                    <span className="text-sm font-medium">Lift Effect</span>
                  </div>
                  <div className="cursor-pointer rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-8 text-center transition-all duration-300 hover:scale-105">
                    <span className="text-sm font-medium">Scale Effect</span>
                  </div>
                  <div className="cursor-pointer rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-8 text-center transition-all duration-300 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/20">
                    <span className="text-sm font-medium">Glow Effect</span>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </MarketingLayout>
  );
}

// Helper Components
function ColorSwatch({ name, color, desc }: { name: string; color: string; desc: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-cyan-500/10">
      <div className="h-20" style={{ backgroundColor: color }} />
      <div className="bg-surface-base p-3">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-gray-500">{color}</p>
        <p className="mt-1 text-xs text-gray-400">{desc}</p>
      </div>
    </div>
  );
}

function ColorChip({ color, name, light }: { color: string; name: string; light?: boolean }) {
  return (
    <div className="text-center">
      <div
        className="mx-auto mb-1 h-10 w-10 rounded-lg border border-cyan-500/10"
        style={{ backgroundColor: color }}
      />
      <span className={`text-xs ${light ? 'text-gray-600' : 'text-gray-400'}`}>{name}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  positive,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-6 backdrop-blur-lg">
      <p className="text-sm font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      <p className={`mt-1 flex items-center gap-1 text-sm font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
        {positive ? '↑' : '↓'} {change}
      </p>
    </div>
  );
}
