'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActivity, type ActivityItem, type ActivityFilter } from '@/hooks/use-activity';
import { useShares, type ContentShare, type ShareFilter } from '@/hooks/use-shares';
import {
  MessageSquare,
  Activity,
  Share2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Edit,
  Users,
  FileText,
  Calendar,
  TrendingUp,
  Send,
  Trash2,
  Bell,
  User,
  ExternalLink,
} from '@/components/icons';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'post_created':
      return <Edit className="h-4 w-4 text-blue-400" />;
    case 'post_published':
      return <Send className="h-4 w-4 text-green-400" />;
    case 'post_scheduled':
      return <Calendar className="h-4 w-4 text-cyan-400" />;
    case 'post_edited':
      return <Edit className="h-4 w-4 text-yellow-400" />;
    case 'post_deleted':
      return <Trash2 className="h-4 w-4 text-red-400" />;
    case 'engagement_spike':
      return <TrendingUp className="h-4 w-4 text-green-400" />;
    case 'new_follower':
      return <User className="h-4 w-4 text-blue-400" />;
    case 'comment_received':
    case 'comment':
      return <MessageSquare className="h-4 w-4 text-cyan-400" />;
    case 'mention':
      return <Bell className="h-4 w-4 text-yellow-400" />;
    case 'team_member_joined':
      return <Users className="h-4 w-4 text-green-400" />;
    case 'team_member_action':
      return <Activity className="h-4 w-4 text-blue-400" />;
    case 'system_alert':
      return <AlertTriangle className="h-4 w-4 text-orange-400" />;
    case 'campaign_started':
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    case 'campaign_ended':
      return <CheckCircle className="h-4 w-4 text-gray-400" />;
    case 'milestone_reached':
      return <TrendingUp className="h-4 w-4 text-yellow-400" />;
    default:
      return <Activity className="h-4 w-4 text-gray-400" />;
  }
}

function getActivityColor(type: string): string {
  switch (type) {
    case 'post_created':
    case 'new_follower':
    case 'team_member_action':
      return 'border-blue-500/30 bg-blue-500/10';
    case 'post_published':
    case 'engagement_spike':
    case 'team_member_joined':
    case 'campaign_started':
      return 'border-green-500/30 bg-green-500/10';
    case 'post_scheduled':
    case 'comment_received':
    case 'comment':
      return 'border-cyan-500/30 bg-cyan-500/10';
    case 'post_edited':
    case 'mention':
    case 'milestone_reached':
      return 'border-yellow-500/30 bg-yellow-500/10';
    case 'post_deleted':
      return 'border-red-500/30 bg-red-500/10';
    case 'system_alert':
      return 'border-orange-500/30 bg-orange-500/10';
    case 'campaign_ended':
      return 'border-gray-500/30 bg-gray-500/10';
    default:
      return 'border-gray-500/30 bg-gray-500/10';
  }
}

function getPermissionBadge(permission: string) {
  switch (permission) {
    case 'admin':
      return <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Admin</Badge>;
    case 'edit':
      return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Edit</Badge>;
    case 'comment':
      return <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">Comment</Badge>;
    case 'view':
    default:
      return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/30">View</Badge>;
  }
}

// ============================================================================
// ACTIVITY TAB COMPONENT
// ============================================================================

function ActivityTab() {
  const { activities, loading, error, hasMore, refresh, loadMore } = useActivity({ limit: 20 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="bg-white/5 border-cyan-500/10">
        <CardContent className="py-16">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 mb-4">
              <Activity className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No recent activity</h3>
            <p className="text-gray-400 max-w-sm mx-auto">
              Start creating content to see team updates here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="border-white/10 hover:bg-white/5"
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="space-y-2">
        {activities.map((activity) => (
          <Card
            key={activity.id}
            className="bg-white/5 border-cyan-500/10 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 p-2 rounded-lg border ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white">{activity.title}</p>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{activity.description}</p>
                  {activity.platform && (
                    <Badge variant="outline" className="mt-2 text-xs capitalize bg-white/5">
                      {activity.platform}
                    </Badge>
                  )}
                </div>
                {activity.userAvatar && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{activity.userName?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
            className="border-white/10 hover:bg-white/5"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMMENTS TAB COMPONENT
// ============================================================================

function CommentsTab() {
  // Comments hook requires contentType and contentId
  // For the collaboration view, we'll show a placeholder with guidance
  // In a real implementation, we'd have a separate API endpoint for "all comments"

  return (
    <Card className="bg-white/5 border-cyan-500/10">
      <CardContent className="py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 mb-4">
            <MessageSquare className="w-8 h-8 text-cyan-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No comments yet</h3>
          <p className="text-gray-400 max-w-sm mx-auto">
            Start collaborating on content to see comments here. Open any content item to view and add comments.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SHARES TAB COMPONENT
// ============================================================================

function SharesTab() {
  const [shareFilter, setShareFilter] = useState<'sharedWithMe' | 'sharedByMe'>('sharedWithMe');
  const filter: ShareFilter = shareFilter === 'sharedWithMe' ? { sharedWithMe: true } : { sharedByMe: true };
  const { shares, loading, error, refresh, revoke } = useShares(filter);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await revoke(id);
    } finally {
      setRevokingId(null);
    }
  };

  if (loading && shares.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={shareFilter === 'sharedWithMe' ? 'default' : 'outline'}
            onClick={() => setShareFilter('sharedWithMe')}
            className={shareFilter !== 'sharedWithMe' ? 'bg-white/5 border-white/10' : ''}
          >
            Shared with me
          </Button>
          <Button
            size="sm"
            variant={shareFilter === 'sharedByMe' ? 'default' : 'outline'}
            onClick={() => setShareFilter('sharedByMe')}
            className={shareFilter !== 'sharedByMe' ? 'bg-white/5 border-white/10' : ''}
          >
            Shared by me
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="border-white/10 hover:bg-white/5"
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {shares.length === 0 ? (
        <Card className="bg-white/5 border-cyan-500/10">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 mb-4">
                <Share2 className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Nothing shared yet</h3>
              <p className="text-gray-400 max-w-sm mx-auto">
                {shareFilter === 'sharedWithMe'
                  ? 'Content shared with you will appear here.'
                  : 'Share content with team members to see it here.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shares.map((share) => (
            <Card
              key={share.id}
              className="bg-white/5 border-cyan-500/10 hover:bg-white/10 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                      <FileText className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white capitalize">
                        {share.contentType}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatRelativeTime(share.createdAt)}
                      </p>
                    </div>
                  </div>
                  {getPermissionBadge(share.permission)}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {share.viewCount} views
                  </span>
                  {share.canDownload && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      Download
                    </span>
                  )}
                  {share.canReshare && (
                    <span className="flex items-center gap-1">
                      <Share2 className="w-3 h-3 text-blue-400" />
                      Reshare
                    </span>
                  )}
                </div>

                {share.expiresAt && (
                  <div className="flex items-center gap-1 text-xs text-orange-400 mb-3">
                    <Clock className="w-3 h-3" />
                    Expires {formatRelativeTime(share.expiresAt)}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {share.accessLink && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 bg-white/5 border-white/10 hover:bg-white/10"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open
                    </Button>
                  )}
                  {shareFilter === 'sharedByMe' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                      onClick={() => handleRevoke(share.id)}
                      disabled={revokingId === share.id}
                    >
                      {revokingId === share.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Revoke'
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

type TabType = 'activity' | 'comments' | 'shares';

export default function CollaborationPage() {
  const [activeTab, setActiveTab] = useState<TabType>('activity');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
    { id: 'comments', label: 'Comments', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'shares', label: 'Shares', icon: <Share2 className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <Users className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Team Collaboration</h1>
            <p className="text-gray-400">Activity feed, comments, and shared content</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? '' : 'bg-white/5 border-white/10'}
          >
            {tab.icon}
            <span className="ml-2">{tab.label}</span>
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'activity' && <ActivityTab />}
      {activeTab === 'comments' && <CommentsTab />}
      {activeTab === 'shares' && <SharesTab />}
    </div>
  );
}
