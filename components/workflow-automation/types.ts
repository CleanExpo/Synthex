export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'delay';
  name: string;
  config: any;
  position: { x: number; y: number };
  connected: string[];
}

export interface WorkflowTrigger {
  id: string;
  type: 'schedule' | 'event' | 'webhook' | 'manual';
  name: string;
  description: string;
  icon: React.ReactNode;
  config: any;
}

export interface WorkflowAction {
  id: string;
  type: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  parameters: Parameter[];
}

export interface Parameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  label: string;
  required: boolean;
  options?: string[];
  default?: any;
}

export interface Workflow {
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

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  logs: string[];
  error?: string;
}
