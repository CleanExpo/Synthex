'use client';

/**
 * Affiliate Link Form
 *
 * @description Modal form for adding/editing affiliate links.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Link as LinkIcon, Loader2, Plus, Zap } from '@/components/icons';
import type {
  AffiliateLink,
  AffiliateNetwork,
  CreateLinkInput,
  UpdateLinkInput,
} from '@/hooks/useAffiliateLinks';

interface LinkFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateLinkInput | UpdateLinkInput) => Promise<void>;
  link?: AffiliateLink | null;
  networks: AffiliateNetwork[];
  isLoading?: boolean;
}

export function LinkForm({
  isOpen,
  onClose,
  onSubmit,
  link,
  networks,
  isLoading,
}: LinkFormProps) {
  const isEditing = !!link;

  const [name, setName] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);
  const [productName, setProductName] = useState('');
  const [productImage, setProductImage] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [autoInsert, setAutoInsert] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [isActive, setIsActive] = useState(true);

  // QA-AUDIT-2026-03-14 (M11): Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset form when link changes
  useEffect(() => {
    if (link) {
      setName(link.name);
      setNetworkId(link.networkId || '');
      setOriginalUrl(link.originalUrl);
      setAffiliateUrl(link.affiliateUrl);
      setShortCode(link.shortCode || '');
      setAutoGenerateCode(false);
      setProductName(link.productName || '');
      setProductImage(link.productImage || '');
      setCategory(link.category || '');
      setTags(link.tags || []);
      setAutoInsert(link.autoInsert);
      setKeywords(link.keywords || []);
      setIsActive(link.isActive);
    } else {
      setName('');
      setNetworkId('');
      setOriginalUrl('');
      setAffiliateUrl('');
      setShortCode('');
      setAutoGenerateCode(true);
      setProductName('');
      setProductImage('');
      setCategory('');
      setTags([]);
      setAutoInsert(false);
      setKeywords([]);
      setIsActive(true);
    }
    setTagInput('');
    setKeywordInput('');
  }, [link, isOpen]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateLinkInput | UpdateLinkInput = {
      name,
      networkId: networkId || undefined,
      originalUrl,
      affiliateUrl,
      shortCode: autoGenerateCode ? undefined : shortCode || undefined,
      productName: productName || undefined,
      productImage: productImage || undefined,
      category: category || undefined,
      tags,
      autoInsert,
      keywords,
      isActive,
    };

    await onSubmit(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit affiliate link' : 'Add affiliate link'}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-950 border border-white/10 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-gray-950">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Link' : 'Add Affiliate Link'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Link Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Blue Widget Pro"
                required
                aria-label="Link name"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              />
            </div>

            {/* Network */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Network
              </label>
              <select
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
                aria-label="Network"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              >
                <option value="">No network</option>
                {networks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* URLs */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Original URL *
              </label>
              <input
                type="url"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                placeholder="https://example.com/product"
                required
                aria-label="Original URL"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Affiliate URL *
              </label>
              <input
                type="url"
                value={affiliateUrl}
                onChange={(e) => setAffiliateUrl(e.target.value)}
                placeholder="https://example.com/product?ref=YOUR_ID"
                required
                aria-label="Affiliate URL"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Short Code */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-white/70">
                Short Code
              </label>
              <label className="flex items-center gap-2 text-sm text-white/50">
                <input
                  type="checkbox"
                  checked={autoGenerateCode}
                  onChange={(e) => setAutoGenerateCode(e.target.checked)}
                  className="rounded border-white/20"
                />
                Auto-generate
              </label>
            </div>
            {!autoGenerateCode && (
              <div className="flex items-center gap-2">
                <span className="text-white/40">/go/</span>
                <input
                  type="text"
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  placeholder="custom-code"
                  aria-label="Short code"
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Product Name
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Widget Pro 2024"
                aria-label="Product name"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Electronics"
                aria-label="Category"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Product Image URL
            </label>
            <input
              type="url"
              value={productImage}
              onChange={(e) => setProductImage(e.target.value)}
              placeholder="https://example.com/image.jpg"
              aria-label="Product image URL"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-1 bg-white/10 text-white/70 text-sm rounded-lg"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag..."
                aria-label="Add tag"
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Auto-Insert Section */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                <span className="font-medium text-white">Auto-Insert</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoInsert(!autoInsert)}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors',
                  autoInsert ? 'bg-amber-500' : 'bg-white/20'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                    autoInsert && 'translate-x-5'
                  )}
                />
              </button>
            </div>
            <p className="text-sm text-white/50 mb-3">
              Automatically insert this affiliate link when keywords appear in your content.
            </p>
            {autoInsert && (
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Trigger Keywords
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-sm rounded-lg"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        className="hover:text-amber-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                    placeholder="Add keyword..."
                    aria-label="Add keyword"
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyword}
                    className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-white/70">Active</span>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                isActive ? 'bg-cyan-600' : 'bg-white/20'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                  isActive && 'translate-x-5'
                )}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name || !originalUrl || !affiliateUrl}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600/50 text-white rounded-lg font-medium transition-colors"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LinkForm;
