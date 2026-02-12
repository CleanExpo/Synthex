'use client';

/**
 * Training Upload Component
 * Upload area for persona training data
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, Link } from 'lucide-react';
import { contentTypes } from './personas-config';
import type { Persona } from './types';

interface TrainingUploadProps {
  persona: Persona;
  uploadProgress: number;
  onUpload: (files: FileList) => void;
  onFetchUrl: (url: string) => void;
}

export function TrainingUpload({ persona, uploadProgress, onUpload, onFetchUrl }: TrainingUploadProps) {
  const [selectedContentType, setSelectedContentType] = useState('text');
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleFetchClick = () => {
    onFetchUrl(urlInput);
    setUrlInput('');
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Add Training Data</CardTitle>
        <CardDescription className="text-slate-400">
          Upload content to improve persona accuracy
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Content Type Selection */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {contentTypes.map((type) => (
            <button
              key={type.type}
              onClick={() => setSelectedContentType(type.type)}
              className={`p-3 rounded-lg border transition-all ${
                selectedContentType === type.type
                  ? 'bg-cyan-500/20 border-cyan-500'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <type.icon className="h-5 w-5 mx-auto mb-1" />
              <p className="text-xs">{type.label}</p>
            </button>
          ))}
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            dragActive
              ? 'border-cyan-500 bg-cyan-500/10'
              : 'border-white/20 bg-white/5'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-slate-400" />
          <p className="text-white mb-2">
            Drag and drop files here, or click to browse
          </p>
          <p className="text-xs text-slate-400 mb-4">
            Supports: PDF, TXT, DOC, MP3, MP4, PNG, JPG
          </p>
          <input
            type="file"
            multiple
            className="hidden"
            id="file-upload"
            onChange={(e) => e.target.files && onUpload(e.target.files)}
          />
          <label htmlFor="file-upload">
            <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 cursor-pointer" asChild>
              <span>Choose Files</span>
            </Button>
          </label>
        </div>

        {/* URL Input */}
        {selectedContentType === 'url' && (
          <div className="mt-4">
            <Label htmlFor="url" className="text-slate-400">Content URL</Label>
            <div className="flex space-x-2 mt-2">
              <Input
                id="url"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/content"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              />
              <Button onClick={handleFetchClick} className="gradient-primary text-white">
                <Link className="mr-2 h-4 w-4" />
                Fetch
              </Button>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Uploading...</span>
              <span className="text-white">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Training Stats */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg">
          <h4 className="text-sm font-medium text-white mb-3">Training Statistics</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">
                {persona.trainingData.sources}
              </p>
              <p className="text-xs text-slate-400">Sources</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {(persona.trainingData.words / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-slate-400">Words</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {persona.trainingData.samples}
              </p>
              <p className="text-xs text-slate-400">Samples</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
