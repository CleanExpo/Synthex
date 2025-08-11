'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  GitBranch, 
  CheckCircle, 
  XCircle,
  Clock,
  AlertCircle,
  Send,
  MessageSquare,
  FileText,
  Users,
  ArrowRight,
  RotateCcw,
  Eye,
  Edit,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Flag,
  ChevronRight
} from 'lucide-react';
import { notify } from '@/lib/notifications';
import { fadeInUp, scaleIn } from '@/lib/animations';

interface ApprovalRequest {
  id: string;
  title: string;
  content: string;
  contentType: 'post' | 'campaign' | 'creative' | 'strategy';
  requester: User;
  approvers: Approver[];
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'revision';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
  comments: Comment[];
  attachments: Attachment[];
  revisionCount: number;
  currentStage: number;
  stages: ApprovalStage[];
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
}

interface Approver extends User {
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  feedback?: string;
  approvedAt?: Date;
  required: boolean;
}

interface Comment {
  id: string;
  user: User;
  content: string;
  timestamp: Date;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

interface ApprovalStage {
  id: string;
  name: string;
  approvers: string[]; // User IDs
  requireAll: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export function ApprovalWorkflow() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [feedback, setFeedback] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Mock current user
  const currentUser: User = {
    id: 'user-1',
    name: 'You',
    email: 'you@example.com',
    role: 'Manager'
  };
  
  // Load approval requests
  useEffect(() => {
    loadRequests();
  }, []);
  
  const loadRequests = () => {
    // Mock data
    const mockRequests: ApprovalRequest[] = [
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
    
    setRequests(mockRequests);
  };
  
  // Filter requests
  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });
  
  // Approve request
  const approveRequest = (requestId: string) => {
    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        const approverIndex = req.approvers.findIndex(a => a.id === currentUser.id);
        if (approverIndex !== -1) {
          req.approvers[approverIndex].status = 'approved';
          req.approvers[approverIndex].approvedAt = new Date();
          req.approvers[approverIndex].feedback = feedback;
          
          // Check if all required approvers have approved
          const allApproved = req.approvers
            .filter(a => a.required)
            .every(a => a.status === 'approved');
          
          if (allApproved) {
            req.status = 'approved';
            
            // Move to next stage
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
  
  // Reject request
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
  
  // Request revision
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
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-400';
      case 'rejected': return 'text-red-400';
      case 'pending': return 'text-yellow-400';
      case 'revision': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };
  
  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <GitBranch className="h-6 w-6 text-purple-400" />
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
          <motion.div
            key={request.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className="glass-card cursor-pointer"
              onClick={() => setSelectedRequest(request)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white line-clamp-1">
                      {request.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      by {request.requester.name} • {request.requester.role}
                    </p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(request.priority)}`} />
                </div>
                
                <p className="text-sm text-gray-300 line-clamp-2 mb-3">
                  {request.content}
                </p>
                
                {/* Progress */}
                {request.stages.length > 1 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Approval Progress</span>
                      <span className="text-white">
                        {request.currentStage + 1}/{request.stages.length}
                      </span>
                    </div>
                    <Progress 
                      value={(request.currentStage + 1) / request.stages.length * 100} 
                      className="h-2"
                    />
                  </div>
                )}
                
                {/* Approvers */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex -space-x-2">
                    {request.approvers.slice(0, 3).map(approver => (
                      <Avatar key={approver.id} className="h-6 w-6 border-2 border-background">
                        <AvatarFallback className="text-xs">
                          {approver.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  {request.approvers.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{request.approvers.length - 3}
                    </span>
                  )}
                </div>
                
                {/* Status & Actions */}
                <div className="flex items-center justify-between">
                  <Badge 
                    variant={request.status === 'approved' ? 'default' : 'secondary'}
                    className={getStatusColor(request.status)}
                  >
                    {request.status}
                  </Badge>
                  
                  {request.deadline && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {new Date(request.deadline).toLocaleDateString()}
                    </div>
                  )}
                </div>
                
                {/* Quick Actions for Pending */}
                {request.status === 'pending' && 
                 request.approvers.some(a => a.id === currentUser.id && a.status === 'pending') && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        approveRequest(request.id);
                      }}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRequest(request);
                      }}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Review
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      
      {/* Empty State */}
      {filteredRequests.length === 0 && (
        <Card className="glass-card p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No {filter !== 'all' ? filter : ''} requests</p>
        </Card>
      )}
      
      {/* Selected Request Details */}
      {selectedRequest && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{selectedRequest.title}</CardTitle>
                <CardDescription>
                  Requested by {selectedRequest.requester.name} • {selectedRequest.requester.role}
                </CardDescription>
              </div>
              <Badge 
                variant={selectedRequest.status === 'approved' ? 'default' : 'secondary'}
                className={getStatusColor(selectedRequest.status)}
              >
                {selectedRequest.status}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Content */}
            <div>
              <h4 className="font-medium text-white mb-2">Content</h4>
              <p className="text-gray-300">{selectedRequest.content}</p>
            </div>
            
            {/* Approval Stages */}
            {selectedRequest.stages.length > 0 && (
              <div>
                <h4 className="font-medium text-white mb-3">Approval Stages</h4>
                <div className="space-y-3">
                  {selectedRequest.stages.map((stage, index) => (
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
                      {index < selectedRequest.stages.length - 1 && (
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
                {selectedRequest.approvers.map(approver => (
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
            {selectedRequest.status === 'pending' && 
             selectedRequest.approvers.some(a => a.id === currentUser.id && a.status === 'pending') && (
              <div>
                <h4 className="font-medium text-white mb-3">Your Decision</h4>
                <Textarea
                  placeholder="Add feedback (optional for approval, required for rejection)..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="mb-3 bg-white/5 border-white/10"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => approveRequest(selectedRequest.id)}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => requestRevision(selectedRequest.id)}
                    variant="outline"
                    className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border-yellow-500/30"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Request Revision
                  </Button>
                  <Button
                    onClick={() => rejectRequest(selectedRequest.id)}
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
            {selectedRequest.approvers.some(a => a.feedback) && (
              <div>
                <h4 className="font-medium text-white mb-3">Feedback</h4>
                <div className="space-y-2">
                  {selectedRequest.approvers
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
      )}
    </div>
  );
}

// Import Circle icon
import { Circle } from 'lucide-react';