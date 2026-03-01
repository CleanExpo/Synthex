'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Clock, Circle, ChevronRight, RotateCcw } from '@/components/icons';
import type { ApprovalRequest, User } from './types';
import { getStatusColor } from './types';

interface RequestDetailProps {
  request: ApprovalRequest;
  currentUser: User;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onRequestRevision: (requestId: string) => void;
}

export function RequestDetail({
  request,
  currentUser,
  feedback,
  onFeedbackChange,
  onApprove,
  onReject,
  onRequestRevision,
}: RequestDetailProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{request.title}</CardTitle>
            <CardDescription>
              Requested by {request.requester.name} &bull; {request.requester.role}
            </CardDescription>
          </div>
          <Badge
            variant={request.status === 'approved' ? 'default' : 'secondary'}
            className={getStatusColor(request.status)}
          >
            {request.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Content */}
        <div>
          <h4 className="font-medium text-white mb-2">Content</h4>
          <p className="text-gray-300">{request.content}</p>
        </div>

        {/* Approval Stages */}
        {request.stages.length > 0 && (
          <div>
            <h4 className="font-medium text-white mb-3">Approval Stages</h4>
            <div className="space-y-3">
              {request.stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    stage.status === 'completed' ? 'bg-green-500/10' :
                    stage.status === 'in_progress' ? 'bg-yellow-500/10' :
                    'bg-white/5'
                  }`}
                >
                  <div className={`p-2 rounded-full ${
                    stage.status === 'completed' ? 'bg-green-500/20' :
                    stage.status === 'in_progress' ? 'bg-yellow-500/20' :
                    'bg-gray-500/20'
                  }`}>
                    {stage.status === 'completed' ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : stage.status === 'in_progress' ? (
                      <Clock className="h-4 w-4 text-yellow-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Stage {index + 1}: {stage.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {stage.requireAll ? 'All approvers required' : 'Any approver'}
                    </p>
                  </div>
                  {index < request.stages.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approvers */}
        <div>
          <h4 className="font-medium text-white mb-3">Approvers</h4>
          <div className="space-y-2">
            {request.approvers.map(approver => (
              <div key={approver.id} className="flex items-center justify-between p-2 bg-white/5 rounded">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{approver.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">{approver.name}</p>
                    <p className="text-xs text-gray-400">{approver.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {approver.required && (
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  )}
                  <Badge
                    variant={approver.status === 'approved' ? 'default' : 'secondary'}
                    className={getStatusColor(approver.status)}
                  >
                    {approver.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback Section */}
        {request.status === 'pending' &&
         request.approvers.some(a => a.id === currentUser.id && a.status === 'pending') && (
          <div>
            <h4 className="font-medium text-white mb-3">Your Decision</h4>
            <Textarea
              placeholder="Add feedback (optional for approval, required for rejection)..."
              value={feedback}
              onChange={(e) => onFeedbackChange(e.target.value)}
              className="mb-3 bg-white/5 border-white/10"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => onApprove(request.id)}
                className="bg-green-500 hover:bg-green-600"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={() => onRequestRevision(request.id)}
                variant="outline"
                className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border-yellow-500/30"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Request Revision
              </Button>
              <Button
                onClick={() => onReject(request.id)}
                variant="outline"
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        )}

        {/* Previous Feedback */}
        {request.approvers.some(a => a.feedback) && (
          <div>
            <h4 className="font-medium text-white mb-3">Feedback</h4>
            <div className="space-y-2">
              {request.approvers
                .filter(a => a.feedback)
                .map(approver => (
                  <div key={approver.id} className="p-3 bg-white/5 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{approver.name}</span>
                      <Badge
                        variant={approver.status === 'approved' ? 'default' : 'secondary'}
                        className={`text-xs ${getStatusColor(approver.status)}`}
                      >
                        {approver.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-300">{approver.feedback}</p>
                    {approver.approvedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(approver.approvedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
