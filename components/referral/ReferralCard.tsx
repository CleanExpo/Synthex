'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Users, Gift, TrendingUp } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ReferralStats {
  totalSent: number;
  signedUp: number;
  converted: number;
  rewardsEarned: number;
}

export default function ReferralCard() {
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      const res = await fetch('/api/referrals');
      const data = await res.json();
      if (data.success) {
        setReferralCode(data.referralCode);
        setReferralLink(data.referralLink);
        setStats(data.stats);
      }
    } catch {
      // Non-critical
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select input text
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();

      if (data.success) {
        setInviteEmail('');
        loadReferralData(); // Refresh stats
      } else {
        setError(data.error || 'Failed to send invite');
      }
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
          <Gift className="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Refer & Earn</h3>
          <p className="text-[10px] text-gray-500">Earn 500 AI credits per referral</p>
        </div>
      </div>

      {/* Referral link */}
      <div className="flex gap-2 mb-4">
        <Input
          value={referralLink}
          readOnly
          className="bg-white/5 border-white/10 text-xs text-gray-300"
        />
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'shrink-0 h-9 w-9',
            copied ? 'text-green-400' : 'text-gray-400 hover:text-white'
          )}
          onClick={handleCopy}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {/* Quick invite */}
      <div className="flex gap-2 mb-4">
        <Input
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="friend@email.com"
          type="email"
          className="bg-white/5 border-white/10 text-xs text-gray-300 placeholder:text-gray-600"
        />
        <Button
          size="sm"
          disabled={!inviteEmail.trim() || sending}
          onClick={handleSendInvite}
          className="shrink-0 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-xs"
        >
          {sending ? 'Sending...' : 'Invite'}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{stats.totalSent}</p>
            <p className="text-[10px] text-gray-500">Invited</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-400">{stats.signedUp}</p>
            <p className="text-[10px] text-gray-500">Signed Up</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-purple-400">{stats.rewardsEarned}</p>
            <p className="text-[10px] text-gray-500">Credits Earned</p>
          </div>
        </div>
      )}
    </div>
  );
}
