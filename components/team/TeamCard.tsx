'use client';

/**
 * TeamCard — Owner dashboard team engagement card (SYN-599)
 *
 * Shown only when ≥1 accepted team member exists.
 * Self-hides completely when the team is empty — zero impact on solo-user experience.
 *
 * Shows:
 *  - Each member's name, role, and last-active engagement summary
 *  - "Invite another member" secondary CTA for expansion
 *
 * @task SYN-599
 */

import useSWR from 'swr';
import { Users, UserPlus, Clock } from 'lucide-react';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

interface TeamMemberSummary {
  id: string;
  name: string | null;
  email: string;
  role: string;
  lastActiveAt: string | null;
}

interface TeamCardData {
  members: TeamMemberSummary[];
}

/** Returns "Active this week", "Last seen X days ago", or "Never logged in" */
function engagementSummary(lastActiveAt: string | null): string {
  if (!lastActiveAt) return 'Never logged in';
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return 'Active this week';
  if (diffDays === 1) return 'Last seen yesterday';
  return `Last seen ${diffDays} days ago`;
}

function engagementColour(lastActiveAt: string | null): string {
  if (!lastActiveAt) return 'text-gray-500';
  const diffDays = Math.floor(
    (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 7) return 'text-emerald-400';
  if (diffDays <= 30) return 'text-amber-400';
  return 'text-gray-500';
}

const ROLE_LABELS: Record<string, string> = {
  collaborator: 'Collaborator',
  viewer: 'Viewer',
};

export function TeamCard() {
  const { data, isLoading } = useSWR<TeamCardData>(
    '/api/teams/team-card',
    fetchJson,
    { revalidateOnFocus: false }
  );

  // AC #7: zero impact on solo-user experience — hide entirely when no members
  if (isLoading || !data || data.members.length === 0) return null;

  const { members } = data;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-white">Team</h3>
          <span className="text-xs px-1.5 py-0.5 rounded bg-sky-900/40 text-sky-400 border border-sky-800">
            {members.length}
          </span>
        </div>
        <a
          href="/dashboard/team"
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          View all →
        </a>
      </div>

      {/* Member list */}
      <ul className="space-y-3">
        {members.map(member => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-4"
          >
            {/* Avatar + name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-gray-300 uppercase">
                  {(member.name ?? member.email).charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {member.name ?? member.email}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {ROLE_LABELS[member.role] ?? member.role}
                </p>
              </div>
            </div>

            {/* Engagement summary */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Clock className={`w-3 h-3 ${engagementColour(member.lastActiveAt)}`} />
              <span className={`text-xs ${engagementColour(member.lastActiveAt)}`}>
                {engagementSummary(member.lastActiveAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Invite another member CTA (AC #4) */}
      <div className="pt-1 border-t border-gray-800">
        <a
          href="/dashboard/team?action=invite"
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-sky-400 transition-colors group"
        >
          <UserPlus className="w-3.5 h-3.5 group-hover:text-sky-400" />
          Invite another member
        </a>
      </div>
    </div>
  );
}
