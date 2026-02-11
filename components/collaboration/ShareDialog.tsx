/**
 * Share Dialog Component
 *
 * @description Modal for sharing content with team members, external users, or via link:
 * - Share with specific users or teams
 * - Invite by email
 * - Generate shareable links
 * - Set permissions (view, comment, edit, admin)
 * - Configure expiration and access limits
 *
 * Usage:
 * ```tsx
 * <ShareDialog
 *   isOpen={showShare}
 *   onClose={() => setShowShare(false)}
 *   contentType="campaign"
 *   contentId="abc123"
 *   contentTitle="Q1 Marketing Campaign"
 * />
 * ```
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Link2, Mail, Users, Shield, Clock, Eye, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useContentShare, type ContentShare, type Permission, type ContentType } from '@/hooks/useContentShare';

// ============================================================================
// TYPES
// ============================================================================

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: ContentType;
  contentId: string;
  contentTitle?: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PERMISSION_OPTIONS: { value: Permission; label: string; description: string }[] = [
  { value: 'view', label: 'View', description: 'Can view content' },
  { value: 'comment', label: 'Comment', description: 'Can view and add comments' },
  { value: 'edit', label: 'Edit', description: 'Can view, comment, and edit' },
  { value: 'admin', label: 'Admin', description: 'Full access including sharing' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ShareDialog({
  isOpen,
  onClose,
  contentType,
  contentId,
  contentTitle,
}: ShareDialogProps) {
  const { shares, shareContent, revokeShare, isLoading, getShareUrl } = useContentShare({
    contentType,
    contentId,
    autoLoad: isOpen,
  });

  const [activeTab, setActiveTab] = useState<'people' | 'link'>('people');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<Permission>('view');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Link sharing options
  const [linkPermission, setLinkPermission] = useState<Permission>('view');
  const [linkExpiration, setLinkExpiration] = useState<string>('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkMaxViews, setLinkMaxViews] = useState<string>('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  /**
   * Search for team members
   */
  const searchTeamMembers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setTeamMembers([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/teams/members/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.members || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Debounced search
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchTeamMembers(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchTeamMembers]);

  /**
   * Share with a user
   */
  const handleShareWithUser = async (user: TeamMember) => {
    const result = await shareContent({
      sharedWithUserId: user.id,
      permission: selectedPermission,
    });

    if (result) {
      setSearchQuery('');
      setTeamMembers([]);
    }
  };

  /**
   * Share via email
   */
  const handleShareByEmail = async () => {
    if (!searchQuery.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    const result = await shareContent({
      sharedWithEmail: searchQuery,
      permission: selectedPermission,
      createLink: true,
    });

    if (result) {
      setSearchQuery('');
    }
  };

  /**
   * Generate shareable link
   */
  const handleGenerateLink = async () => {
    const result = await shareContent({
      createLink: true,
      permission: linkPermission,
      expiresAt: linkExpiration || undefined,
      password: linkPassword || undefined,
      maxViews: linkMaxViews ? parseInt(linkMaxViews, 10) : undefined,
    });

    if (result?.shareUrl) {
      setGeneratedLink(result.shareUrl);
    }
  };

  /**
   * Copy link to clipboard
   */
  const handleCopyLink = async (link: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id || 'main');
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  /**
   * Revoke a share
   */
  const handleRevoke = async (shareId: string) => {
    if (confirm('Are you sure you want to revoke this share?')) {
      await revokeShare(shareId);
    }
  };

  /**
   * Format expiration date
   */
  const formatExpiration = (date?: Date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">Share</h2>
            {contentTitle && (
              <p className="text-sm text-white/60 truncate max-w-[300px]">{contentTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('people')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'people'
                ? 'text-white border-b-2 border-cyan-500'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-2" />
            People
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'link'
                ? 'text-white border-b-2 border-cyan-500'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Link2 className="w-4 h-4 inline-block mr-2" />
            Link
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'people' ? (
            <>
              {/* Search/Email Input */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search people or enter email..."
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-white/40 animate-spin" />
                    )}
                  </div>
                  <select
                    value={selectedPermission}
                    onChange={(e) => setSelectedPermission(e.target.value as Permission)}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
                  >
                    {PERMISSION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Results */}
                {teamMembers.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-lg divide-y divide-white/10">
                    {teamMembers.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => handleShareWithUser(member)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-500 flex items-center justify-center text-white text-sm font-medium">
                          {member.name?.charAt(0) || member.email.charAt(0)}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm text-white">{member.name || member.email}</p>
                          {member.name && (
                            <p className="text-xs text-white/50">{member.email}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Email invite option */}
                {searchQuery.includes('@') && teamMembers.length === 0 && !isSearching && (
                  <button
                    onClick={handleShareByEmail}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <Mail className="w-5 h-5 text-cyan-500" />
                    <span className="text-sm text-white">
                      Invite <strong>{searchQuery}</strong> via email
                    </span>
                  </button>
                )}
              </div>

              {/* Current Shares */}
              {shares.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-white/60">Shared with</h3>
                  <div className="space-y-2">
                    {shares.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-500 flex items-center justify-center text-white text-sm">
                          {share.sharedWithEmail?.charAt(0) || share.sharedWithUserId?.charAt(0) || 'L'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">
                            {share.sharedWithEmail || share.sharedWithUserId || 'Link share'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-white/50">
                            <Shield className="w-3 h-3" />
                            <span className="capitalize">{share.permission}</span>
                            {share.expiresAt && (
                              <>
                                <Clock className="w-3 h-3 ml-2" />
                                <span>{formatExpiration(share.expiresAt)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {share.accessLink && (
                            <button
                              onClick={() => handleCopyLink(getShareUrl(share) || '', share.id)}
                              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                              {copiedId === share.id ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleRevoke(share.id)}
                            className="p-2 text-white/60 hover:text-red-500 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Link Sharing Options */}
              <div className="space-y-4">
                {/* Permission */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Permission</label>
                  <select
                    value={linkPermission}
                    onChange={(e) => setLinkPermission(e.target.value as Permission)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {PERMISSION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} - {opt.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Expiration */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Expiration (optional)</label>
                  <input
                    type="datetime-local"
                    value={linkExpiration}
                    onChange={(e) => setLinkExpiration(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Password (optional)</label>
                  <input
                    type="password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                {/* Max Views */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Max views (optional)</label>
                  <input
                    type="number"
                    value={linkMaxViews}
                    onChange={(e) => setLinkMaxViews(e.target.value)}
                    placeholder="Unlimited"
                    min="1"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerateLink}
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                  ) : (
                    'Generate Link'
                  )}
                </button>

                {/* Generated Link */}
                {generatedLink && (
                  <div className="p-4 bg-white/5 border border-cyan-500/30 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-cyan-500" />
                      <span className="text-sm font-medium text-white">Shareable Link</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={generatedLink}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                      <button
                        onClick={() => handleCopyLink(generatedLink, 'main')}
                        className="px-4 py-2 bg-cyan-500/20 text-cyan-500 rounded-lg hover:bg-cyan-500/30 transition-colors"
                      >
                        {copiedId === 'main' ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing Link Shares */}
                {shares.filter(s => s.accessLink && !s.sharedWithUserId && !s.sharedWithEmail).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-white/60">Active Links</h3>
                    {shares
                      .filter(s => s.accessLink && !s.sharedWithUserId && !s.sharedWithEmail)
                      .map((share) => (
                        <div
                          key={share.id}
                          className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Link2 className="w-4 h-4 text-cyan-500" />
                            <div>
                              <p className="text-sm text-white capitalize">{share.permission} access</p>
                              <div className="flex items-center gap-2 text-xs text-white/50">
                                <Eye className="w-3 h-3" />
                                <span>{share.viewCount} views</span>
                                {share.expiresAt && (
                                  <>
                                    <Clock className="w-3 h-3 ml-2" />
                                    <span>Expires {formatExpiration(share.expiresAt)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopyLink(getShareUrl(share) || '', share.id)}
                              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                              {copiedId === share.id ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleRevoke(share.id)}
                              className="p-2 text-white/60 hover:text-red-500 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShareDialog;
