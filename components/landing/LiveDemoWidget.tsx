'use client';

import { useState, useRef } from 'react';

type DemoState = 'idle' | 'loading' | 'result';

interface DemoResult {
  caption: string;
  imageUrl: string | null;
  durationMs: number;
}

const INDUSTRY_CHIPS = [
  { label: 'Cafe', emoji: '☕' },
  { label: 'Tradie', emoji: '🔧' },
  { label: 'Salon', emoji: '✂️' },
  { label: 'Gym', emoji: '💪' },
];

/** Instagram card skeleton shimmer */
function InstagramSkeleton() {
  return (
    <div className="bg-charcoal-800 border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Image placeholder */}
      <div className="w-full h-48 bg-charcoal-700 relative overflow-hidden">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
      </div>
      {/* Text lines */}
      <div className="p-4 space-y-2">
        <div className="h-3 bg-charcoal-700 rounded-full w-1/3 relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite_0.2s] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        </div>
        <div className="h-3 bg-charcoal-700 rounded-full w-full relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite_0.3s] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        </div>
        <div className="h-3 bg-charcoal-700 rounded-full w-4/5 relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite_0.4s] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        </div>
      </div>
    </div>
  );
}

/** Rendered Instagram card */
function InstagramCard({
  businessName,
  result,
}: {
  businessName: string;
  result: DemoResult;
}) {
  return (
    <div className="bg-charcoal-800 border border-white/[0.06] rounded-2xl overflow-hidden transition-all duration-500 ease-out scale-95 animate-[fade-in_0.4s_ease-out_forwards,slide-up_0.4s_ease-out_forwards]">
      {/* Image */}
      <div className="w-full h-48 bg-charcoal-700 relative overflow-hidden">
        {result.imageUrl ? (
          <img
            src={result.imageUrl}
            alt={`Generated image for ${businessName}`}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Warm gradient fallback when image generation unavailable */
          <div className="w-full h-full bg-gradient-to-br from-amber-900/40 via-charcoal-700 to-charcoal-800 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">📸</div>
              <p className="text-white/50 text-xs">Image generation offline</p>
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="p-4">
        <p className="text-white/60 text-xs font-semibold mb-1">
          @{businessName.toLowerCase().replace(/\s+/g, '')}
        </p>
        <p className="text-white/80 text-sm leading-relaxed">
          {result.caption}
        </p>
      </div>
    </div>
  );
}

/** Interactive demo widget — type business name → AI generates Instagram post */
export function LiveDemoWidget() {
  const [businessName, setBusinessName] = useState('');
  const [state, setState] = useState<DemoState>('idle');
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChip = (label: string) => {
    setBusinessName(label);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = businessName.trim();
    if (!name || state === 'loading') return;

    setState('loading');
    setError(null);
    setResult(null);
    const startMs = Date.now();

    try {
      // Run caption and image generation in parallel
      const [captionRes, imageRes] = await Promise.allSettled([
        fetch('/api/demo/caption', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessName: name }),
        }).then(r => r.json()),
        fetch('/api/demo/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessName: name }),
        }).then(r => r.json()),
      ]);

      const caption =
        captionRes.status === 'fulfilled' && captionRes.value?.caption
          ? captionRes.value.caption
          : 'Your AI-generated caption will appear here.';

      const imageUrl =
        imageRes.status === 'fulfilled' && imageRes.value?.imageUrl
          ? imageRes.value.imageUrl
          : null;

      setResult({
        caption,
        imageUrl,
        durationMs: Date.now() - startMs,
      });
      setState('result');
    } catch {
      setError('Something went wrong. Please try again.');
      setState('idle');
    }
  };

  const handleReset = () => {
    setState('idle');
    setResult(null);
    setError(null);
    setBusinessName('');
  };

  return (
    <div className="bg-charcoal-800/50 border border-white/[0.06] rounded-2xl p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-4">
        <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-1">
          Live demo
        </p>
        <h3 className="text-white font-bold text-base">
          Generate your first post
        </h3>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            placeholder="Your business name"
            maxLength={80}
            disabled={state === 'loading'}
            className="flex-1 bg-charcoal-900/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-500/40 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!businessName.trim() || state === 'loading'}
            className="bg-amber-500 text-charcoal-900 font-bold rounded-xl px-4 py-2.5 text-sm hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {state === 'loading' ? (
              <span className="w-4 h-4 border-2 border-charcoal-900/30 border-t-charcoal-900 rounded-full animate-spin block" />
            ) : (
              '→'
            )}
          </button>
        </div>
      </form>

      {/* Industry chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {INDUSTRY_CHIPS.map(({ label, emoji }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleChip(label)}
            disabled={state === 'loading'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-charcoal-700/60 border border-white/[0.06] text-white/50 hover:text-white hover:border-white/10 text-xs font-medium transition-all disabled:opacity-40"
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Content area */}
      {state === 'idle' && !error && (
        <div className="text-center py-8 text-white/50 text-sm">
          Enter a business name above to generate a post
        </div>
      )}

      {state === 'loading' && (
        <div>
          <InstagramSkeleton />
          <p className="text-center text-white/40 text-xs mt-3 animate-pulse">
            Generating your post…
          </p>
        </div>
      )}

      {state === 'result' && result && (
        <div>
          <InstagramCard businessName={businessName} result={result} />
          <div className="flex items-center justify-between mt-3">
            <p className="text-amber-400/70 text-xs">
              ✓ Generated in {(result.durationMs / 1000).toFixed(1)}s
            </p>
            <button
              onClick={handleReset}
              className="text-white/50 hover:text-white/60 text-xs transition-colors"
            >
              Try another →
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-center py-4 text-red-400/70 text-sm">{error}</div>
      )}
    </div>
  );
}
