'use client';

/**
 * Admin: GEO Citation Events — SYN-584 (silent dark run).
 *
 * Read-only admin view of accumulated Google AI Overview brand-mention data.
 * Protected by /dashboard/admin/layout.tsx (owner-only) and the
 * /api/admin/geo-citations gate. ZERO client-facing exposure — this is an
 * internal baseline monitor; the client-facing UI is a later sprint.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';

interface CitationRow {
  id: string;
  userId: string;
  userEmail: string | null;
  queryText: string;
  queryVariant: number;
  searchEngine: string;
  queryDate: string;
  brandMentioned: boolean;
  mentionPosition: number | null;
  rawSnippet: string | null;
  errorReason: string | null;
}

interface CitationsData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: CitationRow[];
}

const ENGINE_OPTIONS = [
  { label: 'All engines', value: '' },
  { label: 'Google AI Overview', value: 'google_ai_overview' },
  { label: 'ChatGPT', value: 'chatgpt' },
  { label: 'Perplexity', value: 'perplexity' },
];

const MENTIONED_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Mentioned', value: 'true' },
  { label: 'Not mentioned', value: 'false' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  // DD/MM/YYYY — Australian format
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function GeoCitationsPage() {
  const [userId, setUserId] = useState('');
  const [engine, setEngine] = useState('');
  const [mentioned, setMentioned] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (engine) params.set('engine', engine);
  if (mentioned) params.set('mentioned', mentioned);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('page', String(page));

  const { data, isLoading, error } = useSWR<CitationsData>(
    `/api/admin/geo-citations?${params.toString()}`,
    fetchJson,
    { refreshInterval: 300_000 }
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">GEO Citation Events</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Silent baseline monitor (SYN-584). Accumulated AI-search brand-mention
          checks. Internal, admin-only — not shown to clients.
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={e => {
            setUserId(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-sm rounded-lg bg-zinc-900 border border-white/10 text-white placeholder-gray-500"
        />
        <select
          value={engine}
          onChange={e => {
            setEngine(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-sm rounded-lg bg-zinc-900 border border-white/10 text-white"
        >
          {ENGINE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={mentioned}
          onChange={e => {
            setMentioned(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-sm rounded-lg bg-zinc-900 border border-white/10 text-white"
        >
          {MENTIONED_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={e => {
            setFrom(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-sm rounded-lg bg-zinc-900 border border-white/10 text-white"
          aria-label="From date"
        />
        <input
          type="date"
          value={to}
          onChange={e => {
            setTo(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-sm rounded-lg bg-zinc-900 border border-white/10 text-white"
          aria-label="To date"
        />
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : error ? (
        <div className="text-red-400 text-sm">
          Failed to load GEO citation events.
        </div>
      ) : !data ? null : (
        <>
          <div className="text-xs text-gray-500">
            {data.total} event{data.total === 1 ? '' : 's'} · page {data.page} of{' '}
            {Math.max(1, data.totalPages)}
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-900 text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">User</th>
                  <th className="px-3 py-2 text-left font-medium">Query</th>
                  <th className="px-3 py-2 text-left font-medium">Variant</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Mentioned</th>
                  <th className="px-3 py-2 text-left font-medium">Snippet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      No events match these filters.
                    </td>
                  </tr>
                ) : (
                  data.rows.map(row => (
                    <tr key={row.id} className="text-gray-300">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.userEmail ?? row.userId}
                      </td>
                      <td className="px-3 py-2">{row.queryText}</td>
                      <td className="px-3 py-2">V{row.queryVariant}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(row.queryDate)}
                      </td>
                      <td className="px-3 py-2">
                        {row.brandMentioned ? (
                          <span className="text-green-400">Yes</span>
                        ) : row.errorReason ? (
                          <span
                            className="text-amber-400"
                            title={row.errorReason}
                          >
                            —
                          </span>
                        ) : (
                          <span className="text-gray-500">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-md truncate text-gray-400">
                        {row.rawSnippet ?? row.errorReason ?? ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={data.page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-white/5"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={data.page >= data.totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-white/5"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
