'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  Plus, 
  TrendingUp, 
  Users, 
  Target,
  Sparkles,
  BarChart,
  Clock,
  Hash,
  Smile,
  AlertCircle,
  ChevronRight,
  Settings,
  Loader2,
  Edit,
  Trash2,
  CheckCircle,
  Activity
} from '@/components/icons';
import {
  personaLearning,
  type PersonaProfile,
  type VoiceCharacteristics,
  type ContentPreferences
} from '@/lib/ai-persona-learning';
import { notify } from '@/lib/notifications';
import { fadeInUp, scaleIn } from '@/lib/animations';

export function AIPersonaManager() {
  const [personas, setPersonas] = useState<PersonaProfile[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<PersonaProfile | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState('');
  const [newPersonaDescription, setNewPersonaDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Load personas from API
  const loadPersonas = useCallback(async () => {
    try {
      const response = await fetch('/api/personas');
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - clear local state
          setPersonas([]);
          return;
        }
        throw new Error('Failed to load personas');
      }
      const { data } = await response.json();

      // Transform API response to PersonaProfile format
      const transformed: PersonaProfile[] = (data || []).map((p: {
        id: string;
        name: string;
        description?: string;
        tone?: string;
        status?: string;
        accuracy?: number;
        trainingSourcesCount?: number;
        lastTrained?: string;
      }) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        voiceCharacteristics: {
          tonePreferences: { primary: p.tone || 'professional', secondary: ['friendly'], avoided: [] },
          vocabularyStyle: { complexity: 'moderate', jargonLevel: 'minimal', preferredWords: [], bannedWords: [] },
          sentenceStructure: { averageLength: 15, complexity: 'medium', punctuationStyle: 'standard' },
          emotionalTone: { positivity: 70, energy: 60, formality: 50, humor: 30 }
        },
        contentPreferences: {
          topics: { primary: [], secondary: [], trending: [], avoided: [] },
          formats: { preferred: [], successful: [], unsuccessful: [] },
          timing: { bestDays: ['Tuesday', 'Thursday'], bestHours: [9, 12, 17], frequency: 'daily' },
          hashtags: { commonly: [], branded: [], performance: {} },
          emojis: { usage: 'moderate', preferred: ['👍', '❤️', '🚀'] }
        },
        audienceInsights: {
          demographics: { ageRange: '25-44', primaryGender: 'all', locations: [], interests: [], occupations: [] },
          behavior: { activeHours: [9, 12, 17, 20], engagementPatterns: {}, contentPreferences: [], interactionStyle: 'moderate' },
          sentiment: { overall: 'positive', topicSentiment: {}, feedbackThemes: [] }
        },
        learningData: {
          contentHistory: [],
          engagementPatterns: [],
          adaptations: [],
          experiments: []
        },
        performance: {
          overallScore: p.accuracy || 70,
          growthRate: 0,
          engagementRate: 4.5,
          consistencyScore: 80,
          adaptabilityScore: 60,
          predictions: { nextBestTime: new Date(), recommendedContent: [], expectedEngagement: 5 }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      setPersonas(transformed);
      if (transformed.length > 0) {
        setSelectedPersona((current) => current || transformed[0]);
      }
    } catch (error) {
      console.error('Failed to load personas:', error);
    }
  }, []);

  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);
  
  // Create new persona via API
  const createPersona = async () => {
    if (!newPersonaName.trim()) {
      notify.error('Please enter a persona name');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPersonaName,
          description: newPersonaDescription
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create persona');
      }

      setShowCreateForm(false);
      setNewPersonaName('');
      setNewPersonaDescription('');
      notify.success('Persona created successfully!');

      // Reload personas from API
      await loadPersonas();
    } catch (error) {
      notify.error('Failed to create persona');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // Delete persona via API
  const deletePersona = async (id: string) => {
    try {
      const response = await fetch(`/api/personas?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete persona');
      }

      // Update local state
      const updated = personas.filter(p => p.id !== id);
      setPersonas(updated);

      if (selectedPersona?.id === id) {
        setSelectedPersona(updated[0] || null);
      }

      notify.success('Persona deleted');
    } catch (error) {
      notify.error('Failed to delete persona');
      console.error(error);
    }
  };
  
  // Train persona via API
  const trainPersona = async () => {
    if (!selectedPersona) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/personas/${selectedPersona.id}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: [
            {
              type: 'text',
              content: 'Sample training content for the AI persona. This content helps the AI learn your brand voice and communication style for better content generation.',
              metadata: { platform: 'general' }
            }
          ]
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start training');
      }

      notify.success('Training started! Check back shortly for results.');

      // Reload personas to get updated status
      await loadPersonas();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to train persona');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // Get performance score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <Brain className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">AI Persona Learning</h2>
            <p className="text-gray-400">Train AI to match your brand voice</p>
          </div>
        </div>
        
        <Button
          onClick={() => setShowCreateForm(true)}
          className="gradient-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Persona
        </Button>
      </div>
      
      {/* Create Form */}
      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Create New Persona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Persona name (e.g., Professional Brand Voice)"
                value={newPersonaName}
                onChange={(e) => setNewPersonaName(e.target.value)}
                className="bg-white/5 border-white/10"
              />
              <Textarea
                placeholder="Description (e.g., Formal tone for B2B communications)"
                value={newPersonaDescription}
                onChange={(e) => setNewPersonaDescription(e.target.value)}
                className="bg-white/5 border-white/10"
              />
              <div className="flex gap-2">
                <Button onClick={createPersona} className="gradient-primary">
                  Create Persona
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-white/5 border-white/10"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
      
      {/* Persona List */}
      {personas.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {personas.map(persona => (
            <motion.div
              key={persona.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                variant="glass"
                className={`cursor-pointer transition-all ${
                  selectedPersona?.id === persona.id
                    ? 'ring-2 ring-cyan-500'
                    : ''
                }`}
                onClick={() => setSelectedPersona(persona)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{persona.name}</h3>
                      <p className="text-sm text-gray-400">
                        {persona.description || 'No description'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePersona(persona.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Performance</span>
                      <span className={getScoreColor(persona.performance.overallScore)}>
                        {persona.performance.overallScore}%
                      </span>
                    </div>
                    <Progress value={persona.performance.overallScore} className="h-2" />
                    
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Activity className="h-3 w-3" />
                      <span>{persona.learningData.contentHistory.length} samples</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
      
      {/* Selected Persona Details */}
      {selectedPersona && (
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedPersona.name}</CardTitle>
                <CardDescription>{selectedPersona.description}</CardDescription>
              </div>
              <Button
                onClick={trainPersona}
                disabled={loading}
                className="gradient-primary"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                Train Persona
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 bg-white/5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="voice">Voice</TabsTrigger>
                <TabsTrigger value="audience">Audience</TabsTrigger>
                <TabsTrigger value="learning">Learning</TabsTrigger>
              </TabsList>
              
              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard
                    label="Overall Score"
                    value={`${selectedPersona.performance.overallScore}%`}
                    icon={Target}
                    color="text-cyan-400"
                  />
                  <MetricCard
                    label="Engagement Rate"
                    value={`${selectedPersona.performance.engagementRate.toFixed(1)}%`}
                    icon={TrendingUp}
                    color="text-green-400"
                  />
                  <MetricCard
                    label="Consistency"
                    value={`${selectedPersona.performance.consistencyScore}%`}
                    icon={CheckCircle}
                    color="text-blue-400"
                  />
                  <MetricCard
                    label="Adaptability"
                    value={`${selectedPersona.performance.adaptabilityScore}%`}
                    icon={Sparkles}
                    color="text-yellow-400"
                  />
                </div>
                
                {/* Recommendations */}
                <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <h4 className="font-medium text-white mb-3">AI Recommendations</h4>
                  <div className="space-y-2">
                    {personaLearning.generateSuggestions(selectedPersona.id).slice(0, 5).map((suggestion, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5" />
                        <span className="text-sm text-gray-300">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              {/* Voice Tab */}
              <TabsContent value="voice" className="space-y-4">
                <VoiceCharacteristicsDisplay characteristics={selectedPersona.voiceCharacteristics} />
              </TabsContent>
              
              {/* Audience Tab */}
              <TabsContent value="audience" className="space-y-4">
                <div className="grid gap-4">
                  <div className="p-4 bg-white/5 rounded-lg">
                    <h4 className="font-medium text-white mb-3">Demographics</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Age Range:</span>
                        <span className="ml-2 text-white">
                          {selectedPersona.audienceInsights.demographics.ageRange}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Interaction:</span>
                        <span className="ml-2 text-white">
                          {selectedPersona.audienceInsights.behavior.interactionStyle}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-white/5 rounded-lg">
                    <h4 className="font-medium text-white mb-3">Active Hours</h4>
                    <div className="flex gap-2">
                      {selectedPersona.audienceInsights.behavior.activeHours.map(hour => (
                        <Badge key={hour} variant="secondary">
                          {hour}:00
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              {/* Learning Tab */}
              <TabsContent value="learning" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-white">Content History</h4>
                    <Badge variant="secondary">
                      {selectedPersona.learningData.contentHistory.length} samples
                    </Badge>
                  </div>
                  
                  {selectedPersona.learningData.contentHistory.slice(-5).map((item, i) => (
                    <div key={i} className="p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                        <Badge variant={item.sentiment === 'positive' ? 'default' : 'secondary'}>
                          {item.sentiment}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">{item.content}</p>
                      <div className="flex gap-4 mt-2 text-xs text-gray-400">
                        <span>❤️ {item.metrics.likes}</span>
                        <span>🔄 {item.metrics.shares}</span>
                        <span>💬 {item.metrics.comments}</span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Experiments */}
                  {selectedPersona.learningData.experiments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-white mb-3">Recent Experiments</h4>
                      {selectedPersona.learningData.experiments.slice(-3).map((exp, i) => (
                        <div key={i} className="p-3 bg-white/5 rounded-lg mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">{exp.hypothesis}</span>
                            <Badge
                              variant={exp.result === 'success' ? 'default' : 'secondary'}
                            >
                              {exp.result}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{exp.learning}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
      
      {/* Empty State */}
      {personas.length === 0 && !showCreateForm && (
        <Card variant="glass" className="p-12 text-center">
          <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Personas Yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first AI persona to start learning your brand voice
          </p>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="gradient-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create First Persona
          </Button>
        </Card>
      )}
    </div>
  );
}

// Metric card component
function MetricCard({ 
  label, 
  value, 
  icon: Icon, 
  color 
}: { 
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

// Voice characteristics display
function VoiceCharacteristicsDisplay({ 
  characteristics 
}: { 
  characteristics: VoiceCharacteristics;
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-white/5 rounded-lg">
        <h4 className="font-medium text-white mb-3">Tone Preferences</h4>
        <div className="space-y-2">
          <div>
            <span className="text-sm text-gray-400">Primary:</span>
            <Badge className="ml-2">{characteristics.tonePreferences.primary}</Badge>
          </div>
          <div>
            <span className="text-sm text-gray-400">Secondary:</span>
            <div className="inline-flex gap-2 ml-2">
              {characteristics.tonePreferences.secondary.map(tone => (
                <Badge key={tone} variant="secondary">{tone}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-white/5 rounded-lg">
        <h4 className="font-medium text-white mb-3">Emotional Tone</h4>
        <div className="space-y-3">
          {Object.entries(characteristics.emotionalTone).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400 capitalize">{key}</span>
                <span className="text-white">{value}%</span>
              </div>
              <Progress value={value} className="h-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
