'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  GitBranch,
  Plus,
  Play,
  Pause,
  Square,
  Settings,
  Trash2,
  Copy,
  Save,
  Zap,
  Clock,
  Calendar,
  Bell,
  Mail,
  MessageSquare,
  Hash,
  Users,
  Filter,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Database,
  Globe,
  Send,
  Download,
  Upload,
  Link,
  Shield,
  Target,
  TrendingUp,
  Bot
} from 'lucide-react';
import { notify } from '@/lib/notifications';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'delay';
  name: string;
  config: any;
  position: { x: number; y: number };
  connected: string[];
}

interface WorkflowTrigger {
  id: string;
  type: 'schedule' | 'event' | 'webhook' | 'manual';
  name: string;
  description: string;
  icon: React.ReactNode;
  config: any;
}

interface WorkflowAction {
  id: string;
  type: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  parameters: Parameter[];
}

interface Parameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  label: string;
  required: boolean;
  options?: string[];
  default?: any;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  nodes: WorkflowNode[];
  createdAt: Date;
  lastRun?: Date;
  runCount: number;
  successRate: number;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  logs: string[];
  error?: string;
}

export function WorkflowAutomation() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Form states
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [nodeType, setNodeType] = useState('trigger');
  const [nodeName, setNodeName] = useState('');
  
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
      type: type as any,
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
    setNodes(nodes.filter(n => n.id !== nodeId));
    // Remove connections
    setNodes(nodes.map(n => ({
      ...n,
      connected: n.connected.filter(id => id !== nodeId)
    })));
    notify.info('Node removed');
  };
  
  const connectNodes = (fromId: string, toId: string) => {
    setNodes(nodes.map(n => 
      n.id === fromId 
        ? { ...n, connected: [...n.connected, toId] }
        : n
    ));
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
    
    // Simulate workflow execution
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
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'draft': return 'bg-gray-500';
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'trigger': return <Zap className="h-4 w-4" />;
      case 'condition': return <Filter className="h-4 w-4" />;
      case 'action': return <Play className="h-4 w-4" />;
      case 'delay': return <Clock className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
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
        <>
          {/* Workflow List */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map(workflow => (
              <Card key={workflow.id} className="glass-card">
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
                    {/* Stats */}
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
                    
                    {/* Last Run */}
                    {workflow.lastRun && (
                      <div className="text-xs text-gray-400">
                        Last run: {new Date(workflow.lastRun).toLocaleString()}
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-white/5 border-white/10"
                        onClick={() => {
                          setSelectedWorkflow(workflow);
                          setNodes(workflow.nodes);
                          setShowBuilder(true);
                        }}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      
                      {workflow.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
                          onClick={() => toggleWorkflowStatus(workflow)}
                        >
                          <Pause className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-green-500/20 border-green-500/30 text-green-400"
                          onClick={() => toggleWorkflowStatus(workflow)}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-blue-500/20 border-blue-500/30 text-blue-400"
                        onClick={() => runWorkflow(workflow)}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white/5 border-white/10"
                        onClick={() => duplicateWorkflow(workflow)}
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
              className="glass-card cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => setShowBuilder(true)}
            >
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[250px]">
                <Plus className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-400">Create New Workflow</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Runs */}
          {workflowRuns.length > 0 && (
            <Card className="glass-card">
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
      ) : (
        /* Workflow Builder */
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Workflow Info */}
            <Card className="glass-card">
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
                  <Button
                    size="sm"
                    className="flex-1 gradient-primary"
                    onClick={() => {
                      if (selectedWorkflow) {
                        notify.success('Workflow saved!');
                      } else {
                        createWorkflow();
                      }
                    }}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 bg-white/5 border-white/10"
                    onClick={() => {
                      setShowBuilder(false);
                      setSelectedWorkflow(null);
                      setNodes([]);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Triggers */}
            <Card className="glass-card">
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
                    onClick={() => addNode('trigger', trigger.id)}
                  >
                    {trigger.icon}
                    <span className="ml-2">{trigger.name}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
            
            {/* Actions */}
            <Card className="glass-card">
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
                    onClick={() => addNode('action', action.id)}
                  >
                    {action.icon}
                    <span className="ml-2">{action.name}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
            
            {/* Conditions */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Logic</CardTitle>
                <CardDescription>Control flow</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start bg-white/5 border-white/10"
                  onClick={() => addNode('condition')}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  If/Then Condition
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-white/5 border-white/10"
                  onClick={() => addNode('delay')}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Delay
                </Button>
              </CardContent>
            </Card>
          </div>
          
          {/* Canvas */}
          <div className="lg:col-span-3">
            <Card className="glass-card h-[600px]">
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
                          <Card className="glass-card cursor-move">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                {getNodeIcon(node.type)}
                                <span className="text-sm font-medium text-white">{node.name}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteNode(node.id)}
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
                                stroke="rgba(139, 92, 246, 0.5)"
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
      )}
    </div>
  );
}