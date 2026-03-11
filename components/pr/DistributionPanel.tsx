'use client';

/**
 * PR Distribution Panel (Phase 93)
 *
 * Shows distribution channel checkboxes for a selected press release,
 * a "Distribute" button to submit, and a status list of existing
 * PRDistribution records with badges.
 *
 * For manual-submission channels (requiresManualSubmission=true):
 * - Shows instruction text + external link
 * - Shows "Mark Published" button once submitted
 *
 * @module components/pr/DistributionPanel
 */

import { useState } from 'react';
import useSWR from 'swr';
import {
  Share2,
  Loader2,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DistributionChannel {
  id: string;
  name: string;
  url: string;
  submissionUrl: string;
  isFree: boolean;
  requiresManualSubmission: boolean;
  instructions: string;
}

interface PRDistribution {
  id: string;
  releaseId: string;
  channel: string;
  channelUrl: string | null;
  status: string;
  submittedAt: string | null;
  publishedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface DistributionPanelProps {
  releaseId: string;
  /** Used to display the self-hosted newsroom public URL */
  orgSlug?: string;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

const fetchJson = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:   'bg-gray-500/10 text-gray-400 border-gray-500/20',
    submitted: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    failed:    'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const icons: Record<string, React.ReactNode> = {
    pending:   <Clock className="h-3 w-3" />,
    submitted: <Send className="h-3 w-3" />,
    published: <CheckCircle className="h-3 w-3" />,
    failed:    <AlertCircle className="h-3 w-3" />,
  };

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium', styles[status] ?? styles.pending)}>
      {icons[status] ?? <Clock className="h-3 w-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DistributionPanel({ releaseId, orgSlug }: DistributionPanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [isDistributing, setIsDistributing] = useState(false);
  const [markingPublished, setMarkingPublished] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: channelsData } = useSWR<{ channels: DistributionChannel[] }>(
    '/api/pr/channels',
    fetchJson,
  );

  const { data: distribData, mutate: mutateDistribs } = useSWR<{ distributions: PRDistribution[] }>(
    releaseId ? `/api/pr/press-releases/${releaseId}/distributions` : null,
    fetchJson,
  );

  const channels = channelsData?.channels ?? [];
  const distributions = distribData?.distributions ?? [];

  // Check if a channel has already been distributed
  const getDistribution = (channelId: string) =>
    distributions.find((d) => d.channel === channelId);

  // ---------------------------------------------------------------------------
  // Toggle channel selection
  // ---------------------------------------------------------------------------

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  // ---------------------------------------------------------------------------
  // Distribute handler
  // ---------------------------------------------------------------------------

  const handleDistribute = async () => {
    if (selectedChannels.length === 0) return;
    setIsDistributing(true);
    setError(null);

    try {
      const res = await fetch(`/api/pr/press-releases/${releaseId}/distribute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: selectedChannels }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }

      setSelectedChannels([]);
      await mutateDistribs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Distribution failed');
    } finally {
      setIsDistributing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Mark published handler
  // ---------------------------------------------------------------------------

  const handleMarkPublished = async (distributionId: string, channelUrl?: string) => {
    setMarkingPublished(distributionId);
    setError(null);

    try {
      const res = await fetch(`/api/pr/press-releases/${releaseId}/distributions`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributionId,
          status: 'published',
          channelUrl,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }

      await mutateDistribs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setMarkingPublished(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Distribute Press Release</h3>
      </div>

      {/* Channel selection */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Select Channels</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {channels.map((channel) => {
            const existing = getDistribution(channel.id);
            const isChecked = selectedChannels.includes(channel.id);

            return (
              <label
                key={channel.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
                  isChecked
                    ? 'border-cyan-500/40 bg-cyan-500/[0.06]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]',
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleChannel(channel.id)}
                  className="mt-0.5 accent-cyan-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white font-medium">{channel.name}</span>
                    {channel.isFree && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                        FREE
                      </span>
                    )}
                  </div>
                  {existing && (
                    <div className="mt-0.5">
                      <StatusBadge status={existing.status} />
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Distribute button */}
      <button
        type="button"
        onClick={handleDistribute}
        disabled={isDistributing || selectedChannels.length === 0}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-black transition-colors"
      >
        {isDistributing ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Distributing...</>
        ) : (
          <><Send className="h-4 w-4" /> Distribute to {selectedChannels.length || 0} Channel{selectedChannels.length !== 1 ? 's' : ''}</>
        )}
      </button>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Distribution status list */}
      {distributions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Distribution Status</p>
          <div className="space-y-2">
            {distributions.map((dist) => {
              const channelMeta = channels.find((c) => c.id === dist.channel);
              return (
                <div
                  key={dist.id}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-white font-medium">
                        {channelMeta?.name ?? dist.channel}
                      </p>
                      {dist.submittedAt && (
                        <p className="text-xs text-gray-500">
                          Submitted {new Date(dist.submittedAt).toLocaleDateString('en-AU')}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={dist.status} />
                  </div>

                  {/* Manual channel instructions */}
                  {channelMeta?.requiresManualSubmission && dist.status === 'submitted' && (
                    <div className="rounded-lg bg-amber-500/[0.05] border border-amber-500/20 px-3 py-2 space-y-2">
                      <p className="text-xs text-amber-300/80">{channelMeta.instructions}</p>
                      <div className="flex items-center gap-3">
                        {channelMeta.submissionUrl && (
                          <a
                            href={channelMeta.submissionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open submission page
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={markingPublished === dist.id}
                          onClick={() => handleMarkPublished(dist.id)}
                          className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                        >
                          {markingPublished === dist.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          Mark as Published
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Published channel URL */}
                  {dist.channelUrl && dist.status === 'published' && (
                    <a
                      href={dist.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View published release
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
