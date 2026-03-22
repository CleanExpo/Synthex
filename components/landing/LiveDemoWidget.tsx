'use client';

import { useState, useRef } from 'react';

type DemoState = 'idle' | 'loading' | 'result';

interface DemoResult {
  caption: string;
  imageUrl: string | null;
  durationMs: number;
  model?: string;
  tier?: string;
}

const INDUSTRY_CHIPS = [
  { label: 'Cafe', emoji: '\u2615' },
  { label: 'Tradie', emoji: '\uD83D\uDD28' },
  { label: 'Salon', emoji: '\uD83D\uDC87' },
  { label: 'Gym', emoji: '\uD83D\uDCAA' },
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
          <div className="w-full h-full bg-gradient-to-br from-orange-900/40 via-charcoal-700 to-charcoal-800 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">{'\uD83D\uDCF8'}</div>
              <p className="text-white/50 text-xs">Image preview unavailable</p>
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

/** Free-tier model badge */
function FreeTierBadge({ model }: { model?: string }) {
  const displayModel = model
    ? model.replace(':free', '').split('/').pop() || 'Free Model'
    : 'Llama 3.3 70B';

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-charcoal-700/80 border border-white/[0.06] text-[10px] text-white/40">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400/60 inline-block" />
        Free Tier &middot; {displayModel}
      </span>
    </div>
  );
}

/** Interactive demo widget — type business name, AI generates Instagram post */
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

      const captionData =
        captionRes.status === 'fulfilled' ? captionRes.value : null;
      const caption =
        captionData?.caption || 'Your AI-generated caption will appear here.';
      const model = captionData?.model || undefined;
      const tier = captionData?.tier || 'free';

      const imageUrl =
        imageRes.status === 'fulfilled' && imageRes.value?.imageUrl
          ? imageRes.value.imageUrl
          : null;

      setResult({
        caption,
        imageUrl,
        durationMs: Date.now() - startMs,
        model,
        tier,
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
            className="flex-1 bg-charcoal-900/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-orange-500/40 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!businessName.trim() || state === 'loading'}
            className="bg-orange-500 text-charcoal-900 font-bold rounded-xl px-4 py-2.5 text-sm hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {state === 'loading' ? (
              <span className="w-4 h-4 border-2 border-charcoal-900/30 border-t-charcoal-900 rounded-full animate-spin block" />
            ) : (
              '\u2192'
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
            Generating your post&hellip;
          </p>
        </div>
      )}

      {state === 'result' && result && (
        <div>
          <InstagramCard businessName={businessName} result={result} />
          <div className="flex items-center justify-between mt-3">
            <p className="text-orange-400/70 text-xs">
              {'\u2713'} Generated in {(result.durationMs / 1000).toFixed(1)}s
            </p>
            <button
              onClick={handleReset}
              className="text-white/50 hover:text-white/60 text-xs transition-colors"
            >
              Try another {'\u2192'}
            </button>
          </div>
          {/* Free tier badge + upsell */}
          <FreeTierBadge model={result.model} />
          <p className="text-[10px] text-white/25 mt-1.5 leading-relaxed">
            This demo uses a free-tier model. Sign up to unlock legacy models
            like Claude, GPT-4 &amp; Gemini Pro for premium results.
          </p>
        </div>
      )}

      {error && (
        <div className="text-center py-4 text-red-400/70 text-sm">{error}</div>
      )}
    </div>
  );
}
