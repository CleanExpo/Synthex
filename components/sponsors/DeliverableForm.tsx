'use client';

/**
 * Deliverable Form
 *
 * @description Modal form for adding/editing deliverables.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Loader2 } from '@/components/icons';
import type { DealDeliverable, DeliverableType, DeliverableStatus, CreateDeliverableInput, UpdateDeliverableInput } from '@/hooks/useSponsorCRM';
import { DELIVERABLE_TYPES, DELIVERABLE_STATUSES, TYPE_LABELS, DELIVERABLE_STATUS_LABELS } from '@/hooks/useSponsorCRM';

interface DeliverableFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDeliverableInput | UpdateDeliverableInput) => Promise<void>;
  deliverable?: DealDeliverable | null;
  isLoading?: boolean;
}

const PLATFORMS = ['YouTube', 'Instagram', 'TikTok', 'Twitter', 'Facebook', 'LinkedIn', 'Pinterest', 'Reddit', 'Threads', 'Other'];

function formatDateForInput(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function DeliverableForm({
  isOpen,
  onClose,
  onSubmit,
  deliverable,
  isLoading,
}: DeliverableFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'post' as DeliverableType,
    platform: '',
    status: 'pending' as DeliverableStatus,
    dueDate: '',
    contentUrl: '',
  });

  const isEditing = !!deliverable;

  // Reset form when deliverable changes
  useEffect(() => {
    if (deliverable) {
      setFormData({
        title: deliverable.title,
        description: deliverable.description || '',
        type: deliverable.type,
        platform: deliverable.platform || '',
        status: deliverable.status,
        dueDate: formatDateForInput(deliverable.dueDate),
        contentUrl: deliverable.contentUrl || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        type: 'post',
        platform: '',
        status: 'pending',
        dueDate: '',
        contentUrl: '',
      });
    }
  }, [deliverable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    await onSubmit({
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      type: formData.type,
      platform: formData.platform || undefined,
      status: formData.status,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      contentUrl: formData.contentUrl.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">
            {isEditing ? 'Edit Deliverable' : 'Add Deliverable'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Deliverable title"
              required
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Requirements or notes..."
              rows={2}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent resize-none"
            />
          </div>

          {/* Type & Platform */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Type <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as DeliverableType })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
              >
                {DELIVERABLE_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-[#0f172a]">
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Platform
              </label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
              >
                <option value="" className="bg-[#0f172a]">Select platform</option>
                {PLATFORMS.map((platform) => (
                  <option key={platform} value={platform} className="bg-[#0f172a]">
                    {platform}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as DeliverableStatus })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
              >
                {DELIVERABLE_STATUSES.map((status) => (
                  <option key={status} value={status} className="bg-[#0f172a]">
                    {DELIVERABLE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
              />
            </div>
          </div>

          {/* Content URL */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Content URL
            </label>
            <input
              type="url"
              value={formData.contentUrl}
              onChange={(e) => setFormData({ ...formData, contentUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.title.trim()}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors',
                'bg-cyan-600 hover:bg-cyan-500 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Update Deliverable' : 'Add Deliverable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DeliverableForm;
