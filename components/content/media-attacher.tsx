'use client';

/**
 * MediaAttacher Component
 *
 * Drag-and-drop media attachment with upload progress, preview grid,
 * and remove functionality. Uploads files to POST /api/media/upload.
 */

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Image, Upload, X, Loader2 } from '@/components/icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaAttacherProps {
  /** Currently attached media URLs */
  mediaUrls: string[];
  /** Called when the URL list changes (add / remove) */
  onMediaChange: (urls: string[]) => void;
  /** Maximum number of files allowed (default 4) */
  maxFiles?: number;
  /** Disable interaction */
  disabled?: boolean;
}

interface UploadingFile {
  id: string;
  name: string;
  preview: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4';

function generateId() {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaAttacher({
  mediaUrls,
  onMediaChange,
  maxFiles = 4,
  disabled = false,
}: MediaAttacherProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const totalSlots = mediaUrls.length + uploadingFiles.length;
  const canAddMore = totalSlots < maxFiles;

  // -- Upload a single file -----------------------------------------------
  const uploadFile = useCallback(
    async (file: File) => {
      const id = generateId();

      // Create a local preview for images
      const preview = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : '';

      setUploadingFiles((prev) => [...prev, { id, name: file.name, preview }]);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/media/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error || `Upload failed (${res.status})`
          );
        }

        const { data } = (await res.json()) as {
          data: { url: string };
        };

        // Add the new URL
        onMediaChange([...mediaUrls, data.url]);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Upload failed'
        );
      } finally {
        // Revoke object URL to avoid memory leaks
        if (preview) URL.revokeObjectURL(preview);
        setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
      }
    },
    [mediaUrls, onMediaChange]
  );

  // -- Handle selected / dropped files ------------------------------------
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const remaining = maxFiles - totalSlots;
      if (remaining <= 0) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const filesToUpload = Array.from(files).slice(0, remaining);

      for (const file of filesToUpload) {
        void uploadFile(file);
      }
    },
    [maxFiles, totalSlots, uploadFile]
  );

  // -- Click handler (opens file picker) ----------------------------------
  const handleClick = () => {
    if (disabled || !canAddMore) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset the input so the same file can be re-selected
      e.target.value = '';
    }
  };

  // -- Drag events --------------------------------------------------------
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && canAddMore) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || !canAddMore) return;
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // -- Remove an attached media URL ---------------------------------------
  const handleRemove = (index: number) => {
    const updated = mediaUrls.filter((_, i) => i !== index);
    onMediaChange(updated);
  };

  // -- Render -------------------------------------------------------------
  return (
    <div className="space-y-3">
      {/* File count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <Image className="h-3.5 w-3.5" />
          Media
        </span>
        <span className="text-xs text-slate-500">
          {mediaUrls.length}/{maxFiles} files attached
        </span>
      </div>

      {/* Preview grid */}
      {(mediaUrls.length > 0 || uploadingFiles.length > 0) && (
        <div className="grid grid-cols-4 gap-2">
          {/* Uploaded files */}
          {mediaUrls.map((url, index) => (
            <div
              key={url}
              className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Attachment ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                aria-label={`Remove attachment ${index + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Uploading placeholders */}
          {uploadingFiles.map((f) => (
            <div
              key={f.id}
              className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center"
            >
              {f.preview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.preview}
                    alt="Uploading"
                    className="h-full w-full object-cover opacity-40"
                  />
                  <Loader2 className="absolute h-5 w-5 text-cyan-400 animate-spin" />
                </>
              ) : (
                <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {canAddMore && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleClick();
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed
            py-5 cursor-pointer transition-all
            ${
              isDragOver
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <Upload className="h-5 w-5 text-slate-400" />
          <span className="text-xs text-slate-400">
            Drop files here or click to browse
          </span>
          <span className="text-[10px] text-slate-500">
            JPG, PNG, GIF, WebP, MP4 &middot; Max 10 MB images / 100 MB video
          </span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
    </div>
  );
}
