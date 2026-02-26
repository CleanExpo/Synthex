'use client';

import { useState, useMemo, useCallback } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { toast } from 'sonner';

import {
  type Persona,
  type NewPersonaForm,
  defaultNewPersona,
  PersonasHeader,
  PersonaStatsGrid,
  PersonaList,
  PersonaDetails,
  TrainingUpload,
  CreatePersonaDialog,
  PersonaEmptyState,
} from '@/components/personas';
import { usePersonas, type Persona as APIPersona, type TrainingSource } from '@/hooks/use-personas';

// Transform API persona to component Persona type
function transformPersona(p: APIPersona): Persona {
  return {
    id: parseInt(p.id, 10) || Date.now(),
    name: p.name || '',
    description: p.description || '',
    trainingData: {
      sources: p.trainingSourcesCount || 0,
      words: p.trainingWordsCount || 0,
      samples: p.trainingSamplesCount || 0,
    },
    attributes: {
      tone: (p.tone || 'Professional').charAt(0).toUpperCase() + (p.tone || 'professional').slice(1),
      style: (p.style || 'Formal').charAt(0).toUpperCase() + (p.style || 'formal').slice(1),
      vocabulary: (p.vocabulary || 'Standard').charAt(0).toUpperCase() + (p.vocabulary || 'standard').slice(1),
      emotion: (p.emotion || 'Neutral').charAt(0).toUpperCase() + (p.emotion || 'neutral').slice(1),
    },
    accuracy: p.accuracy || 0,
    status: (p.status as Persona['status']) || 'draft',
    lastTrained: p.lastTrained ? new Date(p.lastTrained).toLocaleDateString() : 'Never',
  };
}

// Find API persona ID from component persona ID
function findApiId(apiPersonas: APIPersona[], componentId: number): string | null {
  const found = apiPersonas.find((p) => parseInt(p.id, 10) === componentId || p.id === String(componentId));
  return found?.id || null;
}

export default function PersonasPage() {
  const {
    personas: apiPersonas,
    loading: isLoading,
    error,
    refresh,
    createPersona,
    deletePersona,
    startTraining,
    clearError,
  } = usePersonas();

  // Transform API personas to component format
  const personas = useMemo(() => apiPersonas.map(transformPersona), [apiPersonas]);

  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPersona, setNewPersona] = useState<NewPersonaForm>(defaultNewPersona);
  const [trainingContent, setTrainingContent] = useState<string[]>([]);

  // Calculate stats from personas
  const stats = useMemo(() => {
    const totalWords = apiPersonas.reduce((sum, p) => sum + (p.trainingWordsCount || 0), 0);
    const totalSources = apiPersonas.reduce((sum, p) => sum + (p.trainingSourcesCount || 0), 0);
    const activePersonas = apiPersonas.filter((p) => p.status === 'active');
    const avgAccuracy = activePersonas.length > 0
      ? activePersonas.reduce((sum, p) => sum + (p.accuracy || 0), 0) / activePersonas.length
      : 0;

    return {
      activeCount: activePersonas.length,
      totalWords: totalWords >= 1000 ? `${(totalWords / 1000).toFixed(0)}K` : String(totalWords),
      avgAccuracy: `${avgAccuracy.toFixed(1)}%`,
      totalSources,
    };
  }, [apiPersonas]);

  const handleRetry = useCallback(async () => {
    clearError();
    await refresh();
  }, [clearError, refresh]);

  const handleFiles = useCallback(async (files: FileList) => {
    setUploadProgress(0);
    const newContent: string[] = [];

    // Read file contents
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        if (text.length >= 50) {
          newContent.push(text);
        }
      } catch {
        // Skip files that can't be read as text
      }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setTrainingContent((prev) => [...prev, ...newContent]);
    toast.success(`Added ${newContent.length} file(s) for training`);
  }, []);

  const handleFetchUrl = useCallback((url: string) => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }
    // Store URL as content (training API can handle URL fetching)
    setTrainingContent((prev) => [...prev, `[URL] ${url.trim()}`]);
    setUploadProgress(100);
    toast.success('URL added for training');
  }, []);

  const handleTrainPersona = useCallback(async () => {
    if (!selectedPersona) {
      toast.error('No persona selected');
      return;
    }

    if (trainingContent.length === 0) {
      toast.error('Please upload training content first');
      return;
    }

    const apiId = findApiId(apiPersonas, selectedPersona.id);
    if (!apiId) {
      toast.error('Persona not found');
      return;
    }

    setIsTraining(true);

    // Convert content to training sources
    const sources: TrainingSource[] = trainingContent.map((content) => ({
      type: content.startsWith('[URL]') ? 'website' as const : 'text' as const,
      content: content.startsWith('[URL]') ? content.replace('[URL] ', '') : content,
    }));

    const success = await startTraining(apiId, sources);

    setIsTraining(false);

    if (success) {
      toast.success('Training started! The persona will be active once training completes.');
      setTrainingContent([]);
      setUploadProgress(0);
    } else {
      toast.error('Failed to start training');
    }
  }, [selectedPersona, trainingContent, apiPersonas, startTraining]);

  const handleCreatePersona = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleSubmitNewPersona = useCallback(async () => {
    if (!newPersona.name.trim()) {
      toast.error('Please enter a persona name');
      return;
    }

    setIsCreating(true);

    const result = await createPersona({
      name: newPersona.name,
      description: newPersona.description || `Custom ${newPersona.tone} persona`,
      tone: newPersona.tone as 'professional' | 'casual' | 'authoritative' | 'friendly' | 'humorous',
      style: newPersona.style as 'formal' | 'conversational' | 'thought-provoking' | 'educational' | 'inspirational',
      vocabulary: newPersona.vocabulary as 'simple' | 'standard' | 'technical' | 'sophisticated',
      emotion: newPersona.emotion as 'neutral' | 'friendly' | 'confident' | 'inspiring' | 'empathetic',
    });

    setIsCreating(false);

    if (result) {
      setCreateDialogOpen(false);
      setNewPersona(defaultNewPersona);
      // Select the newly created persona
      setSelectedPersona(transformPersona(result));
      toast.success(`Persona "${newPersona.name}" created successfully!`);
    } else {
      toast.error('Failed to create persona');
    }
  }, [newPersona, createPersona]);

  const handleDeletePersona = useCallback(async (id: number) => {
    const apiId = findApiId(apiPersonas, id);
    if (!apiId) {
      toast.error('Persona not found');
      return;
    }

    const success = await deletePersona(apiId);

    if (success) {
      if (selectedPersona?.id === id) {
        setSelectedPersona(null);
      }
      toast.success('Persona deleted successfully');
    } else {
      toast.error('Failed to delete persona');
    }
  }, [apiPersonas, deletePersona, selectedPersona]);

  const handleEditPersona = useCallback(() => {
    if (selectedPersona) {
      toast.success(`Editing persona: ${selectedPersona.name}`);
    }
  }, [selectedPersona]);

  const handleClonePersona = useCallback(async () => {
    if (!selectedPersona) return;

    const apiId = findApiId(apiPersonas, selectedPersona.id);
    const original = apiPersonas.find((p) => p.id === apiId);

    if (!original) {
      toast.error('Persona not found');
      return;
    }

    const result = await createPersona({
      name: `${original.name} (Copy)`,
      description: original.description || undefined,
      tone: original.tone as 'professional' | 'casual' | 'authoritative' | 'friendly' | 'humorous',
      style: original.style as 'formal' | 'conversational' | 'thought-provoking' | 'educational' | 'inspirational',
      vocabulary: original.vocabulary as 'simple' | 'standard' | 'technical' | 'sophisticated',
      emotion: original.emotion as 'neutral' | 'friendly' | 'confident' | 'inspiring' | 'empathetic',
    });

    if (result) {
      toast.success(`Cloned persona: ${selectedPersona.name}`);
    } else {
      toast.error('Failed to clone persona');
    }
  }, [selectedPersona, apiPersonas, createPersona]);

  const handleConfigurePersona = useCallback(() => {
    if (selectedPersona) {
      toast.success(`Opening configuration for: ${selectedPersona.name}`);
    }
  }, [selectedPersona]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <APIErrorCard title="Personas Error" message={error} onRetry={handleRetry} />;
  }

  return (
    <div className="space-y-6">
      <PersonasHeader
        personas={personas}
        isCreating={isCreating}
        onCreateClick={handleCreatePersona}
      />

      <PersonaStatsGrid stats={stats} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PersonaList
            personas={personas}
            selectedId={selectedPersona?.id ?? null}
            onSelect={setSelectedPersona}
          />
        </div>

        <div className="lg:col-span-2">
          {selectedPersona ? (
            <>
              <div className="mb-6">
                <PersonaDetails
                  persona={selectedPersona}
                  isTraining={isTraining}
                  onTrain={handleTrainPersona}
                  onEdit={handleEditPersona}
                  onDelete={() => handleDeletePersona(selectedPersona.id)}
                  onClone={handleClonePersona}
                  onConfigure={handleConfigurePersona}
                />
              </div>
              <TrainingUpload
                persona={selectedPersona}
                uploadProgress={uploadProgress}
                onUpload={handleFiles}
                onFetchUrl={handleFetchUrl}
              />
            </>
          ) : (
            <PersonaEmptyState onCreateClick={handleCreatePersona} />
          )}
        </div>
      </div>

      <CreatePersonaDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        formData={newPersona}
        onFormChange={setNewPersona}
        onSubmit={handleSubmitNewPersona}
        isCreating={isCreating}
      />
    </div>
  );
}
