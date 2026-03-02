'use client';

import { useState, useEffect } from 'react';
import { Globe, Plus, ExternalLink, Edit, Trash2, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

interface WebProject {
  id: string;
  name: string;
  description?: string | null;
  status: 'draft' | 'active' | 'archived';
  websiteUrl?: string | null;
  domain?: string | null;
  pages?: number | null;
  colors?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLOURS: Record<string, string> = {
  draft: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  archived: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export default function WebProjectsPage() {
  const [projects, setProjects] = useState<WebProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', websiteUrl: '' });

  async function fetchProjects() {
    try {
      const res = await fetch('/api/web-projects', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch {
      // fail silently for now — show empty state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/web-projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          websiteUrl: form.websiteUrl.trim() || undefined,
          status: 'draft',
        }),
      });

      if (!res.ok) throw new Error('Failed to create');
      const data = await res.json();
      setProjects((prev) => [data.project, ...prev]);
      setForm({ name: '', description: '', websiteUrl: '' });
      setDialogOpen(false);
    } catch {
      // handle error
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await fetch(`/api/web-projects/${id}`, { method: 'DELETE', credentials: 'include' });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // handle error
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Web Projects</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage website builds, design tokens, and animation templates.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Create Web Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  placeholder="My Client Site"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="bg-white/5 border-white/10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the project…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="bg-white/5 border-white/10 resize-none"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://example.com"
                  value={form.websiteUrl}
                  onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !form.name.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Project
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Globe className="w-16 h-16 text-gray-700 mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No web projects yet</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm">
            Create your first web project to start managing builds, design tokens, and animation templates.
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            Create First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const status = project.status ?? 'draft';
            const pages = project.pages ?? 0;
            const websiteUrl = project.websiteUrl;

            return (
              <div
                key={project.id}
                className="group relative bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all"
              >
                {/* Status badge */}
                <div className="flex items-start justify-between mb-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLOURS[status] ?? STATUS_COLOURS.draft}`}
                  >
                    {status}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/dashboard/web-projects/${project.id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white">
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-red-400"
                      onClick={() => handleDelete(project.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Project name */}
                <Link href={`/dashboard/web-projects/${project.id}`}>
                  <h3 className="font-semibold text-white hover:text-cyan-400 transition-colors line-clamp-1 mb-1">
                    {project.name}
                  </h3>
                </Link>

                {/* Description */}
                {project.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{project.description}</p>
                )}

                {/* Meta row */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.06] text-xs text-gray-500">
                  <span>{pages} {pages === 1 ? 'page' : 'pages'}</span>
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Site
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
