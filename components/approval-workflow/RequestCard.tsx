'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Clock } from '@/components/icons';
import type { ApprovalRequest, User } from './types';
import { getStatusColor, getPriorityColor } from './types';

interface RequestCardProps {
  request: ApprovalRequest;
  currentUser: User;
  onSelect: (request: ApprovalRequest) => void;
  onApprove: (requestId: string) => void;
}

export function RequestCard({ request, currentUser, onSelect, onApprove }: RequestCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        variant="glass"
        className="cursor-pointer"
        onClick={() => onSelect(request)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-white line-clamp-1">
                {request.title}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                by {request.requester.name} &bull; {request.requester.role}
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
                  onApprove(request.id);
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
                  onSelect(request);
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
  );
}
