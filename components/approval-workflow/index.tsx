'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitBranch, FileText } from '@/components/icons';
import { notify } from '@/lib/notifications';

import { RequestCard } from './RequestCard';
import { RequestDetail } from './RequestDetail';
import type { ApprovalRequest, User } from './types';

// Mock current user
const currentUser: User = {
  id: 'user-1',
  name: 'You',
  email: 'you@example.com',
  role: 'Manager'
};

function getMockRequests(): ApprovalRequest[] {
  return [
    {
      id: 'req-1',
      title: 'Q4 Marketing Campaign',
      content: 'Launch campaign for new product line targeting millennials...',
      contentType: 'campaign',
      requester: {
        id: 'user-2',
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        role: 'Marketing Lead'
      },
      approvers: [
        {
          id: 'user-1',
          name: 'You',
          email: 'you@example.com',
          role: 'Manager',
          status: 'pending',
          required: true
        },
        {
          id: 'user-3',
          name: 'Mike Chen',
          email: 'mike@example.com',
          role: 'Creative Director',
          status: 'approved',
          approvedAt: new Date(),
          feedback: 'Looks great! Love the creative direction.',
          required: true
        }
      ],
      status: 'pending',
      priority: 'high',
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      comments: [],
      attachments: [],
      revisionCount: 0,
      currentStage: 1,
      stages: [
        {
          id: 'stage-1',
          name: 'Creative Review',
          approvers: ['user-3'],
          requireAll: true,
          status: 'completed'
        },
        {
          id: 'stage-2',
          name: 'Management Approval',
          approvers: ['user-1'],
          requireAll: true,
          status: 'in_progress'
        },
        {
          id: 'stage-3',
          name: 'Legal Review',
          approvers: ['user-4'],
          requireAll: false,
          status: 'pending'
        }
      ]
    },
    {
      id: 'req-2',
      title: 'Social Media Post - Product Launch',
      content: 'Announcing our revolutionary new feature...',
      contentType: 'post',
      requester: {
        id: 'user-5',
        name: 'Alex Rivera',
        email: 'alex@example.com',
        role: 'Content Creator'
      },
      approvers: [
        {
          id: 'user-1',
          name: 'You',
          email: 'you@example.com',
          role: 'Manager',
          status: 'approved',
          approvedAt: new Date(),
          feedback: 'Great work!',
          required: true
        }
      ],
      status: 'approved',
      priority: 'medium',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      comments: [],
      attachments: [],
      revisionCount: 1,
      currentStage: 2,
      stages: [
        {
          id: 'stage-1',
          name: 'Initial Review',
          approvers: ['user-1'],
          requireAll: true,
          status: 'completed'
        }
      ]
    }
  ];
}

export function ApprovalWorkflow() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setRequests(getMockRequests());
  }, []);

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const approveRequest = (requestId: string) => {
    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        const approverIndex = req.approvers.findIndex(a => a.id === currentUser.id);
        if (approverIndex !== -1) {
          req.approvers[approverIndex].status = 'approved';
          req.approvers[approverIndex].approvedAt = new Date();
          req.approvers[approverIndex].feedback = feedback;

          const allApproved = req.approvers
            .filter(a => a.required)
            .every(a => a.status === 'approved');

          if (allApproved) {
            req.status = 'approved';
            if (req.currentStage < req.stages.length - 1) {
              req.stages[req.currentStage].status = 'completed';
              req.currentStage++;
              req.stages[req.currentStage].status = 'in_progress';
              req.status = 'pending';
            }
          }
        }
        req.updatedAt = new Date();
      }
      return req;
    }));

    setFeedback('');
    notify.success('Request approved');
  };

  const rejectRequest = (requestId: string) => {
    if (!feedback.trim()) {
      notify.error('Please provide feedback for rejection');
      return;
    }

    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        const approverIndex = req.approvers.findIndex(a => a.id === currentUser.id);
        if (approverIndex !== -1) {
          req.approvers[approverIndex].status = 'rejected';
          req.approvers[approverIndex].approvedAt = new Date();
          req.approvers[approverIndex].feedback = feedback;
        }
        req.status = 'rejected';
        req.updatedAt = new Date();
      }
      return req;
    }));

    setFeedback('');
    notify.info('Request rejected');
  };

  const requestRevision = (requestId: string) => {
    if (!feedback.trim()) {
      notify.error('Please provide feedback for revision');
      return;
    }

    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        req.status = 'revision';
        req.revisionCount++;
        req.comments.push({
          id: `comment-${Date.now()}`,
          user: currentUser,
          content: `Revision requested: ${feedback}`,
          timestamp: new Date()
        });
        req.updatedAt = new Date();
      }
      return req;
    }));

    setFeedback('');
    notify.info('Revision requested');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <GitBranch className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Approval Workflow</h2>
            <p className="text-gray-400">Manage content approvals</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
              className={filter === f ? '' : 'bg-white/5 border-white/10'}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Requests Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredRequests.map(request => (
          <RequestCard
            key={request.id}
            request={request}
            currentUser={currentUser}
            onSelect={setSelectedRequest}
            onApprove={approveRequest}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredRequests.length === 0 && (
        <Card variant="glass" className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No {filter !== 'all' ? filter : ''} requests</p>
        </Card>
      )}

      {/* Selected Request Details */}
      {selectedRequest && (
        <RequestDetail
          request={selectedRequest}
          currentUser={currentUser}
          feedback={feedback}
          onFeedbackChange={setFeedback}
          onApprove={approveRequest}
          onReject={rejectRequest}
          onRequestRevision={requestRevision}
        />
      )}
    </div>
  );
}

export default ApprovalWorkflow;
