'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  GitBranch, Plus,
  Clock, Users, Bell, Globe,
  Send, Mail, MessageSquare, Hash, Bot, Sparkles,
} from '@/components/icons';
import { notify } from '@/lib/notifications';
import type { WorkflowNode, WorkflowTrigger, WorkflowAction, Workflow, WorkflowRun } from './types';
import { WorkflowList } from './WorkflowList';
import { BuilderView } from './BuilderView';

export function WorkflowAutomation() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);

  // Form states
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');

  const triggers: WorkflowTrigger[] = [
    {
      id: 'schedule',
      type: 'schedule',
      name: 'Schedule',
      description: 'Run at specific times',
      icon: <Clock className="h-4 w-4" />,
      config: { frequency: 'daily', time: '09:00' }
    },
    {
      id: 'new-follower',
      type: 'event',
      name: 'New Follower',
      description: 'When someone follows',
      icon: <Users className="h-4 w-4" />,
      config: { platform: 'all' }
    },
    {
      id: 'mention',
      type: 'event',
      name: 'Mention',
      description: 'When mentioned',
      icon: <Bell className="h-4 w-4" />,
      config: { platform: 'all', keywords: [] }
    },
    {
      id: 'webhook',
      type: 'webhook',
      name: 'Webhook',
      description: 'External trigger',
      icon: <Globe className="h-4 w-4" />,
      config: { url: '', method: 'POST' }
    }
  ];

  const actions: WorkflowAction[] = [
    {
      id: 'post-content',
      type: 'post',
      name: 'Post Content',
      category: 'Social Media',
      description: 'Create a social media post',
      icon: <Send className="h-4 w-4" />,
      parameters: [
        { name: 'content', type: 'string', label: 'Content', required: true },
        { name: 'platforms', type: 'multiselect', label: 'Platforms', required: true, options: ['Twitter', 'Facebook', 'Instagram', 'LinkedIn'] },
        { name: 'mediaUrl', type: 'string', label: 'Media URL', required: false }
      ]
    },
    {
      id: 'send-email',
      type: 'email',
      name: 'Send Email',
      category: 'Communication',
      description: 'Send an email notification',
      icon: <Mail className="h-4 w-4" />,
      parameters: [
        { name: 'to', type: 'string', label: 'Recipients', required: true },
        { name: 'subject', type: 'string', label: 'Subject', required: true },
        { name: 'body', type: 'string', label: 'Message', required: true }
      ]
    },
    {
      id: 'auto-reply',
      type: 'reply',
      name: 'Auto Reply',
      category: 'Engagement',
      description: 'Automatically reply to messages',
      icon: <MessageSquare className="h-4 w-4" />,
      parameters: [
        { name: 'template', type: 'select', label: 'Template', required: true, options: ['Thank You', 'Welcome', 'Support', 'Custom'] },
        { name: 'customMessage', type: 'string', label: 'Custom Message', required: false }
      ]
    },
    {
      id: 'add-tag',
      type: 'tag',
      name: 'Add Tag',
      category: 'Organization',
      description: 'Add tags to contacts',
      icon: <Hash className="h-4 w-4" />,
      parameters: [
        { name: 'tags', type: 'string', label: 'Tags (comma-separated)', required: true }
      ]
    },
    {
      id: 'analyze-sentiment',
      type: 'ai',
      name: 'Analyze Sentiment',
      category: 'AI',
      description: 'AI sentiment analysis',
      icon: <Bot className="h-4 w-4" />,
      parameters: [
        { name: 'threshold', type: 'number', label: 'Threshold', required: true, default: 0.5 }
      ]
    },
    {
      id: 'generate-content',
      type: 'ai',
      name: 'Generate Content',
      category: 'AI',
      description: 'AI content generation',
      icon: <Sparkles className="h-4 w-4" />,
      parameters: [
        { name: 'prompt', type: 'string', label: 'Prompt', required: true },
        { name: 'tone', type: 'select', label: 'Tone', required: true, options: ['Professional', 'Casual', 'Friendly', 'Formal'] }
      ]
    }
  ];

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = () => {
    const mockWorkflows: Workflow[] = [
      {
        id: 'wf-1',
        name: 'Welcome New Followers',
        description: 'Automatically welcome new followers with a personalized message',
        status: 'active',
        nodes: [],
        createdAt: new Date('2024-01-01'),
        lastRun: new Date(),
        runCount: 156,
        successRate: 98.5
      },
      {
        id: 'wf-2',
        name: 'Content Scheduler',
        description: 'Schedule and post content at optimal times',
        status: 'active',
        nodes: [],
        createdAt: new Date('2024-01-15'),
        lastRun: new Date(),
        runCount: 89,
        successRate: 100
      },
      {
        id: 'wf-3',
        name: 'Engagement Monitor',
        description: 'Monitor and respond to high engagement',
        status: 'paused',
        nodes: [],
        createdAt: new Date('2024-02-01'),
        runCount: 45,
        successRate: 95.2
      }
    ];
    setWorkflows(mockWorkflows);
  };

  const createWorkflow = () => {
    if (!workflowName) {
      notify.error('Please enter a workflow name');
      return;
    }

    const newWorkflow: Workflow = {
      id: `wf-${Date.now()}`,
      name: workflowName,
      description: workflowDescription,
      status: 'draft',
      nodes: [],
      createdAt: new Date(),
      runCount: 0,
      successRate: 0
    };

    setWorkflows([...workflows, newWorkflow]);
    setSelectedWorkflow(newWorkflow);
    setShowBuilder(true);
    setWorkflowName('');
    setWorkflowDescription('');
    notify.success('Workflow created!');
  };

  const addNode = (type: string, actionId?: string) => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type: type as WorkflowNode['type'],
      name: actionId ? actions.find(a => a.id === actionId)?.name || type : type,
      config: {},
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100
      },
      connected: []
    };

    setNodes([...nodes, newNode]);
    notify.success(`${newNode.name} added`);
  };

  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev
      .filter(n => n.id !== nodeId)
      .map(n => ({
        ...n,
        connected: n.connected.filter(id => id !== nodeId)
      }))
    );
    notify.info('Node removed');
  };

  const runWorkflow = (workflow: Workflow) => {
    const run: WorkflowRun = {
      id: `run-${Date.now()}`,
      workflowId: workflow.id,
      status: 'running',
      startedAt: new Date(),
      logs: ['Workflow started...']
    };

    setWorkflowRuns([run, ...workflowRuns]);
    notify.info(`Running "${workflow.name}"`);

    setTimeout(() => {
      run.status = 'completed';
      run.completedAt = new Date();
      run.logs.push('All actions completed successfully');
      setWorkflowRuns([run, ...workflowRuns.slice(1)]);
      notify.success(`"${workflow.name}" completed successfully!`);
    }, 3000);
  };

  const toggleWorkflowStatus = (workflow: Workflow) => {
    const updated = {
      ...workflow,
      status: workflow.status === 'active' ? 'paused' : 'active'
    } as Workflow;

    setWorkflows(workflows.map(w => w.id === workflow.id ? updated : w));
    notify.info(`Workflow ${updated.status === 'active' ? 'activated' : 'paused'}`);
  };

  const duplicateWorkflow = (workflow: Workflow) => {
    const duplicate: Workflow = {
      ...workflow,
      id: `wf-${Date.now()}`,
      name: `${workflow.name} (Copy)`,
      status: 'draft',
      createdAt: new Date(),
      runCount: 0,
      successRate: 0
    };

    setWorkflows([...workflows, duplicate]);
    notify.success('Workflow duplicated');
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
            <h2 className="text-2xl font-bold text-white">Workflow Automation</h2>
            <p className="text-gray-400">Build powerful automation workflows</p>
          </div>
        </div>

        <Button onClick={() => setShowBuilder(true)} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {!showBuilder ? (
        <WorkflowList
          workflows={workflows}
          workflowRuns={workflowRuns}
          onEditWorkflow={(workflow) => {
            setSelectedWorkflow(workflow);
            setNodes(workflow.nodes);
            setShowBuilder(true);
          }}
          onToggleStatus={toggleWorkflowStatus}
          onRunWorkflow={runWorkflow}
          onDuplicateWorkflow={duplicateWorkflow}
          onNewWorkflow={() => setShowBuilder(true)}
        />
      ) : (
        <BuilderView
          selectedWorkflow={selectedWorkflow}
          workflowName={workflowName}
          setWorkflowName={setWorkflowName}
          workflowDescription={workflowDescription}
          setWorkflowDescription={setWorkflowDescription}
          nodes={nodes}
          setNodes={setNodes}
          triggers={triggers}
          actions={actions}
          onSave={() => {
            if (selectedWorkflow) {
              notify.success('Workflow saved!');
            } else {
              createWorkflow();
            }
          }}
          onClose={() => {
            setShowBuilder(false);
            setSelectedWorkflow(null);
            setNodes([]);
          }}
          onAddNode={addNode}
          onDeleteNode={deleteNode}
        />
      )}
    </div>
  );
}
