'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TasksSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  Clock,
  CheckCircle,
  Circle,
  AlertCircle,
  Pause,
  Play,
  Trash2,
  Edit,
  Eye,
  Users,
  Tag,
  ListTodo,
  KanbanSquare,
  LayoutList,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Loader2,
  FileText,
  Target,
  TrendingUp,
  Sparkles,
  MessageSquare,
  Link2,
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Tasks Management Page
 * Full-featured task management for marketing workflows
 *
 * @task UNI-415 - Tasks Management Full UI
 */

// ============================================================================
// TYPES
// ============================================================================

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'content' | 'campaign' | 'analytics' | 'social' | 'design' | 'other';
  assignees: { id: string; name: string; avatar?: string }[];
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  subtasks: { id: string; title: string; completed: boolean }[];
  comments: number;
  attachments: number;
  progress: number;
  campaignId?: string;
  campaignName?: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Create Q1 Social Media Campaign',
    description: 'Design and plan the Q1 social media campaign focusing on product launches and brand awareness.',
    status: 'in_progress',
    priority: 'high',
    type: 'campaign',
    assignees: [
      { id: '1', name: 'Sarah Chen', avatar: '/avatars/sarah.jpg' },
      { id: '2', name: 'Mike Ross' },
    ],
    dueDate: '2026-02-15',
    createdAt: '2026-01-20',
    updatedAt: '2026-02-01',
    tags: ['Q1', 'Campaign', 'Social'],
    subtasks: [
      { id: 's1', title: 'Research competitor campaigns', completed: true },
      { id: 's2', title: 'Create content calendar', completed: true },
      { id: 's3', title: 'Design visual assets', completed: false },
      { id: 's4', title: 'Write copy variations', completed: false },
    ],
    comments: 12,
    attachments: 5,
    progress: 50,
    campaignId: 'camp-1',
    campaignName: 'Q1 Product Launch',
  },
  {
    id: '2',
    title: 'Analyze January Performance Metrics',
    description: 'Review and compile all social media performance metrics from January for the monthly report.',
    status: 'review',
    priority: 'medium',
    type: 'analytics',
    assignees: [{ id: '3', name: 'Alex Kim' }],
    dueDate: '2026-02-05',
    createdAt: '2026-01-28',
    updatedAt: '2026-02-02',
    tags: ['Analytics', 'Monthly', 'Report'],
    subtasks: [
      { id: 's1', title: 'Export platform data', completed: true },
      { id: 's2', title: 'Calculate engagement rates', completed: true },
      { id: 's3', title: 'Create visualizations', completed: true },
    ],
    comments: 8,
    attachments: 3,
    progress: 100,
  },
  {
    id: '3',
    title: 'Design Instagram Story Templates',
    description: 'Create a set of branded story templates for consistent Instagram presence.',
    status: 'todo',
    priority: 'medium',
    type: 'design',
    assignees: [{ id: '4', name: 'Emma Wilson', avatar: '/avatars/emma.jpg' }],
    dueDate: '2026-02-10',
    createdAt: '2026-01-30',
    updatedAt: '2026-01-30',
    tags: ['Design', 'Instagram', 'Templates'],
    subtasks: [
      { id: 's1', title: 'Create poll template', completed: false },
      { id: 's2', title: 'Create Q&A template', completed: false },
      { id: 's3', title: 'Create announcement template', completed: false },
    ],
    comments: 3,
    attachments: 1,
    progress: 0,
  },
  {
    id: '4',
    title: 'Write Blog Post: AI in Marketing',
    description: 'Draft a comprehensive blog post about how AI is transforming social media marketing.',
    status: 'in_progress',
    priority: 'low',
    type: 'content',
    assignees: [{ id: '1', name: 'Sarah Chen', avatar: '/avatars/sarah.jpg' }],
    dueDate: '2026-02-20',
    createdAt: '2026-01-25',
    updatedAt: '2026-02-01',
    tags: ['Blog', 'AI', 'Content'],
    subtasks: [
      { id: 's1', title: 'Research and outline', completed: true },
      { id: 's2', title: 'Write first draft', completed: false },
      { id: 's3', title: 'Add visuals', completed: false },
      { id: 's4', title: 'SEO optimization', completed: false },
    ],
    comments: 5,
    attachments: 2,
    progress: 25,
  },
  {
    id: '5',
    title: 'Schedule Twitter Content for Week',
    description: 'Plan and schedule all Twitter posts for the upcoming week using the content calendar.',
    status: 'done',
    priority: 'high',
    type: 'social',
    assignees: [{ id: '2', name: 'Mike Ross' }],
    dueDate: '2026-02-01',
    createdAt: '2026-01-28',
    updatedAt: '2026-02-01',
    tags: ['Twitter', 'Scheduling', 'Weekly'],
    subtasks: [
      { id: 's1', title: 'Review content calendar', completed: true },
      { id: 's2', title: 'Write tweets', completed: true },
      { id: 's3', title: 'Schedule in platform', completed: true },
    ],
    comments: 4,
    attachments: 0,
    progress: 100,
  },
  {
    id: '6',
    title: 'Urgent: Crisis Response Post',
    description: 'Prepare and publish response post regarding the recent customer feedback situation.',
    status: 'todo',
    priority: 'urgent',
    type: 'social',
    assignees: [
      { id: '1', name: 'Sarah Chen', avatar: '/avatars/sarah.jpg' },
      { id: '3', name: 'Alex Kim' },
    ],
    dueDate: '2026-02-02',
    createdAt: '2026-02-01',
    updatedAt: '2026-02-01',
    tags: ['Urgent', 'Crisis', 'Response'],
    subtasks: [
      { id: 's1', title: 'Draft response', completed: false },
      { id: 's2', title: 'Legal review', completed: false },
      { id: 's3', title: 'Publish', completed: false },
    ],
    comments: 15,
    attachments: 2,
    progress: 0,
  },
];

const teamMembers = [
  { id: '1', name: 'Sarah Chen', avatar: '/avatars/sarah.jpg', role: 'Content Lead' },
  { id: '2', name: 'Mike Ross', role: 'Social Media Manager' },
  { id: '3', name: 'Alex Kim', role: 'Analytics Specialist' },
  { id: '4', name: 'Emma Wilson', avatar: '/avatars/emma.jpg', role: 'Designer' },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const statusConfig = {
  todo: { label: 'To Do', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: Play },
  review: { label: 'In Review', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Pause },
  done: { label: 'Done', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: CheckCircle },
};

const priorityConfig = {
  low: { label: 'Low', color: 'bg-slate-500/20 text-slate-300', icon: ArrowDown },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-300', icon: ArrowRight },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-300', icon: ArrowUp },
  urgent: { label: 'Urgent', color: 'bg-red-500/20 text-red-300', icon: AlertCircle },
};

const typeConfig = {
  content: { label: 'Content', color: 'bg-cyan-500/20 text-cyan-300', icon: FileText },
  campaign: { label: 'Campaign', color: 'bg-pink-500/20 text-pink-300', icon: Target },
  analytics: { label: 'Analytics', color: 'bg-cyan-500/20 text-cyan-300', icon: TrendingUp },
  social: { label: 'Social', color: 'bg-cyan-500/20 text-cyan-300', icon: MessageSquare },
  design: { label: 'Design', color: 'bg-cyan-500/20 text-cyan-300', icon: Sparkles },
  other: { label: 'Other', color: 'bg-slate-500/20 text-slate-300', icon: ListTodo },
};

function TaskStatusBadge({ status }: { status: Task['status'] }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.color} border`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function TaskPriorityBadge({ priority }: { priority: Task['priority'] }) {
  const config = priorityConfig[priority];
  const Icon = config.icon;
  return (
    <Badge className={config.color}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function TaskTypeBadge({ type }: { type: Task['type'] }) {
  const config = typeConfig[type];
  const Icon = config.icon;
  return (
    <Badge className={config.color}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function AssigneeAvatars({ assignees, max = 3 }: { assignees: Task['assignees']; max?: number }) {
  const visible = assignees.slice(0, max);
  const overflow = assignees.length - max;

  return (
    <div className="flex -space-x-2">
      {visible.map((assignee) => (
        <Avatar key={assignee.id} className="w-7 h-7 border-2 border-slate-900">
          <AvatarImage src={assignee.avatar} alt={assignee.name} />
          <AvatarFallback className="text-xs bg-cyan-500/20 text-cyan-300">
            {assignee.name.split(' ').map((n) => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <div className="w-7 h-7 rounded-full bg-white/10 border-2 border-slate-900 flex items-center justify-center text-xs text-slate-400">
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TASK CARD COMPONENT
// ============================================================================

function TaskCard({ task, onEdit, onDelete, onStatusChange }: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
}) {
  const dueDate = new Date(task.dueDate);
  const isOverdue = dueDate < new Date() && task.status !== 'done';
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

  return (
    <Card variant="glass" className="hover:bg-white/[0.04] transition-all cursor-pointer group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <TaskTypeBadge type={task.type} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900/95 border-white/10">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'todo')}>
                <Circle className="w-4 h-4 mr-2" />
                Set To Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in_progress')}>
                <Play className="w-4 h-4 mr-2" />
                Set In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'review')}>
                <Pause className="w-4 h-4 mr-2" />
                Set In Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'done')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Set Done
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="font-semibold text-white mb-2 line-clamp-2">{task.title}</h3>
        <p className="text-sm text-slate-400 mb-3 line-clamp-2">{task.description}</p>

        {/* Subtasks Progress */}
        {task.subtasks.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Subtasks</span>
              <span>{completedSubtasks}/{task.subtasks.length}</span>
            </div>
            <Progress value={(completedSubtasks / task.subtasks.length) * 100} className="h-1" />
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded bg-white/5 text-slate-400">
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="text-xs px-2 py-0.5 text-slate-500">+{task.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div className="flex items-center gap-3">
            <AssigneeAvatars assignees={task.assignees} max={2} />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {task.comments > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {task.comments}
                </span>
              )}
              {task.attachments > 0 && (
                <span className="flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  {task.attachments}
                </span>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
            <Calendar className="w-3 h-3" />
            {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// KANBAN COLUMN COMPONENT
// ============================================================================

function KanbanColumn({ status, tasks, onEdit, onDelete, onStatusChange }: {
  status: Task['status'];
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px]">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-white">{config.label}</h3>
          <Badge variant="outline" className="ml-1 bg-white/5 text-slate-400 border-white/10">
            {tasks.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 rounded-lg border-2 border-dashed border-white/10 text-slate-500 text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LIST VIEW ROW COMPONENT
// ============================================================================

function TaskListRow({ task, onEdit, onDelete, onStatusChange }: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
}) {
  const dueDate = new Date(task.dueDate);
  const isOverdue = dueDate < new Date() && task.status !== 'done';
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] transition-all group">
      <Checkbox
        checked={task.status === 'done'}
        onCheckedChange={(checked) => onStatusChange(task.id, checked ? 'done' : 'todo')}
        className="data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`font-medium truncate ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>
            {task.title}
          </h4>
          {task.campaignName && (
            <Badge variant="outline" className="text-xs bg-white/5 border-white/10">
              {task.campaignName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <TaskTypeBadge type={task.type} />
          {task.subtasks.length > 0 && (
            <span>{completedSubtasks}/{task.subtasks.length} subtasks</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <TaskStatusBadge status={task.status} />
        <TaskPriorityBadge priority={task.priority} />
        <AssigneeAvatars assignees={task.assignees} max={2} />
        <div className={`flex items-center gap-1 text-sm ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
          <Calendar className="w-4 h-4" />
          {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-900/95 border-white/10">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-400">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================================================
// CREATE TASK DIALOG
// ============================================================================

function CreateTaskDialog({ open, onOpenChange, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: Partial<Task>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Task['type']>('content');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    setIsSubmitting(true);
    try {
      onSubmit({
        title,
        description,
        type,
        priority,
        dueDate: dueDate || new Date().toISOString().split('T')[0],
        assignees: assignees.map((id) => teamMembers.find((m) => m.id === id)!).filter(Boolean),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });

      // Reset form
      setTitle('');
      setDescription('');
      setType('content');
      setPriority('medium');
      setDueDate('');
      setAssignees([]);
      setTags('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900/95 border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription className="text-slate-400">
            Add a new task to your marketing workflow
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-slate-300">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              className="bg-white/5 border-white/10 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-slate-300">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task..."
              className="bg-white/5 border-white/10 mt-1 min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as Task['type'])}>
                <SelectTrigger className="bg-white/5 border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="w-4 h-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Task['priority'])}>
                <SelectTrigger className="bg-white/5 border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="w-4 h-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="dueDate" className="text-slate-300">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white/5 border-white/10 mt-1"
            />
          </div>

          <div>
            <Label className="text-slate-300">Assignees</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    if (assignees.includes(member.id)) {
                      setAssignees(assignees.filter((id) => id !== member.id));
                    } else {
                      setAssignees([...assignees, member.id]);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                    assignees.includes(member.id)
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="text-xs">{member.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{member.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="tags" className="text-slate-300">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Enter tags separated by commas"
              className="bg-white/5 border-white/10 mt-1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gradient-primary">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Task['status'] | 'all'>('all');
  const [filterType, setFilterType] = useState<Task['type'] | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Task['priority'] | 'all'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to get auth token
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');
  }, []);

  // Map API response to frontend Task format
  const mapApiTaskToTask = useCallback((t: Record<string, unknown>): Task => ({
    id: t.id as string,
    title: t.title as string,
    description: (t.description as string) || '',
    status: ((t.status as string) || 'todo').replace('-', '_') as Task['status'],
    priority: ((t.priority as string) || 'medium') as Task['priority'],
    type: ((t.category as string) || 'other') as Task['type'],
    assignees: t.assigneeId ? [{ id: t.assigneeId as string, name: 'Assigned' }] : [],
    dueDate: t.dueDate ? new Date(t.dueDate as string).toISOString().split('T')[0] : '',
    createdAt: (t.createdAt as string) || new Date().toISOString(),
    updatedAt: (t.updatedAt as string) || new Date().toISOString(),
    tags: (t.tags as string[]) || [],
    subtasks: [],
    comments: 0,
    attachments: 0,
    progress: (t.progress as number) || 0,
    campaignId: t.campaignId as string | undefined,
  }), []);

  // Load tasks on mount
  useEffect(() => {
    const loadTasks = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = getAuthToken();
        if (token) {
          const response = await fetch('/api/tasks', {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.ok) {
            const { data } = await response.json();
            const apiTasks: Task[] = data.map(mapApiTaskToTask);

            if (apiTasks.length > 0) {
              setTasks(apiTasks);
              setIsLoading(false);
              return;
            }
          }
        }
        // Fall back to mock data for demo (unauthenticated users)
        await new Promise(resolve => setTimeout(resolve, 500));
        setTasks(mockTasks);
        setIsLoading(false);
      } catch (err) {
        setTasks(mockTasks);
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [getAuthToken, mapApiTaskToTask]);

  const handleRetry = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (token) {
        const response = await fetch('/api/tasks', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const { data } = await response.json();
          const apiTasks = data.map(mapApiTaskToTask);
          setTasks(apiTasks.length > 0 ? apiTasks : mockTasks);
          setIsLoading(false);
          return;
        }
      }
      setTasks(mockTasks);
      setIsLoading(false);
    } catch {
      setTasks(mockTasks);
      setIsLoading(false);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesType = filterType === 'all' || task.type === filterType;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });
  }, [tasks, searchQuery, filterStatus, filterType, filterPriority]);

  // Group tasks by status for kanban view
  const tasksByStatus = useMemo(() => ({
    todo: filteredTasks.filter((t) => t.status === 'todo'),
    in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
    review: filteredTasks.filter((t) => t.status === 'review'),
    done: filteredTasks.filter((t) => t.status === 'done'),
  }), [filteredTasks]);

  // Stats
  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'done').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    overdue: tasks.filter((t) => new Date(t.dueDate) < new Date() && t.status !== 'done').length,
  }), [tasks]);

  // Handlers
  const handleCreateTask = useCallback(async (taskData: Partial<Task>) => {
    const token = getAuthToken();

    // Optimistically add to UI with temp ID
    const tempId = `temp-${Date.now()}`;
    const newTask: Task = {
      id: tempId,
      title: taskData.title || '',
      description: taskData.description || '',
      status: 'todo',
      priority: taskData.priority || 'medium',
      type: taskData.type || 'content',
      assignees: taskData.assignees || [],
      dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: taskData.tags || [],
      subtasks: [],
      comments: 0,
      attachments: 0,
      progress: 0,
    };
    setTasks(prev => [newTask, ...prev]);

    if (token) {
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: taskData.title,
            description: taskData.description,
            status: 'todo',
            priority: taskData.priority || 'medium',
            category: taskData.type || 'content',
            tags: taskData.tags || [],
            dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
          }),
        });

        if (response.ok) {
          const { data } = await response.json();
          // Replace temp task with real one from API
          setTasks(prev => prev.map(t => t.id === tempId ? mapApiTaskToTask(data) : t));
          toast.success('Task created successfully!');
        } else {
          toast.success('Task created locally');
        }
      } catch (err) {
        console.error('Failed to sync task to API:', err);
        toast.success('Task created locally');
      }
    } else {
      toast.success('Task created successfully!');
    }
  }, [getAuthToken, mapApiTaskToTask]);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    toast.success('Edit dialog would open here');
  }, []);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    const token = getAuthToken();

    // Optimistically remove from UI
    setTasks(prev => prev.filter((t) => t.id !== taskId));

    if (token && !taskId.startsWith('temp-') && !taskId.startsWith('task-')) {
      try {
        const response = await fetch(`/api/tasks?id=${taskId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          toast.success('Task deleted');
        } else {
          toast.success('Task deleted locally');
        }
      } catch (err) {
        console.error('Failed to delete task from API:', err);
        toast.success('Task deleted locally');
      }
    } else {
      toast.success('Task deleted');
    }
  }, [getAuthToken]);

  const handleStatusChange = useCallback(async (taskId: string, status: Task['status']) => {
    const token = getAuthToken();

    // Optimistically update in UI
    setTasks(prev => prev.map((t) =>
      t.id === taskId ? { ...t, status, updatedAt: new Date().toISOString() } : t
    ));

    if (token && !taskId.startsWith('temp-') && !taskId.startsWith('task-')) {
      try {
        // Map frontend status to API status format
        const apiStatus = status.replace('_', '-');
        const response = await fetch('/api/tasks', {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: taskId, status: apiStatus }),
        });

        if (response.ok) {
          toast.success(`Task moved to ${statusConfig[status].label}`);
        } else {
          toast.success(`Task moved to ${statusConfig[status].label} (locally)`);
        }
      } catch (err) {
        console.error('Failed to update task status:', err);
        toast.success(`Task moved to ${statusConfig[status].label} (locally)`);
      }
    } else {
      toast.success(`Task moved to ${statusConfig[status].label}`);
    }
  }, [getAuthToken]);

  // Show loading skeleton
  if (isLoading) {
    return <TasksSkeleton />;
  }

  // Show error state
  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard
          title="Tasks Error"
          message={error}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Tasks</h1>
          <p className="text-slate-400 mt-1">
            Manage your marketing tasks and workflows
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Button variant="outline" className="bg-white/5 border-white/10">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <p className="text-xs text-slate-500 mt-1">Active tasks</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">In Progress</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.inProgress}</div>
            <p className="text-xs text-slate-500 mt-1">Currently working on</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.completed}</div>
            <p className="text-xs text-slate-500 mt-1">
              {((stats.completed / stats.total) * 100).toFixed(0)}% completion rate
            </p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.overdue}</div>
            <p className="text-xs text-slate-500 mt-1">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="pl-10 w-64 bg-white/5 border-white/10"
            />
          </div>

          {/* Type Filter */}
          <Select value={filterType} onValueChange={(v) => setFilterType(v as Task['type'] | 'all')}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(typeConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as Task['priority'] | 'all')}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {Object.entries(priorityConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('kanban')}
            className={view === 'kanban' ? 'bg-white/10' : ''}
          >
            <KanbanSquare className="w-4 h-4 mr-1" />
            Kanban
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('list')}
            className={view === 'list' ? 'bg-white/10' : ''}
          >
            <LayoutList className="w-4 h-4 mr-1" />
            List
          </Button>
        </div>
      </div>

      {/* Task Views */}
      {view === 'kanban' ? (
        <div className="flex gap-6 overflow-x-auto pb-4">
          {(['todo', 'in_progress', 'review', 'done'] as const).map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <ListTodo className="h-16 w-16 mx-auto mb-4 text-slate-500" />
              <h3 className="text-xl font-semibold text-white mb-2">No Tasks Found</h3>
              <p className="text-slate-400">
                {searchQuery ? 'Try adjusting your search or filters' : 'Create your first task to get started'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <TaskListRow
                key={task.id}
                task={task}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onStatusChange={handleStatusChange}
              />
            ))
          )}
        </div>
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateTask}
      />
    </div>
  );
}
