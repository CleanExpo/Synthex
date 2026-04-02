'use client';

/**
 * /invite/accept?token=<invitationId>
 *
 * One-click accept page linked from the team invite email.
 * Requires the user to be signed in (redirected to /login if not).
 * On accept, sets synthex_role cookie and redirects to /welcome.
 *
 * @task SYN-598
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fireTeamEvent } from '@/lib/analytics/team-events';

interface AcceptResponse {
  accepted?: boolean;
  organizationName?: string;
  ownerName?: string;
  redirectTo?: string;
  error?: string;
}

/** Suspense wrapper required by Next.js 15 for useSearchParams() */
export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-950">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  );
}

function InviteAcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'idle' | 'accepting' | 'done' | 'error'>('idle');
  const [orgName, setOrgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-accept on mount if token is present
  useEffect(() => {
    if (!token || status !== 'idle') return;
    handleAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAccept() {
    if (!token) {
      setStatus('error');
      setErrorMsg('Invalid invitation link — token is missing.');
      return;
    }

    setStatus('accepting');

    const res = await fetch('/api/invite/accept', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data: AcceptResponse = await res.json().catch(() => ({}));

    if (!res.ok) {
      // 401 = not logged in → redirect to login
      if (res.status === 401) {
        router.push(`/login?redirect=/invite/accept?token=${encodeURIComponent(token)}`);
        return;
      }
      setStatus('error');
      setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
      return;
    }

    setOrgName(data.organizationName ?? '');
    setOwnerName(data.ownerName ?? '');
    setStatus('done');

    fireTeamEvent('team_invite_accepted' as never);

    // Small delay so user sees the success state before redirect
    setTimeout(() => {
      router.push('/welcome');
    }, 1500);
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <p className="text-red-400 text-sm">Invalid invitation link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 w-full max-w-md text-center">
        {status === 'accepting' || status === 'idle' ? (
          <>
            <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Accepting your invitation…</p>
          </>
        ) : status === 'done' ? (
          <>
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-lg font-bold text-white mb-2">
              You're in!
            </h1>
            <p className="text-sm text-gray-400">
              {ownerName} added you to {orgName}'s dashboard. Redirecting…
            </p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">⚠</div>
            <h1 className="text-lg font-bold text-white mb-2">
              Could not accept invite
            </h1>
            <p className="text-sm text-red-400">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
