'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Globe,
  Palette,
  Layers,
  Settings,
  Save,
  Loader2,
  Copy,
  Check,
  ExternalLink,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
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

// ── GSAP Animation Templates ────────────────────────────────────────────────

const ANIMATION_TEMPLATES = [
  {
    id: 'hero-reveal',
    title: 'Hero Line-Mask Reveal',
    description: 'Clips each headline line upward into view on page load.',
    code: `// Hero line-mask reveal
gsap.registerPlugin(SplitText);

const split = SplitText.create('.hero-heading', { type: 'lines' });
gsap.from(split.lines, {
  yPercent: 110,
  opacity: 0,
  duration: 0.8,
  ease: 'power3.out',
  stagger: 0.12,
  delay: 0.2,
});`,
  },
  {
    id: 'scroll-stagger',
    title: 'Scroll Stagger Cards',
    description: 'Cards fade and rise into view as they enter the viewport.',
    code: `// Scroll stagger cards
gsap.registerPlugin(ScrollTrigger);

gsap.from('.card', {
  scrollTrigger: {
    trigger: '.cards-container',
    start: 'top 80%',
  },
  y: 40,
  opacity: 0,
  duration: 0.6,
  ease: 'power2.out',
  stagger: 0.15,
});`,
  },
  {
    id: 'pinned-quote',
    title: 'Pinned Quote Section',
    description: 'Quote pins in the viewport while the next section scrolls over it.',
    code: `// Pinned quote section
gsap.registerPlugin(ScrollTrigger);

ScrollTrigger.create({
  trigger: '.quote-section',
  pin: true,
  start: 'top top',
  end: '+=100%',
  scrub: true,
});

gsap.from('.quote-text', {
  scrollTrigger: {
    trigger: '.quote-section',
    start: 'top center',
  },
  opacity: 0,
  scale: 0.9,
  duration: 1,
  ease: 'power2.out',
});`,
  },
  {
    id: 'horizontal-gallery',
    title: 'Horizontal Scroll Gallery',
    description: 'A gallery panel that scrolls horizontally while the page scrolls vertically.',
    code: `// Horizontal scroll gallery
gsap.registerPlugin(ScrollTrigger);

const sections = gsap.utils.toArray<HTMLElement>('.gallery-item');
const wrapper = document.querySelector<HTMLElement>('.gallery-track')!;

gsap.to(sections, {
  xPercent: -100 * (sections.length - 1),
  ease: 'none',
  scrollTrigger: {
    trigger: '.gallery-section',
    pin: true,
    scrub: 1,
    snap: 1 / (sections.length - 1),
    end: () => '+=' + wrapper.offsetWidth,
  },
});`,
  },
];

type Tab = 'overview' | 'design-tokens' | 'animation-templates' | 'settings';

export default function WebProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<WebProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Editable form fields
  const [form, setForm] = useState({
    name: '',
    description: '',
    websiteUrl: '',
    domain: '',
    status: 'draft' as 'draft' | 'active' | 'archived',
  });

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/web-projects/${id}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setProject(data.project);
        setForm({
          name: data.project.name ?? '',
          description: data.project.description ?? '',
          websiteUrl: data.project.websiteUrl ?? '',
          domain: data.project.domain ?? '',
          status: data.project.status ?? 'draft',
        });
      } catch {
        router.push('/dashboard/web-projects');
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [id, router]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/web-projects/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          websiteUrl: form.websiteUrl || undefined,
          domain: form.domain || undefined,
          status: form.status,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setProject(data.project);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  function copyCode(templateId: string, code: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(templateId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Globe className="w-4 h-4" /> },
    { id: 'design-tokens', label: 'Design Tokens', icon: <Palette className="w-4 h-4" /> },
    { id: 'animation-templates', label: 'Animation Templates', icon: <Layers className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!project) return null;

  const status = project.status ?? 'draft';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/web-projects">
          <Button variant="ghost" size="icon" className="mt-0.5 text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white truncate">{project.name}</h1>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${
                status === 'active'
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : status === 'archived'
                  ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
              }`}
            >
              {status}
            </span>
          </div>
          {project.description && (
            <p className="text-gray-400 text-sm mt-1">{project.description}</p>
          )}
          {project.websiteUrl && (
            <a
              href={project.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-sm mt-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {project.websiteUrl}
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.08] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-cyan-400 border-cyan-400'
                : 'text-gray-400 border-transparent hover:text-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Pages', value: project.pages ?? 0 },
              { label: 'Colours', value: (project.colors ?? []).length },
              { label: 'Status', value: status },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4"
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-xl font-bold text-white capitalize">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-white">Project Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))
                  }
                  className="w-full rounded-md bg-white/5 border border-white/10 text-white px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="bg-white/5 border-white/10 resize-none"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Website URL</Label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={form.websiteUrl}
                  onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Domain</Label>
                <Input
                  placeholder="example.com"
                  value={form.domain}
                  onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'design-tokens' && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 text-center">
          <Palette className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <h3 className="font-medium text-gray-300 mb-1">Design Tokens</h3>
          <p className="text-sm text-gray-500">
            Store your colour palette, typography scale, and spacing tokens here.
            Coming soon — paste your CSS variables or Tailwind config to get started.
          </p>
        </div>
      )}

      {activeTab === 'animation-templates' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Copy these GSAP presets directly into your project. Each template uses GSAP 3 with
            ScrollTrigger — install with{' '}
            <code className="bg-white/10 px-1.5 py-0.5 rounded text-cyan-300 text-xs">
              npm install gsap
            </code>
            .
          </p>

          {ANIMATION_TEMPLATES.map((template) => (
            <div
              key={template.id}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden"
            >
              <div className="flex items-start justify-between p-4 border-b border-white/[0.06]">
                <div>
                  <h3 className="font-semibold text-white">{template.title}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">{template.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white gap-2 ml-4 shrink-0"
                  onClick={() => copyCode(template.id, template.code)}
                >
                  {copiedId === template.id ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <pre className="p-4 text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed">
                <code>{template.code}</code>
              </pre>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
            <h2 className="font-semibold text-white mb-4">Settings</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Project Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
            </div>
          </div>

          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
            <h3 className="font-semibold text-red-400 mb-1">Danger Zone</h3>
            <p className="text-sm text-gray-400 mb-3">
              Permanently delete this project and all its data.
            </p>
            <Button
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={async () => {
                if (!confirm('Delete this project permanently? This cannot be undone.')) return;
                await fetch(`/api/web-projects/${id}`, {
                  method: 'DELETE',
                  credentials: 'include',
                });
                router.push('/dashboard/web-projects');
              }}
            >
              Delete Project
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
