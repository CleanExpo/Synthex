export interface ApprovalRequest {
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

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
}

export interface Approver extends User {
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  feedback?: string;
  approvedAt?: Date;
  required: boolean;
}

export interface Comment {
  id: string;
  user: User;
  content: string;
  timestamp: Date;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

export interface ApprovalStage {
  id: string;
  name: string;
  approvers: string[]; // User IDs
  requireAll: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'approved': return 'text-green-400';
    case 'rejected': return 'text-red-400';
    case 'pending': return 'text-yellow-400';
    case 'revision': return 'text-orange-400';
    default: return 'text-gray-400';
  }
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
}
