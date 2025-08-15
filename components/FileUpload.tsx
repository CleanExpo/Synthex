'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  X, 
  File, 
  Image, 
  Video, 
  Music, 
  FileText,
  Archive,
  Code,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';
import { fadeInUp, popIn } from '@/lib/animations';

interface FileWithPreview extends File {
  preview?: string;
  progress?: number;
  status?: 'uploading' | 'success' | 'error';
  error?: string;
}

interface FileUploadProps {
  onUpload?: (files: File[]) => Promise<void>;
  accept?: Record<string, string[]>;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
  showPreview?: boolean;
}

export function FileUpload({
  onUpload,
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    'video/*': ['.mp4', '.webm', '.mov'],
    'application/pdf': ['.pdf'],
  },
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 10,
  multiple = true,
  className = '',
  disabled = false,
  showPreview = true
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    rejectedFiles.forEach(rejection => {
      const { file, errors } = rejection;
      const errorMessages = errors.map((e: any) => {
        if (e.code === 'file-too-large') {
          return `File is too large (max ${formatBytes(maxSize)})`;
        }
        if (e.code === 'file-invalid-type') {
          return 'File type not accepted';
        }
        return e.message;
      }).join(', ');
      
      toast.error(`${file.name}: ${errorMessages}`);
    });
    
    // Process accepted files
    const newFiles: FileWithPreview[] = acceptedFiles.map(file => 
      Object.assign(file, {
        preview: file.type.startsWith('image/') 
          ? URL.createObjectURL(file) 
          : undefined,
        progress: 0,
        status: 'uploading' as const
      })
    );
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // Upload files
    if (onUpload && newFiles.length > 0) {
      setUploading(true);
      
      try {
        // Simulate upload progress
        const uploadPromises = newFiles.map(async (file, index) => {
          // Simulate progress updates
          for (let progress = 0; progress <= 100; progress += 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            setFiles(prev => prev.map((f, i) => 
              i === files.length + index 
                ? { ...f, progress } 
                : f
            ));
          }
          
          // Mark as success
          setFiles(prev => prev.map((f, i) => 
            i === files.length + index 
              ? { ...f, status: 'success' as const } 
              : f
          ));
        });
        
        await Promise.all(uploadPromises);
        await onUpload(newFiles);
        
        toast.success(`${newFiles.length} file(s) uploaded successfully`);
      } catch (error) {
        console.error('Upload error:', error);
        
        // Mark files as error
        setFiles(prev => prev.map(f => 
          newFiles.includes(f) 
            ? { ...f, status: 'error' as const, error: 'Upload failed', preview: f.preview || undefined }
            : f
        ));
        
        toast.error('Failed to upload files');
      } finally {
        setUploading(false);
      }
    }
  }, [files.length, maxSize, onUpload]);
  
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles: multiple ? maxFiles : 1,
    multiple,
    disabled: disabled || uploading
  });
  
  const removeFile = (index: number) => {
    const file = files[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const clearAll = () => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
  };
  
  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return <Image alt="Upload preview" className="h-4 w-4" />;
    if (type.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (type.startsWith('audio/')) return <Music className="h-4 w-4" />;
    if (type.includes('pdf')) return <FileText className="h-4 w-4" />;
    if (type.includes('zip') || type.includes('rar')) return <Archive className="h-4 w-4" />;
    if (type.includes('javascript') || type.includes('typescript')) return <Code className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  return (
    <div className={className}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative overflow-hidden rounded-lg border-2 border-dashed transition-all cursor-pointer',
          'hover:border-purple-400 hover:bg-purple-500/5',
          isDragActive && 'border-purple-400 bg-purple-500/10',
          isDragReject && 'border-red-400 bg-red-500/10',
          disabled && 'opacity-50 cursor-not-allowed',
          'border-white/20 bg-white/5'
        )}
      >
        <input {...getInputProps()} />
        
        <div className="p-8 text-center">
          <motion.div
            animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
            transition={{ duration: 0.2 }}
            className="mx-auto w-12 h-12 mb-4"
          >
            <Upload className={cn(
              'w-full h-full',
              isDragActive ? 'text-purple-400' : 'text-gray-400'
            )} />
          </motion.div>
          
          <p className="text-white font-medium mb-2">
            {isDragActive
              ? 'Drop files here'
              : 'Drag & drop files here, or click to select'
            }
          </p>
          
          <p className="text-sm text-gray-400">
            {multiple 
              ? `Upload up to ${maxFiles} files (max ${formatBytes(maxSize)} each)`
              : `Upload a file (max ${formatBytes(maxSize)})`
            }
          </p>
          
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {Object.keys(accept).map(type => (
              <span key={type} className="px-2 py-1 bg-white/10 rounded text-xs text-gray-400">
                {type.replace('/*', '')}
              </span>
            ))}
          </div>
        </div>
        
        {/* Upload animation overlay */}
        <AnimatePresence>
          {isDragActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-purple-500/20 pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>
      
      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-white">
              Uploaded Files ({files.length})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={uploading}
            >
              Clear All
            </Button>
          </div>
          
          <AnimatePresence>
            {files.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="glass-card p-3 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {/* Preview */}
                  {showPreview && file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center">
                      {getFileIcon(file)}
                    </div>
                  )}
                  
                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatBytes(file.size)}
                    </p>
                    
                    {/* Progress bar */}
                    {file.status === 'uploading' && (
                      <Progress 
                        value={file.progress || 0} 
                        className="mt-1 h-1"
                      />
                    )}
                  </div>
                  
                  {/* Status icon */}
                  <div className="flex items-center gap-2">
                    {file.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                    )}
                    {file.status === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-400" />
                    )}
                    
                    <button
                      onClick={() => removeFile(index)}
                      disabled={file.status === 'uploading'}
                      className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>
                
                {/* Error message */}
                {file.error && (
                  <p className="text-xs text-red-400 mt-2">{file.error}</p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// Simple file input button
export function FileInputButton({
  onSelect,
  accept,
  multiple = false,
  children,
  className = '',
  variant = 'default'
}: {
  onSelect: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
}) {
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept || '*';
        input.multiple = multiple;
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files && files.length > 0) {
            onSelect(files);
          }
        };
        input.click();
      }}
    >
      {children}
    </Button>
  );
}