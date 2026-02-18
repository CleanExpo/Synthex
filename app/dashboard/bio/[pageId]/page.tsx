'use client';

/**
 * Bio Page Editor
 *
 * @description Full-featured editor for bio pages with live preview.
 * Two-column layout: editor on left, mobile preview on right.
 */

import { useState, useCallback, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useLinkBio, LinkBioPage, LinkBioLink } from '@/hooks/useLinkBio';
import { BioPagePreview } from '@/components/bio/BioPagePreview';
import { ThemePicker } from '@/components/bio/ThemePicker';
import { BIO_THEMES } from '@/lib/bio/themes';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Save,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Star,
  Loader2,
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
  Facebook,
  Github,
  Globe,
  Mail,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// Social platform options
const SOCIAL_PLATFORMS = [
  { id: 'twitter', label: 'X (Twitter)', icon: Twitter },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'email', label: 'Email', icon: Mail },
];

interface PageProps {
  params: Promise<{ pageId: string }>;
}

export default function BioPageEditor({ params }: PageProps) {
  const { pageId } = use(params);
  const router = useRouter();
  const {
    currentPage,
    links,
    isLoading,
    error,
    updatePage,
    addLink,
    updateLink,
    deleteLink,
    reorderLinks,
  } = useLinkBio({ pageId });

  // Local state for editing (to enable instant preview)
  const [localPage, setLocalPage] = useState<Partial<LinkBioPage> | null>(null);
  const [localLinks, setLocalLinks] = useState<LinkBioLink[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dialog states
  const [showAddLinkDialog, setShowAddLinkDialog] = useState(false);
  const [showSocialDialog, setShowSocialDialog] = useState(false);
  const [editingSocial, setEditingSocial] = useState<{ platform: string; url: string } | null>(null);

  // Link form state
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkIcon, setNewLinkIcon] = useState('');

  // Initialize local state from fetched data
  useEffect(() => {
    if (currentPage && !localPage) {
      setLocalPage({
        title: currentPage.title,
        bio: currentPage.bio,
        avatarUrl: currentPage.avatarUrl,
        coverUrl: currentPage.coverUrl,
        theme: currentPage.theme,
        primaryColor: currentPage.primaryColor,
        backgroundColor: currentPage.backgroundColor,
        textColor: currentPage.textColor,
        buttonStyle: currentPage.buttonStyle,
        socialLinks: currentPage.socialLinks,
        isPublished: currentPage.isPublished,
        showBranding: currentPage.showBranding,
      });
    }
  }, [currentPage, localPage]);

  useEffect(() => {
    if (links.length > 0 && localLinks.length === 0) {
      setLocalLinks(links);
    }
  }, [links, localLinks.length]);

  // Update local state
  const updateLocalPage = useCallback((updates: Partial<LinkBioPage>) => {
    setLocalPage((prev) => (prev ? { ...prev, ...updates } : updates));
    setHasChanges(true);
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    if (!localPage || !currentPage) return;

    setIsSaving(true);
    const success = await updatePage(currentPage.id, localPage);
    setIsSaving(false);

    if (success) {
      setHasChanges(false);
    }
  }, [localPage, currentPage, updatePage]);

  // Toggle publish
  const handleTogglePublish = useCallback(async () => {
    if (!currentPage) return;

    const newPublished = !localPage?.isPublished;
    updateLocalPage({ isPublished: newPublished });
    await updatePage(currentPage.id, { isPublished: newPublished });
  }, [currentPage, localPage?.isPublished, updateLocalPage, updatePage]);

  // Add link
  const handleAddLink = useCallback(async () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim() || !currentPage) return;

    const link = await addLink(currentPage.id, {
      title: newLinkTitle.trim(),
      url: newLinkUrl.trim(),
      iconType: newLinkIcon ? 'emoji' : undefined,
      iconValue: newLinkIcon || undefined,
    });

    if (link) {
      setLocalLinks((prev) => [...prev, link]);
      setShowAddLinkDialog(false);
      setNewLinkTitle('');
      setNewLinkUrl('');
      setNewLinkIcon('');
    }
  }, [newLinkTitle, newLinkUrl, newLinkIcon, currentPage, addLink]);

  // Update link locally
  const handleUpdateLink = useCallback(
    async (linkId: string, updates: Partial<LinkBioLink>) => {
      setLocalLinks((prev) =>
        prev.map((l) => (l.id === linkId ? { ...l, ...updates } : l))
      );
      if (currentPage) {
        await updateLink(currentPage.id, linkId, updates);
      }
    },
    [currentPage, updateLink]
  );

  // Delete link
  const handleDeleteLink = useCallback(
    async (linkId: string) => {
      setLocalLinks((prev) => prev.filter((l) => l.id !== linkId));
      if (currentPage) {
        await deleteLink(currentPage.id, linkId);
      }
    },
    [currentPage, deleteLink]
  );

  // Update social links
  const handleUpdateSocial = useCallback(
    (platform: string, url: string) => {
      const currentSocials = (localPage?.socialLinks as Array<{ platform: string; url: string }>) || [];
      const existing = currentSocials.find((s) => s.platform === platform);

      let newSocials: Array<{ platform: string; url: string }>;
      if (url) {
        if (existing) {
          newSocials = currentSocials.map((s) =>
            s.platform === platform ? { ...s, url } : s
          );
        } else {
          newSocials = [...currentSocials, { platform, url }];
        }
      } else {
        newSocials = currentSocials.filter((s) => s.platform !== platform);
      }

      updateLocalPage({ socialLinks: newSocials });
      setShowSocialDialog(false);
      setEditingSocial(null);
    },
    [localPage?.socialLinks, updateLocalPage]
  );

  // Apply theme
  const handleApplyTheme = useCallback(
    (themeId: string) => {
      const theme = BIO_THEMES.find((t) => t.id === themeId);
      if (theme) {
        updateLocalPage({
          theme: theme.id,
          primaryColor: theme.primaryColor,
          backgroundColor: theme.backgroundColor,
          textColor: theme.textColor,
          buttonStyle: theme.buttonStyle,
        });
      }
    },
    [updateLocalPage]
  );

  // Copy URL
  const handleCopyUrl = useCallback(() => {
    if (!currentPage) return;
    const url = `${window.location.origin}/bio/${currentPage.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentPage]);

  // Loading state
  if (isLoading && !currentPage) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  // Error state
  if (error || !currentPage) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Page not found'}</p>
          <Button onClick={() => router.push('/dashboard/bio')}>
            Back to Bio Pages
          </Button>
        </div>
      </div>
    );
  }

  const socialLinks = (localPage?.socialLinks as Array<{ platform: string; url: string }>) || [];

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/dashboard/bio')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {localPage?.title || currentPage.title}
              </h1>
              <p className="text-sm text-gray-400">/{currentPage.slug}</p>
            </div>
            <Badge
              variant={localPage?.isPublished ? 'default' : 'secondary'}
              className={cn(
                localPage?.isPublished
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
              )}
            >
              {localPage?.isPublished ? 'Published' : 'Draft'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUrl}
              className="gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy URL'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/bio/${currentPage.slug}`, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Preview
            </Button>
            <Button
              variant={localPage?.isPublished ? 'outline' : 'default'}
              size="sm"
              onClick={handleTogglePublish}
            >
              {localPage?.isPublished ? 'Unpublish' : 'Publish'}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Profile Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Profile</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Avatar URL</Label>
                <Input
                  placeholder="https://..."
                  value={localPage?.avatarUrl || ''}
                  onChange={(e) => updateLocalPage({ avatarUrl: e.target.value || null })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cover Image URL</Label>
                <Input
                  placeholder="https://..."
                  value={localPage?.coverUrl || ''}
                  onChange={(e) => updateLocalPage({ coverUrl: e.target.value || null })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={localPage?.title || ''}
                onChange={(e) => updateLocalPage({ title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                placeholder="Tell visitors about yourself..."
                value={localPage?.bio || ''}
                onChange={(e) => updateLocalPage({ bio: e.target.value || null })}
                rows={3}
              />
            </div>
          </section>

          {/* Links Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Links</h2>
              <Button
                size="sm"
                onClick={() => setShowAddLinkDialog(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Link
              </Button>
            </div>

            {localLinks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No links yet. Add your first link above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {localLinks
                  .sort((a, b) => a.order - b.order)
                  .map((link) => (
                    <div
                      key={link.id}
                      className={cn(
                        'flex items-center gap-3 p-3 bg-gray-900/50 border border-white/10 rounded-lg',
                        !link.isVisible && 'opacity-50'
                      )}
                    >
                      <GripVertical className="w-5 h-5 text-gray-500 cursor-grab" />

                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          value={link.title}
                          onChange={(e) =>
                            handleUpdateLink(link.id, { title: e.target.value })
                          }
                          placeholder="Title"
                          className="h-8"
                        />
                        <Input
                          value={link.url}
                          onChange={(e) =>
                            handleUpdateLink(link.id, { url: e.target.value })
                          }
                          placeholder="URL"
                          className="h-8"
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleUpdateLink(link.id, { isVisible: !link.isVisible })
                        }
                        title={link.isVisible ? 'Hide' : 'Show'}
                      >
                        {link.isVisible ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleUpdateLink(link.id, {
                            isHighlighted: !link.isHighlighted,
                          })
                        }
                        title={link.isHighlighted ? 'Remove highlight' : 'Highlight'}
                        className={cn(
                          link.isHighlighted && 'text-yellow-400'
                        )}
                      >
                        <Star className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteLink(link.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* Social Links Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Social Links</h2>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.map((platform) => {
                const Icon = platform.icon;
                const existing = socialLinks.find(
                  (s) => s.platform.toLowerCase() === platform.id
                );

                return (
                  <Button
                    key={platform.id}
                    variant={existing ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => {
                      setEditingSocial({
                        platform: platform.id,
                        url: existing?.url || '',
                      });
                      setShowSocialDialog(true);
                    }}
                    className={cn(
                      'w-10 h-10',
                      existing && 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    )}
                    title={platform.label}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                );
              })}
            </div>
          </section>

          {/* Theme Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Theme</h2>
            <ThemePicker
              currentTheme={localPage?.theme || 'default'}
              primaryColor={localPage?.primaryColor || '#06b6d4'}
              backgroundColor={localPage?.backgroundColor || '#0f172a'}
              textColor={localPage?.textColor || '#ffffff'}
              buttonStyle={(localPage?.buttonStyle as 'rounded' | 'pill' | 'square') || 'rounded'}
              onThemeSelect={handleApplyTheme}
              onColorChange={(colors) => updateLocalPage(colors)}
              onButtonStyleChange={(style) => updateLocalPage({ buttonStyle: style })}
            />
          </section>

          {/* Settings Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 border border-white/10 rounded-lg">
              <div>
                <p className="font-medium text-white">Show Branding</p>
                <p className="text-sm text-gray-400">
                  Display "Powered by Synthex" in the footer
                </p>
              </div>
              <Switch
                checked={localPage?.showBranding ?? true}
                onCheckedChange={(checked) =>
                  updateLocalPage({ showBranding: checked })
                }
              />
            </div>
          </section>
        </div>

        {/* Preview Panel */}
        <div className="w-[400px] border-l border-white/10 bg-gray-900/30 p-6 flex items-start justify-center overflow-y-auto">
          <BioPagePreview
            page={{
              title: localPage?.title || '',
              bio: localPage?.bio || null,
              avatarUrl: localPage?.avatarUrl || null,
              coverUrl: localPage?.coverUrl || null,
              theme: localPage?.theme || 'default',
              primaryColor: localPage?.primaryColor || '#06b6d4',
              backgroundColor: localPage?.backgroundColor || '#0f172a',
              textColor: localPage?.textColor || '#ffffff',
              buttonStyle: localPage?.buttonStyle || 'rounded',
              socialLinks: socialLinks,
              showBranding: localPage?.showBranding ?? true,
            }}
            links={localLinks.filter((l) => l.isVisible)}
          />
        </div>
      </div>

      {/* Add Link Dialog */}
      <Dialog open={showAddLinkDialog} onOpenChange={setShowAddLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="My Website"
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                placeholder="https://..."
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon (emoji, optional)</Label>
              <Input
                placeholder="e.g. 🔗"
                value={newLinkIcon}
                onChange={(e) => setNewLinkIcon(e.target.value)}
                maxLength={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddLinkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddLink}
              disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
            >
              Add Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Social Link Dialog */}
      <Dialog open={showSocialDialog} onOpenChange={setShowSocialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSocial
                ? `Edit ${SOCIAL_PLATFORMS.find((p) => p.id === editingSocial.platform)?.label}`
                : 'Edit Social Link'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                placeholder={
                  editingSocial?.platform === 'email'
                    ? 'mailto:you@example.com'
                    : 'https://...'
                }
                value={editingSocial?.url || ''}
                onChange={(e) =>
                  setEditingSocial((prev) =>
                    prev ? { ...prev, url: e.target.value } : null
                  )
                }
              />
            </div>
          </div>
          <DialogFooter>
            {editingSocial?.url && (
              <Button
                variant="destructive"
                onClick={() => handleUpdateSocial(editingSocial.platform, '')}
              >
                Remove
              </Button>
            )}
            <Button variant="ghost" onClick={() => setShowSocialDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingSocial &&
                handleUpdateSocial(editingSocial.platform, editingSocial.url)
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
