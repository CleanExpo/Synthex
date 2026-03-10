'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useApprovals,
  type ApprovalRequest,
} from '@/hooks/use-approvals';
import {
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  RotateCcw,
  MessageSquare,
  FileText,
  ChevronRight,
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

function getStatusColor(status: string): string {
  switch (status) {
    case 'approved': return 'text-green-400 bg-green-500/20 border-green-500/30';
    case 'rejected': return 'text-red-400 bg-red-500/20 border-red-500/30';
    case 'pending': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    case 'in_review': return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
    case 'revision_requested': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
    default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'revision_requested': return 'Revision Requested';
    case 'in_review': return 'In Review';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'normal': return 'bg-yellow-500';
    case 'low': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
}

// ============================================================================
// REQUEST CARD COMPONENT
// ============================================================================

interface RequestCardProps {
  request: ApprovalRequest;
  onSelect: (request: ApprovalRequest) => void;
  onQuickApprove: (id: string) => void;
  isApproving: boolean;
}

function RequestCard({ request, onSelect, onQuickApprove, isApproving }: RequestCardProps) {
  const progress = ((request.currentStep + 1) / request.totalSteps) * 100;

  return (
    <Card
      className="bg-white/5 border-cyan-500/10 cursor-pointer hover:bg-white/10 transition-colors"
      onClick={() => onSelect(request)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white line-clamp-1">
              {request.title}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              by {request.submitterName || request.submitterEmail || 'Unknown'}
            </p>
          </div>
          <div className={`w-2 h-2 rounded-full ${getPriorityColor(request.priority)}`} title={`Priority: ${request.priority}`} />
        </div>

        {request.description && (
          <p className="text-sm text-gray-300 line-clamp-2 mb-3">
            {request.description}
          </p>
        )}

        {/* Progress */}
        {request.totalSteps > 1 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Step {request.currentStep + 1} of {request.totalSteps}</span>
              <span className="text-white">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Content type badge */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">
            {request.contentType}
          </Badge>
          {request.dueDate && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Due {formatRelativeTime(request.dueDate)}
            </span>
          )}
        </div>

        {/* Status & Actions */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={getStatusColor(request.status)}>
            {getStatusLabel(request.status)}
          </Badge>

          {request.status === 'pending' && (
            <Button
              size="sm"
              className="bg-green-500/20 hover:bg-green-500/30 text-green-400"
              onClick={(e) => {
                e.stopPropagation();
                onQuickApprove(request.id);
              }}
              disabled={isApproving}
            >
              {isApproving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approve
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// REQUEST DETAIL DIALOG
// ============================================================================

interface RequestDetailDialogProps {
  request: ApprovalRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string, comment?: string) => Promise<boolean>;
  onReject: (id: string, reason: string) => Promise<boolean>;
  onRequestRevision: (id: string, feedback: string) => Promise<boolean>;
  onResubmit: (id: string, comment?: string) => Promise<boolean>;
  onAddComment: (id: string, content: string) => Promise<boolean>;
}

function RequestDetailDialog({
  request,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onRequestRevision,
  onResubmit,
  onAddComment,
}: RequestDetailDialogProps) {
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!request) return null;

  const handleAction = async (action: 'approve' | 'reject' | 'revision' | 'resubmit' | 'comment') => {
    setIsSubmitting(true);
    try {
      let success = false;
      switch (action) {
        case 'approve':
          success = await onApprove(request.id, feedback || undefined);
          break;
        case 'reject':
          if (!feedback.trim()) {
            return; // Require feedback for rejection
          }
          success = await onReject(request.id, feedback);
          break;
        case 'revision':
          if (!feedback.trim()) {
            return; // Require feedback for revision
          }
          success = await onRequestRevision(request.id, feedback);
          break;
        case 'resubmit':
          success = await onResubmit(request.id, feedback || undefined);
          break;
        case 'comment':
          if (!feedback.trim()) {
            return;
          }
          success = await onAddComment(request.id, feedback);
          break;
      }
      if (success) {
        setFeedback('');
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStep = request.steps[request.currentStep];
  const showActions = request.status === 'pending' || request.status === 'in_review';
  const canResubmit = request.status === 'revision_requested';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-base/95 border-cyan-500/20 backdrop-blur-xl max-w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-white">{request.title}</DialogTitle>
              <DialogDescription className="text-gray-400">
                Submitted by {request.submitterName || request.submitterEmail} • {formatRelativeTime(request.createdAt)}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={getStatusColor(request.status)}>
              {getStatusLabel(request.status)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Content */}
          {request.description && (
            <div>
              <h4 className="font-medium text-white mb-2">Description</h4>
              <p className="text-gray-300">{request.description}</p>
            </div>
          )}

          {/* Approval Steps */}
          <div>
            <h4 className="font-medium text-white mb-3">Approval Steps</h4>
            <div className="space-y-2">
              {request.steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    step.status === 'approved' ? 'bg-green-500/10' :
                    step.status === 'rejected' ? 'bg-red-500/10' :
                    index === request.currentStep ? 'bg-cyan-500/10' :
                    'bg-white/5'
                  }`}
                >
                  <div className={`p-2 rounded-full ${
                    step.status === 'approved' ? 'bg-green-500/20' :
                    step.status === 'rejected' ? 'bg-red-500/20' :
                    index === request.currentStep ? 'bg-cyan-500/20' :
                    'bg-gray-500/20'
                  }`}>
                    {step.status === 'approved' ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : step.status === 'rejected' ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : index === request.currentStep ? (
                      <Clock className="h-4 w-4 text-cyan-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Step {index + 1}: {step.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {step.currentApprovals}/{step.requiredApprovals} approvals
                      {step.isOptional && ' • Optional'}
                    </p>
                  </div>
                  {index < request.steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Comments from current step */}
          {currentStep?.comments && currentStep.comments.length > 0 && (
            <div>
              <h4 className="font-medium text-white mb-3">Comments</h4>
              <div className="space-y-2">
                {currentStep.comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {comment.userName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-white">{comment.userName}</span>
                        <Badge variant="outline" className="text-xs">
                          {comment.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{comment.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Section */}
          {(showActions || canResubmit) && (
            <div>
              <h4 className="font-medium text-white mb-3">
                {canResubmit ? 'Resubmit' : 'Your Decision'}
              </h4>
              <Textarea
                placeholder={
                  canResubmit
                    ? 'Add a note about your changes (optional)...'
                    : 'Add feedback (optional for approval, required for rejection/revision)...'
                }
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="mb-3 bg-white/5 border-white/10"
              />
              <div className="flex flex-wrap gap-2">
                {canResubmit ? (
                  <Button
                    onClick={() => handleAction('resubmit')}
                    disabled={isSubmitting}
                    className="bg-cyan-500 hover:bg-cyan-600"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Resubmit
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => handleAction('approve')}
                      disabled={isSubmitting}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleAction('revision')}
                      disabled={isSubmitting || !feedback.trim()}
                      variant="outline"
                      className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/30"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Request Revision
                    </Button>
                    <Button
                      onClick={() => handleAction('reject')}
                      disabled={isSubmitting || !feedback.trim()}
                      variant="outline"
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleAction('comment')}
                      disabled={isSubmitting || !feedback.trim()}
                      variant="outline"
                      className="bg-white/5 hover:bg-white/10 text-gray-300 border-white/10"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Comment Only
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

function EmptyState({ filter }: { filter: string }) {
  return (
    <Card className="bg-white/5 border-cyan-500/10">
      <CardContent className="py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 mb-4">
            <FileText className="w-8 h-8 text-cyan-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {filter === 'all' ? 'No approval requests' : `No ${filter} requests`}
          </h3>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            {filter === 'all'
              ? 'When content needs review, approval requests will appear here.'
              : `There are no ${filter} approval requests at the moment.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function ApprovalsPage() {
  const { requests, loading, error, refresh, approve, reject, requestRevision, resubmit, addComment } = useApprovals();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter requests
  const filteredRequests = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter(req => req.status === filter);
  }, [requests, filter]);

  const handleQuickApprove = async (id: string) => {
    setApprovingIds((prev) => new Set(prev).add(id));
    try {
      await approve(id);
    } finally {
      setApprovingIds((prev) => {
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

  const handleSelectRequest = (request: ApprovalRequest) => {
    setSelectedRequest(request);
    setDetailDialogOpen(true);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <GitBranch className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Approvals</h1>
            <p className="text-gray-400">Content review workflows</p>
          </div>
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

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className={filter === f ? '' : 'bg-white/5 border-white/10'}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-2 text-xs opacity-60">
                {requests.filter(r => r.status === f).length}
              </span>
            )}
          </Button>
        ))}
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

      {/* Requests Grid */}
      {!loading && filteredRequests.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onSelect={handleSelectRequest}
              onQuickApprove={handleQuickApprove}
              isApproving={approvingIds.has(request.id)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredRequests.length === 0 && !error && (
        <EmptyState filter={filter} />
      )}

      {/* Detail Dialog */}
      <RequestDetailDialog
        request={selectedRequest}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onApprove={approve}
        onReject={reject}
        onRequestRevision={requestRevision}
        onResubmit={resubmit}
        onAddComment={addComment}
      />
    </div>
  );
}
