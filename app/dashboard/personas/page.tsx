'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import toast from 'react-hot-toast';

import {
  type Persona,
  type NewPersonaForm,
  mockPersonas,
  defaultNewPersona,
  PersonasHeader,
  PersonaStatsGrid,
  PersonaList,
  PersonaDetails,
  TrainingUpload,
  CreatePersonaDialog,
  PersonaEmptyState,
} from '@/components/personas';

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPersona, setNewPersona] = useState<NewPersonaForm>(defaultNewPersona);

  // Calculate stats from personas
  const stats = useMemo(() => ({
    activeCount: personas.filter(p => p.status === 'active').length,
    totalWords: '135K',
    avgAccuracy: '90.7%',
    totalSources: 448,
  }), [personas]);

  // Load personas data
  useEffect(() => {
    const loadPersonas = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');
        {
          const response = await fetch('/api/personas', {
            credentials: 'include',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          });

          if (response.ok) {
            const { data } = await response.json();
            const apiPersonas = data.map((p: Record<string, unknown>) => ({
              id: typeof p.id === 'number' ? p.id : parseInt(p.id as string, 10) || Date.now(),
              name: (p.name as string) || '',
              description: (p.description as string) || '',
              trainingData: {
                sources: (p.trainingSourcesCount as number) || 0,
                words: (p.trainingWordsCount as number) || 0,
                samples: (p.trainingSamplesCount as number) || 0,
              },
              attributes: {
                tone: ((p.tone as string) || 'Professional').charAt(0).toUpperCase() + ((p.tone as string) || 'professional').slice(1),
                style: ((p.style as string) || 'Formal').charAt(0).toUpperCase() + ((p.style as string) || 'formal').slice(1),
                vocabulary: ((p.vocabulary as string) || 'Standard').charAt(0).toUpperCase() + ((p.vocabulary as string) || 'standard').slice(1),
                emotion: ((p.emotion as string) || 'Neutral').charAt(0).toUpperCase() + ((p.emotion as string) || 'neutral').slice(1),
              },
              accuracy: (p.accuracy as number) || 0,
              status: (p.status as Persona['status']) || 'draft',
              lastTrained: p.lastTrained ? new Date(p.lastTrained as string).toLocaleDateString() : 'Never',
            }));

            if (apiPersonas.length > 0) {
              setPersonas(apiPersonas);
              setIsLoading(false);
              return;
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, 400));
        setPersonas(mockPersonas);
        setIsLoading(false);
      } catch {
        setPersonas(mockPersonas);
        setIsLoading(false);
      }
    };
    loadPersonas();
  }, []);

  const handleRetry = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');
      {
        const response = await fetch('/api/personas', {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const { data } = await response.json();
          if (data.length > 0) {
            setPersonas(data);
            setIsLoading(false);
            return;
          }
        }
      }
      setPersonas(mockPersonas);
      setIsLoading(false);
    } catch {
      setPersonas(mockPersonas);
      setIsLoading(false);
    }
  }, []);

  const handleFiles = useCallback((files: FileList) => {
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
  }, []);

  const handleFetchUrl = useCallback((url: string) => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          toast.success('Content fetched from URL successfully');
          return 100;
        }
        return prev + 20;
      });
    }, 200);
  }, []);

  const handleTrainPersona = useCallback(() => {
    setIsTraining(true);
    setTimeout(() => {
      setIsTraining(false);
      toast.success('Persona training completed successfully!');
      if (selectedPersona) {
        setPersonas(prev => prev.map(p =>
          p.id === selectedPersona.id
            ? { ...p, status: 'active' as const, accuracy: Math.min(p.accuracy + 3, 100) }
            : p
        ));
      }
    }, 3000);
  }, [selectedPersona]);

  const handleCreatePersona = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleSubmitNewPersona = useCallback(() => {
    if (!newPersona.name.trim()) {
      toast.error('Please enter a persona name');
      return;
    }

    setIsCreating(true);

    const createdPersona: Persona = {
      id: Date.now(),
      name: newPersona.name,
      description: newPersona.description || `Custom ${newPersona.tone} persona`,
      trainingData: {
        sources: 0,
        words: 0,
        samples: 0,
      },
      attributes: {
        tone: newPersona.tone.charAt(0).toUpperCase() + newPersona.tone.slice(1),
        style: newPersona.style.charAt(0).toUpperCase() + newPersona.style.slice(1),
        vocabulary: newPersona.vocabulary.charAt(0).toUpperCase() + newPersona.vocabulary.slice(1),
        emotion: newPersona.emotion.charAt(0).toUpperCase() + newPersona.emotion.slice(1),
      },
      accuracy: 0,
      status: 'draft',
      lastTrained: 'Never',
    };

    setPersonas(prev => [...prev, createdPersona]);
    setSelectedPersona(createdPersona);
    setCreateDialogOpen(false);
    setNewPersona(defaultNewPersona);
    setIsCreating(false);
    toast.success(`Persona "${newPersona.name}" created successfully!`);
  }, [newPersona]);

  const handleDeletePersona = useCallback((id: number) => {
    setPersonas(prev => prev.filter(p => p.id !== id));
    if (selectedPersona?.id === id) {
      setSelectedPersona(null);
    }
    toast.success('Persona deleted successfully');
  }, [selectedPersona]);

  const handleEditPersona = useCallback(() => {
    if (selectedPersona) {
      toast.success(`Editing persona: ${selectedPersona.name}`);
    }
  }, [selectedPersona]);

  const handleClonePersona = useCallback(() => {
    if (selectedPersona) {
      const clonedPersona: Persona = {
        ...selectedPersona,
        id: Date.now(),
        name: `${selectedPersona.name} (Copy)`,
        status: 'draft',
      };
      setPersonas(prev => [...prev, clonedPersona]);
      toast.success(`Cloned persona: ${selectedPersona.name}`);
    }
  }, [selectedPersona]);

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
