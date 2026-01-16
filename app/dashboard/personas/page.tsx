'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Brain,
  Upload,
  Plus,
  Edit,
  Trash2,
  Download,
  Mic,
  FileText,
  Image,
  Video,
  Link,
  Sparkles,
  User,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Settings,
} from '@/components/icons';
import toast from 'react-hot-toast';

// Mock personas data
const mockPersonas = [
  {
    id: 1,
    name: 'Professional Voice',
    description: 'Formal, authoritative tone for B2B content',
    trainingData: {
      sources: 12,
      words: 45000,
      samples: 156,
    },
    attributes: {
      tone: 'Professional',
      style: 'Formal',
      vocabulary: 'Technical',
      emotion: 'Confident',
    },
    accuracy: 94,
    status: 'active',
    lastTrained: '2024-01-10',
  },
  {
    id: 2,
    name: 'Casual Creator',
    description: 'Friendly, conversational style for social media',
    trainingData: {
      sources: 8,
      words: 28000,
      samples: 89,
    },
    attributes: {
      tone: 'Casual',
      style: 'Conversational',
      vocabulary: 'Simple',
      emotion: 'Friendly',
    },
    accuracy: 87,
    status: 'active',
    lastTrained: '2024-01-12',
  },
  {
    id: 3,
    name: 'Thought Leader',
    description: 'Insightful, provocative content for LinkedIn',
    trainingData: {
      sources: 15,
      words: 62000,
      samples: 203,
    },
    attributes: {
      tone: 'Authoritative',
      style: 'Thought-provoking',
      vocabulary: 'Sophisticated',
      emotion: 'Inspiring',
    },
    accuracy: 91,
    status: 'training',
    lastTrained: '2024-01-15',
  },
];

const contentTypes = [
  { icon: FileText, label: 'Text Document', type: 'text' },
  { icon: Mic, label: 'Audio/Podcast', type: 'audio' },
  { icon: Video, label: 'Video Content', type: 'video' },
  { icon: Image, label: 'Images', type: 'image' },
  { icon: Link, label: 'URL/Website', type: 'url' },
];

export default function PersonasPage() {
  const [personas, setPersonas] = useState(mockPersonas);
  const [selectedPersona, setSelectedPersona] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedContentType, setSelectedContentType] = useState('text');
  const [dragActive, setDragActive] = useState(false);

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
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = (files: FileList) => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          toast.success(`Uploaded ${files.length} file(s) successfully`);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleTrainPersona = () => {
    setIsTraining(true);
    setTimeout(() => {
      setIsTraining(false);
      toast.success('Persona training completed successfully!');
      if (selectedPersona) {
        setPersonas(prev => prev.map(p => 
          p.id === selectedPersona.id 
            ? { ...p, status: 'active', accuracy: Math.min(p.accuracy + 3, 100) }
            : p
        ));
      }
    }, 3000);
  };

  const handleCreatePersona = () => {
    setIsCreating(true);
    // In a real app, this would open a modal or navigate to a create page
    toast.success('Persona creation modal would open here');
    setIsCreating(false);
  };

  const handleDeletePersona = (id: number) => {
    setPersonas(prev => prev.filter(p => p.id !== id));
    toast.success('Persona deleted successfully');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Persona Learning Engine</h1>
          <p className="text-gray-400 mt-1">
            Train AI to match your unique voice and style
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button
            onClick={handleCreatePersona}
            disabled={isCreating}
            className="gradient-primary text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Persona
          </Button>
          <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Active Personas</CardTitle>
            <User className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{personas.filter(p => p.status === 'active').length}</div>
            <p className="text-xs text-gray-500 mt-1">Ready to use</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Training Data</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">135K</div>
            <p className="text-xs text-gray-500 mt-1">Total words analyzed</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Avg Accuracy</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">90.7%</div>
            <p className="text-xs text-gray-500 mt-1">Voice matching score</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Content Sources</CardTitle>
            <FileText className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">448</div>
            <p className="text-xs text-gray-500 mt-1">Documents & media</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Personas List */}
        <div className="lg:col-span-1">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Your Personas</CardTitle>
              <CardDescription className="text-gray-400">
                Select a persona to view or train
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  onClick={() => setSelectedPersona(persona)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedPersona?.id === persona.id
                      ? 'bg-purple-500/20 border-purple-500'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{persona.name}</h3>
                      <p className="text-xs text-gray-400 mt-1">{persona.description}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      {persona.status === 'active' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : persona.status === 'training' ? (
                        <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Accuracy: {persona.accuracy}%</span>
                    <span className="text-gray-500">{persona.trainingData.samples} samples</span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                        style={{ width: `${persona.accuracy}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Training Interface */}
        <div className="lg:col-span-2">
          {selectedPersona ? (
            <>
              {/* Persona Details */}
              <Card className="glass-card mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedPersona.name}</CardTitle>
                      <CardDescription className="text-gray-400">
                        Last trained: {selectedPersona.lastTrained}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="ghost" className="text-gray-400">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-red-400"
                        onClick={() => handleDeletePersona(selectedPersona.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-gray-400">Tone</Label>
                        <p className="text-white">{selectedPersona.attributes.tone}</p>
                      </div>
                      <div>
                        <Label className="text-gray-400">Style</Label>
                        <p className="text-white">{selectedPersona.attributes.style}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-gray-400">Vocabulary</Label>
                        <p className="text-white">{selectedPersona.attributes.vocabulary}</p>
                      </div>
                      <div>
                        <Label className="text-gray-400">Emotion</Label>
                        <p className="text-white">{selectedPersona.attributes.emotion}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <Button 
                      onClick={handleTrainPersona}
                      disabled={isTraining}
                      className="gradient-primary text-white"
                    >
                      {isTraining ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Training...
                        </>
                      ) : (
                        <>
                          <Brain className="mr-2 h-4 w-4" />
                          Train Persona
                        </>
                      )}
                    </Button>
                    <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                      <Copy className="mr-2 h-4 w-4" />
                      Clone
                    </Button>
                    <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Upload Training Data */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Add Training Data</CardTitle>
                  <CardDescription className="text-gray-400">
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
                            ? 'bg-purple-500/20 border-purple-500'
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
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/20 bg-white/5'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-white mb-2">
                      Drag and drop files here, or click to browse
                    </p>
                    <p className="text-xs text-gray-400 mb-4">
                      Supports: PDF, TXT, DOC, MP3, MP4, PNG, JPG
                    </p>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      id="file-upload"
                      onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    />
                    <label htmlFor="file-upload">
                      <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                        Choose Files
                      </Button>
                    </label>
                  </div>

                  {/* URL Input */}
                  {selectedContentType === 'url' && (
                    <div className="mt-4">
                      <Label htmlFor="url" className="text-gray-400">Content URL</Label>
                      <div className="flex space-x-2 mt-2">
                        <Input
                          id="url"
                          type="url"
                          placeholder="https://example.com/content"
                          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                        />
                        <Button className="gradient-primary text-white">
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
                        <span className="text-gray-400">Uploading...</span>
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
                          {selectedPersona.trainingData.sources}
                        </p>
                        <p className="text-xs text-gray-400">Sources</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">
                          {(selectedPersona.trainingData.words / 1000).toFixed(0)}K
                        </p>
                        <p className="text-xs text-gray-400">Words</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">
                          {selectedPersona.trainingData.samples}
                        </p>
                        <p className="text-xs text-gray-400">Samples</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="glass-card">
              <CardContent className="pt-20 pb-20 text-center">
                <Brain className="h-16 w-16 mx-auto mb-4 text-gray-500" />
                <h3 className="text-xl font-semibold text-white mb-2">Select a Persona</h3>
                <p className="text-gray-400 mb-6">
                  Choose a persona from the list to view details and add training data
                </p>
                <Button onClick={handleCreatePersona} className="gradient-primary text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Persona
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}