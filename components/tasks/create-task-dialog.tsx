'use client';

/**
 * Create Task Dialog Component
 * Form dialog for creating new tasks
 */

import { useState } from 'react';
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
import toast from 'react-hot-toast';
import { typeConfig, priorityConfig, teamMembers } from './task-config';
import type { Task, TaskType, TaskPriority } from './types';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: Partial<Task>) => void;
}

export function CreateTaskDialog({ open, onOpenChange, onSubmit }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('content');
  const [priority, setPriority] = useState<TaskPriority>('medium');
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
              <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
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
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
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
