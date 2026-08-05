'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2, ListTodo } from '@/components/icons';

export function CeoReviewQueueStrip() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/agency/ceo-review-queue', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(json => setCount(json?.data?.count ?? 0))
      .catch(() => setCount(null));
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-orange-200 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
      <ListTodo className="h-3.5 w-3.5 shrink-0" />
      {count === null ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span>
          CEO review queue: <strong>{count}</strong> strategist-cleared workflow
          {count === 1 ? '' : 's'} awaiting approval —{' '}
          <Link
            href="/dashboard/workflows"
            className="underline hover:text-orange-100"
          >
            open workflows
          </Link>
        </span>
      )}
    </div>
  );
}
