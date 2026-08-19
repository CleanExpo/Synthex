'use client';

/**
 * Create Task Dialog Component
 * Form dialog for creating new tasks
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from '@/components/icons';
import { toast } from 'sonner';
import {
  typeConfig,
  priorityConfig,
  listAgencyTasks,
  getAgencyTask,
} from './task-config';
import type { Task, TaskType, TaskPriority, TeamMember } from './types';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: Partial<Task>) => void;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('content');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [agencyTaskId, setAgencyTaskId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);

  const ceoTasks = listAgencyTasks({ ceoTop15Only: true });
  const otherTasks = listAgencyTasks().filter(t => !t.ceoTop15);

  // Fetch on open rather than on mount: the dialog is rendered by the board
  // whether or not it is showing.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const fetchTeamMembers = async () => {
      setIsLoadingTeam(true);
      try {
        const response = await fetch('/api/team', { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!cancelled) setTeamMembers(Array.isArray(data) ? data : []);
      } catch (error) {
        // An empty assignee list is the honest failure here. Falling back to
        // placeholder names is what put fictional people on this board.
        if (!cancelled) {
          setTeamMembers([]);
          toast.error('Could not load team members');
        }
        console.error('Failed to fetch team members:', error);
      } finally {
        if (!cancelled) setIsLoadingTeam(false);
      }
    };

    fetchTeamMembers();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    setIsSubmitting(true);
    try {
      const agencyMeta = agencyTaskId ? getAgencyTask(agencyTaskId) : undefined;
      onSubmit({
        title,
        description,
        type: agencyMeta?.defaultTaskType ?? type,
        priority,
        dueDate: dueDate || new Date().toISOString().split('T')[0],
        assignees: assignees
          .map(id => teamMembers.find(m => m.id === id)!)
          .filter(Boolean),
        tags: [
          ...tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean),
          ...(agencyTaskId ? [agencyTaskId] : []),
        ],
        agencyTaskId: agencyTaskId || undefined,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setType('content');
      setPriority('medium');
      setDueDate('');
      setAssignees([]);
      setTags('');
      setAgencyTaskId('');
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
          <DialogDescription className="text-slate-300">
            Add a new task to your marketing workflow
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-slate-300">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter task title"
              className="bg-white/5 border-white/10 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-slate-300">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the task..."
              className="bg-white/5 border-white/10 mt-1 min-h-[100px]"
            />
          </div>

          <div>
            <Label className="text-slate-300">
              Agency service line (optional)
            </Label>
            <Select
              value={agencyTaskId || '__none__'}
              onValueChange={v => {
                const id = v === '__none__' ? '' : v;
                setAgencyTaskId(id);
                const meta = id ? getAgencyTask(id) : undefined;
                if (meta) setType(meta.defaultTaskType);
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10 mt-1">
                <SelectValue placeholder="Link to AT-* catalog" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None — generic task</SelectItem>
                {ceoTasks.map(task => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.id} — {task.label}
                  </SelectItem>
                ))}
                {otherTasks.map(task => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.id} — {task.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Type</Label>
              <Select value={type} onValueChange={v => setType(v as TaskType)}>
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
              <Select
                value={priority}
                onValueChange={v => setPriority(v as TaskPriority)}
              >
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
            <Label htmlFor="dueDate" className="text-slate-300">
              Due Date
            </Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="bg-white/5 border-white/10 mt-1"
            />
          </div>

          <div>
            <Label className="text-slate-300">Assignee</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {isLoadingTeam && (
                <span className="text-sm text-slate-400">
                  Loading team members…
                </span>
              )}
              {!isLoadingTeam && teamMembers.length === 0 && (
                <span className="text-sm text-slate-400">
                  No team members available to assign.
                </span>
              )}
              {teamMembers.map(member => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    // Single-select: Task.assigneeId holds one user, so a
                    // multi-select would promise more than the row can store
                    // and quietly drop the rest on save.
                    setAssignees(
                      assignees.includes(member.id) ? [] : [member.id]
                    );
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                    assignees.includes(member.id)
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="text-xs">
                      {member.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{member.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="tags" className="text-slate-300">
              Tags
            </Label>
            <Input
              id="tags"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Enter tags separated by commas"
              className="bg-white/5 border-white/10 mt-1"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gradient-primary"
            >
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
