'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardConfig } from '@/lib/cards/white-rabbit';

type Variant = 'story' | 'plain';
type Door = 'home' | 'discover' | 'solve' | 'connect';
type Rating = 'useful' | 'not_useful' | 'confusing';

interface Props {
  slug: string;
  profile: { name: string; bio: string | null };
  links: { id: string; title: string; url: string }[];
  card: CardConfig;
  forcedVariant: Variant | null;
}

function sessionValue(key: string, make: () => string): string {
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const value = make();
    sessionStorage.setItem(key, value);
    return value;
  } catch {
    return make();
  }
}

export default function CardClient({
  slug,
  profile,
  links,
  card,
  forcedVariant,
}: Props) {
  const [variant, setVariant] = useState<Variant | null>(forcedVariant);
  const [door, setDoor] = useState<Door>('home');
  const [needId, setNeedId] = useState<string | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [recording, setRecording] = useState<'on' | 'off' | 'unknown'>(
    'unknown'
  );
  const [reported, setReported] = useState<string | null>(null);
  const session = useRef<string | null>(null);
  const live = useRef<HTMLParagraphElement>(null);

  const send = useCallback(
    async (type: string, extra: Record<string, string> = {}) => {
      if (!session.current || !variant) return;
      try {
        const res = await fetch(`/api/card/${slug}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.current,
            type,
            variant,
            ...extra,
          }),
        });
        setRecording(
          res.status === 201 ? 'on' : res.status === 503 ? 'off' : recording
        );
      } catch {
        // The card keeps working when recording fails; the status line says so.
        setRecording('off');
      }
    },
    [slug, variant, recording]
  );

  useEffect(() => {
    session.current = sessionValue(`card:${slug}:session`, () =>
      crypto.randomUUID()
    );
    if (!forcedVariant) {
      setVariant(
        sessionValue(`card:${slug}:variant`, () =>
          Math.random() < 0.5 ? 'story' : 'plain'
        ) as Variant
      );
    }
  }, [slug, forcedVariant]);

  useEffect(() => {
    if (variant) void send('session_started');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  if (!variant)
    return <main className="min-h-screen bg-slate-950" aria-busy="true" />;
  const copy = card.variants[variant];
  const need = card.needs.find(n => n.id === needId) ?? null;

  const pickNeed = (id: string) => {
    setNeedId(id);
    setRating(null);
    void send('need_selected', { needId: id });
    void send('action_shown', { needId: id });
    setTimeout(() => live.current?.focus(), 0);
  };
  const rate = (r: Rating) => {
    setRating(r);
    void send('action_rated', { needId: needId ?? '', rating: r });
  };
  const report = (
    type: 'confusion_reported' | 'accessibility_issue',
    label: string
  ) => {
    setReported(label);
    void send(type);
  };

  const button =
    'rounded-lg px-4 py-3 text-left font-medium focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300';
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-amber-300">
            {profile.name}
          </p>
          <h1 className="text-3xl font-bold">{copy.heading}</h1>
          <p className="text-slate-200">{copy.intro}</p>
        </header>

        {door === 'home' && (
          <nav aria-label="Choose a door" className="grid gap-3">
            <button
              className={`${button} bg-amber-400 text-slate-950`}
              onClick={() => setDoor('discover')}
            >
              DISCOVER — {copy.discoverLabel}
            </button>
            <button
              className={`${button} bg-slate-800`}
              onClick={() => setDoor('solve')}
            >
              SOLVE — Enter the White Rabbit
            </button>
            <button
              className={`${button} bg-slate-800`}
              onClick={() => setDoor('connect')}
            >
              CONNECT — Save my details
            </button>
          </nav>
        )}

        {door === 'discover' && (
          <section aria-labelledby="discover-h" className="space-y-4">
            <h2 id="discover-h" className="text-xl font-semibold">
              What do you need help with?
            </h2>
            <div className="grid gap-2" role="group" aria-label="Needs">
              {card.needs.map(n => (
                <button
                  key={n.id}
                  aria-pressed={needId === n.id}
                  className={`${button} ${needId === n.id ? 'bg-amber-400 text-slate-950' : 'bg-slate-800'}`}
                  onClick={() => pickNeed(n.id)}
                >
                  {n.label}
                </button>
              ))}
            </div>
            {need && (
              <div className="space-y-3 rounded-lg border border-amber-300/40 p-4">
                <p
                  ref={live}
                  tabIndex={-1}
                  aria-live="polite"
                  className="text-lg font-semibold focus:outline-none"
                  data-testid="action"
                >
                  Your next move: {need.action}
                </p>
                <p className="text-slate-300">Why: {need.why}</p>
                <fieldset className="space-y-2">
                  <legend className="font-medium">Was this useful?</legend>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['useful', 'Yes, useful'],
                        ['not_useful', 'Not really'],
                        ['confusing', 'I am confused'],
                      ] as const
                    ).map(([r, label]) => (
                      <button
                        key={r}
                        aria-pressed={rating === r}
                        className={`${button} ${rating === r ? 'bg-amber-400 text-slate-950' : 'bg-slate-800'}`}
                        onClick={() => rate(r)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {rating && (
                  <p role="status">
                    Thanks — noted. You can save my details below, or pick
                    another need.
                  </p>
                )}
              </div>
            )}
            <button
              className={`${button} bg-slate-800`}
              onClick={() => setDoor('connect')}
            >
              Save my details
            </button>
          </section>
        )}

        {door === 'solve' && (
          <section aria-labelledby="solve-h" className="space-y-3">
            <h2 id="solve-h" className="text-xl font-semibold">
              The White Rabbit
            </h2>
            {card.solve.status !== 'approved' ? (
              <p role="status" data-testid="solve-held">
                The White Rabbit opens once the deck, the prize rules and the
                music are confirmed. Until then, DISCOVER gives you the same
                practical help.
              </p>
            ) : null}
            <h3 className="font-medium">How entry will work</h3>
            <ul className="list-disc space-y-1 pl-5 text-slate-200">
              {card.solve.entryRequirements.map(r => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        {door === 'connect' && (
          <section aria-labelledby="connect-h" className="space-y-3">
            <h2 id="connect-h" className="text-xl font-semibold">
              Save my details
            </h2>
            <a
              className={`${button} block bg-amber-400 text-slate-950`}
              href={`/api/card/${slug}/vcard`}
              onClick={() => void send('contact_saved')}
            >
              Save contact (no app needed)
            </a>
            {links.length > 0 && (
              <ul className="space-y-2" aria-label="Approved links">
                {links.map(l => (
                  <li key={l.id}>
                    <a
                      className="underline decoration-amber-300 underline-offset-4"
                      href={l.url}
                      rel="noopener noreferrer"
                      target="_blank"
                      onClick={() => void send('brand_link_opened')}
                    >
                      {l.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {door !== 'home' && (
          <button className="text-sm underline" onClick={() => setDoor('home')}>
            Back to the three doors
          </button>
        )}

        <footer className="space-y-2 border-t border-slate-800 pt-4 text-sm text-slate-300">
          <div className="flex flex-wrap gap-3">
            <button
              className="underline"
              onClick={() => report('confusion_reported', 'confusing')}
            >
              This page is confusing
            </button>
            <button
              className="underline"
              onClick={() => report('accessibility_issue', 'hard to use')}
            >
              Something is hard to use
            </button>
          </div>
          {reported && (
            <p role="status">
              Thanks for telling us it is {reported}. Nothing personal was
              recorded.
            </p>
          )}
          <p data-testid="recording">
            {recording === 'off'
              ? 'Feedback recording is off for this card. Everything else works.'
              : 'Your choices help improve this card. Nothing personal is recorded and no email is needed.'}
          </p>
        </footer>
      </div>
    </main>
  );
}
