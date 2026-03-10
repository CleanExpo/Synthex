'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useWebhooks,
  type WebhookEndpoint,
  type WebhookEndpointWithSecret,
  type CreateWebhookData,
} from '@/hooks/use-webhooks';
import {
  Link2,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  Clock,
} from '@/components/icons';

// ============================================================================
// EVENT CATEGORIES
// ============================================================================

interface EventCategory {
  name: string;
  events: string[];
}

const EVENT_CATEGORIES: EventCategory[] = [
  {
    name: 'User',
    events: ['user.created', 'user.updated', 'user.deleted'],
  },
  {
    name: 'Content',
    events: [
      'content.created',
      'content.updated',
      'content.published',
      'content.scheduled',
      'content.failed',
      'content.deleted',
    ],
  },
  {
    name: 'Campaign',
    events: [
      'campaign.created',
      'campaign.started',
      'campaign.completed',
      'campaign.paused',
      'campaign.deleted',
    ],
  },
  {
    name: 'Team',
    events: ['team.member.added', 'team.member.removed'],
  },
  {
    name: 'Subscription',
    events: [
      'subscription.created',
      'subscription.updated',
      'subscription.cancelled',
      'subscription.payment.succeeded',
      'subscription.payment.failed',
    ],
  },
  {
    name: 'Integration',
    events: ['integration.connected', 'integration.disconnected'],
  },
  {
    name: 'Analytics',
    events: ['analytics.report.ready', 'analytics.alert.triggered'],
  },
  {
    name: 'System',
    events: ['webhook.test', 'webhook.ping'],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength - 3) + '...';
}

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

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================================================
// WEBHOOK CARD COMPONENT
// ============================================================================

interface WebhookCardProps {
  webhook: WebhookEndpoint;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
}

function WebhookCard({ webhook, onToggle, onDelete, isUpdating, isDeleting }: WebhookCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete(webhook.id);
    setConfirmDelete(false);
  };

  return (
    <Card className="bg-white/5 border-cyan-500/10">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* URL */}
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-white font-medium truncate" title={webhook.url}>
                {truncateUrl(webhook.url)}
              </span>
            </div>

            {/* Description */}
            {webhook.description && (
              <p className="text-sm text-gray-400 mb-3">{webhook.description}</p>
            )}

            {/* Event badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {webhook.events.slice(0, 5).map((event) => (
                <Badge
                  key={event}
                  variant="outline"
                  className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs"
                >
                  {event}
                </Badge>
              ))}
              {webhook.events.length > 5 && (
                <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">
                  +{webhook.events.length - 5} more
                </Badge>
              )}
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last delivered: {formatRelativeTime(webhook.lastDeliveredAt)}
              </span>
              {webhook.failureCount > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertTriangle className="w-3 h-3" />
                  {webhook.failureCount} failures
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{webhook.active ? 'Active' : 'Inactive'}</span>
              <Switch
                checked={webhook.active}
                onCheckedChange={(checked) => onToggle(webhook.id, checked)}
                disabled={isUpdating}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className={confirmDelete ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-gray-400 hover:text-white'}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {confirmDelete && <span className="ml-1">Confirm?</span>}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE WEBHOOK DIALOG
// ============================================================================

interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateWebhookData) => Promise<WebhookEndpointWithSecret | null>;
  availableEvents: string[];
}

function CreateWebhookDialog({ open, onOpenChange, onSubmit, availableEvents }: CreateWebhookDialogProps) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [secret, setSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  // Filter categories to only include available events
  const filteredCategories = useMemo(() => {
    return EVENT_CATEGORIES.map((cat) => ({
      ...cat,
      events: cat.events.filter((e) => availableEvents.includes(e)),
    })).filter((cat) => cat.events.length > 0);
  }, [availableEvents]);

  const resetForm = () => {
    setUrl('');
    setDescription('');
    setSelectedEvents(new Set());
    setSecret('');
    setError(null);
    setCreatedSecret(null);
    setSecretCopied(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onOpenChange(false);
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) {
        next.delete(event);
      } else {
        next.add(event);
      }
      return next;
    });
  };

  const selectAllInCategory = (events: string[]) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      events.forEach((e) => next.add(e));
      return next;
    });
  };

  const deselectAllInCategory = (events: string[]) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      events.forEach((e) => next.delete(e));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!url.trim()) {
      setError('URL is required');
      return;
    }
    if (!isValidUrl(url)) {
      setError('Please enter a valid HTTP or HTTPS URL');
      return;
    }
    if (selectedEvents.size === 0) {
      setError('Please select at least one event');
      return;
    }

    setIsSubmitting(true);

    try {
      const data: CreateWebhookData = {
        url: url.trim(),
        events: Array.from(selectedEvents),
        description: description.trim() || undefined,
        secret: secret.trim() || undefined,
      };

      const result = await onSubmit(data);

      if (result) {
        // Show the secret after successful creation
        setCreatedSecret(result.secret);
      } else {
        setError('Failed to create webhook. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copySecret = async () => {
    if (createdSecret) {
      await navigator.clipboard.writeText(createdSecret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  };

  const handleDone = () => {
    resetForm();
    onOpenChange(false);
  };

  // If secret was just created, show the success view
  if (createdSecret) {
    return (
      <Dialog open={open} onOpenChange={handleDone}>
        <DialogContent className="bg-surface-base/95 border-cyan-500/20 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              Webhook Created
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Your webhook has been created successfully.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-200 font-medium text-sm">Save this secret</p>
                  <p className="text-amber-300/70 text-xs mt-1">
                    This secret will not be shown again. Copy it now and store it securely.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Webhook Secret</Label>
              <div className="flex gap-2">
                <Input
                  value={createdSecret}
                  readOnly
                  className="bg-white/5 border-white/10 text-white font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copySecret}
                  className="flex-shrink-0 border-white/10 hover:bg-white/10"
                >
                  {secretCopied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleDone} className="gradient-primary text-white">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-surface-base/95 border-cyan-500/20 backdrop-blur-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Create Webhook</DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure a webhook to receive real-time event notifications.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* URL Field */}
          <div className="space-y-2">
            <Label htmlFor="url" className="text-gray-300">
              Endpoint URL <span className="text-red-400">*</span>
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://your-server.com/webhooks"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-gray-300">
              Description <span className="text-gray-500">(optional)</span>
            </Label>
            <Input
              id="description"
              placeholder="e.g., Production webhook for CRM sync"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Secret Field */}
          <div className="space-y-2">
            <Label htmlFor="secret" className="text-gray-300">
              Secret <span className="text-gray-500">(optional - auto-generated if empty)</span>
            </Label>
            <Input
              id="secret"
              type="password"
              placeholder="Leave empty to auto-generate"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Events Selection */}
          <div className="space-y-4">
            <Label className="text-gray-300">
              Events <span className="text-red-400">*</span>
            </Label>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {filteredCategories.map((category) => {
                const allSelected = category.events.every((e) => selectedEvents.has(e));
                const someSelected = category.events.some((e) => selectedEvents.has(e));

                return (
                  <div key={category.name} className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white">{category.name}</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => selectAllInCategory(category.events)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 h-auto py-1 px-2"
                          disabled={allSelected}
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => deselectAllInCategory(category.events)}
                          className="text-xs text-gray-400 hover:text-white h-auto py-1 px-2"
                          disabled={!someSelected}
                        >
                          Deselect All
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {category.events.map((event) => (
                        <label
                          key={event}
                          className="flex items-center gap-2 cursor-pointer text-sm text-gray-300 hover:text-white"
                        >
                          <Checkbox
                            checked={selectedEvents.has(event)}
                            onCheckedChange={() => toggleEvent(event)}
                          />
                          <span className="font-mono text-xs">{event}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-gray-500">
              {selectedEvents.size} event{selectedEvents.size !== 1 ? 's' : ''} selected
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary text-white" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Webhook'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <Card className="bg-white/5 border-cyan-500/10">
      <CardContent className="py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 mb-4">
            <Link2 className="w-8 h-8 text-cyan-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No webhooks configured</h3>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            Create a webhook to receive real-time notifications when events happen in your account.
          </p>
          <Button onClick={onCreateClick} className="gradient-primary text-white">
            <Plus className="w-4 h-4 mr-2" />
            Create Webhook
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function WebhooksPage() {
  const { webhooks, availableEvents, loading, error, create, update, remove, refresh } = useWebhooks();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleToggle = async (id: string, active: boolean) => {
    setUpdatingIds((prev) => new Set(prev).add(id));
    try {
      await update(id, { active });
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await remove(id);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreate = async (data: CreateWebhookData) => {
    return await create(data);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Webhooks</h1>
          <p className="text-gray-400">
            Send real-time event notifications to external systems
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button onClick={() => setCreateDialogOpen(true)} className="gradient-primary text-white">
            <Plus className="w-4 h-4 mr-2" />
            Create Webhook
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30 mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      )}

      {/* Webhooks List */}
      {!loading && webhooks.length > 0 && (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <WebhookCard
              key={webhook.id}
              webhook={webhook}
              onToggle={handleToggle}
              onDelete={handleDelete}
              isUpdating={updatingIds.has(webhook.id)}
              isDeleting={deletingIds.has(webhook.id)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && webhooks.length === 0 && !error && (
        <EmptyState onCreateClick={() => setCreateDialogOpen(true)} />
      )}

      {/* Create Dialog */}
      <CreateWebhookDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreate}
        availableEvents={availableEvents}
      />
    </div>
  );
}
