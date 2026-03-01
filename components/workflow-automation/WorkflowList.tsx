'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Play, Pause, Settings, Copy, RefreshCw,
} from '@/components/icons';
import type { Workflow, WorkflowRun, WorkflowNode } from './types';
import { getStatusColor } from './helpers';

interface WorkflowListProps {
  workflows: Workflow[];
  workflowRuns: WorkflowRun[];
  onEditWorkflow: (workflow: Workflow) => void;
  onToggleStatus: (workflow: Workflow) => void;
  onRunWorkflow: (workflow: Workflow) => void;
  onDuplicateWorkflow: (workflow: Workflow) => void;
  onNewWorkflow: () => void;
}

export function WorkflowList({
  workflows, workflowRuns,
  onEditWorkflow, onToggleStatus, onRunWorkflow, onDuplicateWorkflow, onNewWorkflow,
}: WorkflowListProps) {
  return (
    <>
      {/* Workflow Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workflows.map(workflow => (
          <Card key={workflow.id} variant="glass">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{workflow.name}</CardTitle>
                  <CardDescription>{workflow.description}</CardDescription>
                </div>
                <div className={`w-2 h-2 rounded-full ${getStatusColor(workflow.status)}`} />
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-2 bg-white/5 rounded">
                    <p className="text-xs text-gray-400">Runs</p>
                    <p className="text-lg font-bold text-white">{workflow.runCount}</p>
                  </div>
                  <div className="p-2 bg-white/5 rounded">
                    <p className="text-xs text-gray-400">Success</p>
                    <p className="text-lg font-bold text-white">{workflow.successRate}%</p>
                  </div>
                </div>

                {workflow.lastRun && (
                  <div className="text-xs text-gray-400">
                    Last run: {new Date(workflow.lastRun).toLocaleString()}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 bg-white/5 border-white/10"
                    onClick={() => onEditWorkflow(workflow)}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Edit
                  </Button>

                  {workflow.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
                      onClick={() => onToggleStatus(workflow)}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-green-500/20 border-green-500/30 text-green-400"
                      onClick={() => onToggleStatus(workflow)}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-blue-500/20 border-blue-500/30 text-blue-400"
                    onClick={() => onRunWorkflow(workflow)}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white/5 border-white/10"
                    onClick={() => onDuplicateWorkflow(workflow)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Create New Card */}
        <Card
          className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] cursor-pointer hover:bg-white/10 transition-colors"
          onClick={onNewWorkflow}
        >
          <CardContent className="flex flex-col items-center justify-center h-full min-h-[250px]">
            <Plus className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-400">Create New Workflow</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      {workflowRuns.length > 0 && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Recent Runs</CardTitle>
            <CardDescription>Monitor workflow executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workflowRuns.slice(0, 5).map(run => (
                <div key={run.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(run.status)}`} />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {workflows.find(w => w.id === run.workflowId)?.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        Started: {new Date(run.startedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={run.status === 'completed' ? 'default' : 'secondary'}>
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
