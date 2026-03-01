'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  GitBranch, Save, Zap, Clock, Filter, Play, Activity, XCircle,
} from '@/components/icons';
import type { WorkflowNode, WorkflowTrigger, WorkflowAction, Workflow } from './types';

interface BuilderViewProps {
  selectedWorkflow: Workflow | null;
  workflowName: string;
  setWorkflowName: (v: string) => void;
  workflowDescription: string;
  setWorkflowDescription: (v: string) => void;
  nodes: WorkflowNode[];
  setNodes: (nodes: WorkflowNode[]) => void;
  triggers: WorkflowTrigger[];
  actions: WorkflowAction[];
  onSave: () => void;
  onClose: () => void;
  onAddNode: (type: string, actionId?: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

function getNodeIcon(type: string) {
  switch (type) {
    case 'trigger': return <Zap className="h-4 w-4" />;
    case 'condition': return <Filter className="h-4 w-4" />;
    case 'action': return <Play className="h-4 w-4" />;
    case 'delay': return <Clock className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
}

export function BuilderView({
  selectedWorkflow,
  workflowName, setWorkflowName,
  workflowDescription, setWorkflowDescription,
  nodes, setNodes,
  triggers, actions,
  onSave, onClose, onAddNode, onDeleteNode,
}: BuilderViewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-4">
        {/* Workflow Info */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Workflow Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={selectedWorkflow?.name || workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Workflow name"
                className="mt-1 bg-white/5 border-white/10"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={selectedWorkflow?.description || workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Brief description"
                className="mt-1 bg-white/5 border-white/10"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gradient-primary" onClick={onSave}>
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 bg-white/5 border-white/10"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Triggers */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Triggers</CardTitle>
            <CardDescription>Start your workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {triggers.map(trigger => (
              <Button
                key={trigger.id}
                variant="outline"
                className="w-full justify-start bg-white/5 border-white/10"
                onClick={() => onAddNode('trigger', trigger.id)}
              >
                {trigger.icon}
                <span className="ml-2">{trigger.name}</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>What to do</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {actions.map(action => (
              <Button
                key={action.id}
                variant="outline"
                className="w-full justify-start bg-white/5 border-white/10"
                onClick={() => onAddNode('action', action.id)}
              >
                {action.icon}
                <span className="ml-2">{action.name}</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Logic */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Logic</CardTitle>
            <CardDescription>Control flow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start bg-white/5 border-white/10"
              onClick={() => onAddNode('condition')}
            >
              <Filter className="h-4 w-4 mr-2" />
              If/Then Condition
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start bg-white/5 border-white/10"
              onClick={() => onAddNode('delay')}
            >
              <Clock className="h-4 w-4 mr-2" />
              Delay
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Canvas */}
      <div className="lg:col-span-3">
        <Card variant="glass" className="h-[600px]">
          <CardContent className="p-6 h-full">
            <div
              ref={canvasRef}
              className="relative w-full h-full bg-white/5 rounded-lg overflow-auto"
            >
              {nodes.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-400">Start by adding a trigger</p>
                    <p className="text-sm text-gray-500">Drag elements from the sidebar</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Render Nodes */}
                  {nodes.map(node => (
                    <motion.div
                      key={node.id}
                      className="absolute"
                      style={{ left: node.position.x, top: node.position.y }}
                      drag
                      dragMomentum={false}
                      onDragEnd={(e, info) => {
                        setNodes(nodes.map(n =>
                          n.id === node.id
                            ? { ...n, position: { x: info.point.x, y: info.point.y } }
                            : n
                        ));
                      }}
                    >
                      <Card variant="glass" className="cursor-move">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            {getNodeIcon(node.type)}
                            <span className="text-sm font-medium text-white">{node.name}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDeleteNode(node.id)}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}

                  {/* Render Connections */}
                  <svg className="absolute inset-0 pointer-events-none">
                    {nodes.map(node =>
                      node.connected.map(targetId => {
                        const target = nodes.find(n => n.id === targetId);
                        if (!target) return null;

                        return (
                          <line
                            key={`${node.id}-${targetId}`}
                            x1={node.position.x + 100}
                            y1={node.position.y + 30}
                            x2={target.position.x}
                            y2={target.position.y + 30}
                            stroke="rgba(6, 182, 212, 0.5)"
                            strokeWidth="2"
                          />
                        );
                      })
                    )}
                  </svg>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
