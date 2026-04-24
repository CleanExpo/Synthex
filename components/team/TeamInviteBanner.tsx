'use client';

/**
 * TeamInviteBanner — SYN-597
 *
 * Contextual dismissible banner shown at day 45+ or after first Monthly Story delivery.
 * Prompt: "Your marketing is running. Want someone else to see the results? Invite a team member."
 * Clicking opens an inline modal with email input + brand safety reassurance copy.
 *
 * @task SYN-597
 */

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { fireTeamEvent, hashEmail } from '@/lib/analytics/team-events';
import { cn } from '@/lib/utils';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

interface InvitePromptData {
  shouldShow: boolean;
}

interface TeamInviteBannerProps {
  className?: string;
}

export function TeamInviteBanner({ className }: TeamInviteBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promptShownTracked = useState(false);

  const { data } = useSWR<InvitePromptData>(
    '/api/teams/invite-prompt',
    fetchJson,
    { revalidateOnFocus: false }
  );

  const shouldShow = data?.shouldShow && !dismissed;

  // Fire prompt_shown once when banner becomes visible
  useEffect(() => {
    if (shouldShow && !promptShownTracked[0]) {
      promptShownTracked[1](true);
      fireTeamEvent('team_invite_prompt_shown');
    }
  }, [shouldShow, promptShownTracked]);

  const handleDismiss = useCallback(async () => {
    // SYN-732: previously optimistically set `dismissed = true` BEFORE the
    // POST, and swallowed any failure with `.catch(() => {})` — so the
    // banner stayed dismissed client-side even when the server rejected
    // the dismiss. Now the dismiss only sticks on a confirmed 2xx response.
    try {
      const res = await fetch('/api/teams/invite-prompt', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Dismiss failed (${res.status})`);
      }
      setDismissed(true);
    } catch (err) {
      console.error('[team-invite-banner] dismiss failed', err);
      // Banner stays visible on failure — user can retry
    }
  }, []);

  const handleOpenModal = useCallback(() => {
    setShowModal(true);
    fireTeamEvent('team_invite_prompt_clicked');
  }, []);

  const handleSendInvite = useCallback(async () => {
    if (!email || isSending) return;
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch('/api/teams/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: 'collaborator' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error ??
            'Failed to send invite. Please try again.'
        );
        return;
      }

      // Fire GA4 event with hashed email
      const emailHash = await hashEmail(email);
      fireTeamEvent('team_invite_sent', { invitee_email_hash: emailHash });

      setSent(true);
      // Dismiss the banner after successful send
      setTimeout(handleDismiss, 3000);
    } finally {
      setIsSending(false);
    }
  }, [email, isSending, handleDismiss]);

  if (!shouldShow) return null;

  return (
    <>
      {/* Inline Banner */}
      <div
        role="alert"
        className={cn(
          'relative flex items-start gap-4 rounded-sm border border-sky-500/30',
          'bg-gradient-to-r from-sky-500/10 via-sky-400/5 to-transparent',
          'px-5 py-4 animate-in slide-in-from-top-2 duration-500',
          className
        )}
      >
        <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">
          👥
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sky-400">
            Your marketing is running.
          </p>
          <p className="text-sm text-white/80 mt-0.5 leading-relaxed">
            Want someone else to see the results? Invite a team member.
          </p>
          <button
            onClick={handleOpenModal}
            className="mt-2 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
          >
            Invite a team member →
          </button>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Dismiss invite prompt"
          className="flex-shrink-0 text-white/30 hover:text-white/70 transition-colors mt-0.5 p-1 rounded-sm hover:bg-white/[0.04]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowModal(false)}
          />

          {/* Modal panel */}
          <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h2
              id="invite-modal-title"
              className="text-lg font-bold text-white mb-1"
            >
              Invite a team member
            </h2>

            {/* Brand safety copy — visible BEFORE email input */}
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              They can view your dashboard, content calendar, and reports.{' '}
              <span className="text-gray-500">
                They cannot change your brand voice, auto-publish settings, or
                billing.
              </span>
            </p>

            {sent ? (
              <div className="text-center py-4">
                <p className="text-green-400 font-semibold">
                  Invitation sent! ✓
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  They'll receive an email to view your dashboard.
                </p>
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendInvite()}
                  placeholder="colleague@example.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-sky-500 mb-3"
                  autoFocus
                />

                {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

                <button
                  onClick={handleSendInvite}
                  disabled={!email || isSending}
                  className="w-full bg-white text-gray-900 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? 'Sending…' : 'Send Invite'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
