'use client';

import { CornerRightUp, FileUp, Paperclip, X } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

// ── Inline hooks (no external hook deps needed) ─────────────────────────────

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = `${minHeight}px`;
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

interface UseFileInputOptions {
  accept?: string;
  maxSize?: number;
}

function useFileInput({ accept, maxSize }: UseFileInputOptions) {
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (file: File | undefined) => {
    setError('');
    if (file) {
      if (maxSize && file.size > maxSize * 1024 * 1024) {
        setError(`File size must be less than ${maxSize}MB`);
        return;
      }
      if (accept && !file.type.match(accept.replace('/*', '/'))) {
        setError(`File type must be ${accept}`);
        return;
      }
      setFileSize(file.size);
      setFileName(file.name);
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetFile(e.target.files?.[0]);
  };

  const clearFile = () => {
    setFileName('');
    setError('');
    setFileSize(0);
    setSelectedFile(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return {
    fileName,
    error,
    fileInputRef,
    handleFileSelect,
    validateAndSetFile,
    clearFile,
    fileSize,
    selectedFile,
  };
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface FileDisplayProps {
  fileName: string;
  onClear: () => void;
}

function FileDisplay({ fileName, onClear }: FileDisplayProps) {
  return (
    <div className="flex items-center gap-2 bg-white/[0.04] w-fit px-3 py-1 rounded-sm border-[0.5px] border-white/[0.06] group">
      <FileUp className="w-4 h-4 text-orange-400" />
      <span className="text-sm text-white/60">{fileName}</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-1 p-0.5 rounded-full hover:bg-white/10 transition-colors"
      >
        <X className="w-3 h-3 text-white/60" />
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface AIFileInputProps {
  id?: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  accept?: string;
  maxFileSize?: number;
  onSubmit?: (message: string, file?: File) => void;
  className?: string;
}

export function AIFileInput({
  id = 'ai-file-input',
  placeholder = 'Ask anything or attach a file…',
  minHeight = 52,
  maxHeight = 200,
  accept = 'image/*',
  maxFileSize = 5,
  onSubmit,
  className,
}: AIFileInputProps) {
  const [inputValue, setInputValue] = useState<string>('');
  const { fileName, fileInputRef, handleFileSelect, clearFile, selectedFile } =
    useFileInput({
      accept,
      maxSize: maxFileSize,
    });
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  });

  const handleSubmit = () => {
    if (inputValue.trim() || selectedFile) {
      onSubmit?.(inputValue, selectedFile);
      setInputValue('');
      adjustHeight(true);
    }
  };

  return (
    <div className={cn('w-full py-2 sm:py-4 px-2 sm:px-0', className)}>
      <div className="relative max-w-xl w-full mx-auto flex flex-col gap-2">
        {fileName && <FileDisplay fileName={fileName} onClear={clearFile} />}

        <div className="relative">
          {/* Attach button */}
          <div
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 sm:h-8 w-7 sm:w-8 rounded-sm bg-white/[0.04] hover:bg-orange-500/[0.08] hover:cursor-pointer transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-3.5 sm:w-4 h-3.5 sm:h-4 transition-opacity transform scale-x-[-1] rotate-45 text-white/60" />
          </div>

          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept={accept}
          />

          <textarea
            id={id}
            ref={textareaRef}
            placeholder={placeholder}
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className={cn(
              'max-w-xl w-full rounded-sm pl-10 sm:pl-12 pr-12 sm:pr-16 py-3 sm:py-4',
              'bg-[#0a0a0a] border-[0.5px] border-white/[0.06]',
              'text-white text-sm sm:text-base placeholder:text-white/40',
              'resize-none leading-[1.2] overflow-y-auto',
              'focus:outline-none focus:border-orange-500/20 focus:ring-1 focus:ring-orange-500/20',
              'transition-colors'
            )}
            style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
          />

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            type="button"
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 rounded-sm bg-white/[0.04] hover:bg-orange-500/[0.08] py-1 px-1 transition-colors"
          >
            <CornerRightUp
              className={cn(
                'w-3.5 sm:w-4 h-3.5 sm:h-4 transition-opacity',
                inputValue || selectedFile
                  ? 'opacity-100 text-orange-400'
                  : 'opacity-30 text-white/40'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
