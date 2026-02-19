'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Beaker,
  Play,
  Pause,
  TrendingUp,
  Users,
  Target,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Plus,
  Settings,
  RefreshCw
} from '@/components/icons';
import { abTestingService, Experiment } from '@/lib/ab-testing';
import { APIErrorCard } from '@/components/error-states';
import { DashboardSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [showNewExperimentForm, setShowNewExperimentForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await abTestingService.getExperiments();
      setExperiments(data);
    } catch (err) {
      console.error('Failed to fetch experiments:', err);
      setError('Failed to load experiments');
      toast.error('Failed to load experiments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (experimentId: string, newStatus: 'running' | 'paused' | 'completed') => {
    const success = await abTestingService.updateExperimentStatus(experimentId, newStatus);
    if (success) {
      toast.success(`Experiment ${newStatus}`);
      fetchExperiments();
    } else {
      toast.error('Failed to update experiment status');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      running: 'bg-green-500/20 text-green-400',
      paused: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-blue-500/20 text-blue-400',
      draft: 'bg-gray-500/20 text-gray-400'
    };

    return (
      <Badge className={styles[status as keyof typeof styles] || styles.draft}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard title="Experiments Error" message={error} onRetry={fetchExperiments} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">A/B Testing</h1>
          <p className="text-gray-400">Optimize your content with data-driven experiments</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchExperiments} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            className="gradient-primary text-white"
            disabled
            title="New experiment creation coming soon"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Experiment
          </Button>
        </div>
      </div>

      {/* Active Experiments Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Beaker className="w-4 h-4 mr-2 text-cyan-400" />
              Total Experiments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{experiments.length}</p>
            <p className="text-xs text-gray-400 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Play className="w-4 h-4 mr-2 text-green-400" />
              Running
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {experiments.filter(e => e.status === 'running').length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Active now</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="w-4 h-4 mr-2 text-blue-400" />
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {experiments.reduce((sum, e) => sum + e.metrics.totalParticipants, 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">Total tested</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-green-400" />
              Avg. Lift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">+15.3%</p>
            <p className="text-xs text-gray-400 mt-1">Performance gain</p>
          </CardContent>
        </Card>
      </div>

      {/* Experiments List */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Experiments</CardTitle>
          <CardDescription>Manage and monitor your A/B tests</CardDescription>
        </CardHeader>
        <CardContent>
          {experiments.length === 0 ? (
            <div className="text-center py-12">
              <Beaker className="h-16 w-16 mx-auto mb-4 text-slate-500" />
              <h3 className="text-xl font-semibold text-white mb-2">No experiments yet</h3>
              <p className="text-slate-400 mb-4">Create your first A/B test to get started.</p>
              <Button
                className="gradient-primary text-white"
                disabled
                title="New experiment creation coming soon"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Experiment
              </Button>
            </div>
          ) : (
          <div className="space-y-4">
            {experiments.map((experiment) => (
              <div
                key={experiment.id}
                className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      {experiment.name}
                      {getStatusBadge(experiment.status)}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">{experiment.description}</p>
                  </div>
                  <div className="flex gap-2">
                    {experiment.status === 'running' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(experiment.id, 'paused')}
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Pause
                      </Button>
                    ) : experiment.status === 'paused' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(experiment.id, 'running')}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Resume
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedExperiment(experiment);
                        toast('Experiment settings: ' + experiment.name, { icon: '⚙️' });
                      }}
                      aria-label="Experiment settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Variants */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {experiment.variants.map((variant) => (
                    <div key={variant.id} className="p-3 bg-white/5 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">
                          {variant.name}
                          {variant.isControl && (
                            <Badge className="ml-2 text-xs" variant="outline">Control</Badge>
                          )}
                        </span>
                        <span className="text-xs text-gray-400">{variant.weight}%</span>
                      </div>
                      {variant.metrics && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-400">
                            Participants: <span className="text-white">{variant.metrics.participants}</span>
                          </p>
                          <p className="text-xs text-gray-400">
                            Conversion: <span className="text-white">{variant.metrics.conversionRate.toFixed(2)}%</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Metrics */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Confidence</p>
                      <div className="flex items-center gap-2">
                        <Progress value={experiment.metrics.confidence} className="w-20 h-2" />
                        <span className="text-sm font-medium text-white">{experiment.metrics.confidence}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Participants</p>
                      <p className="text-sm font-medium text-white">{experiment.metrics.totalParticipants.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Conversion Rate</p>
                      <p className="text-sm font-medium text-white">{experiment.metrics.conversionRate.toFixed(2)}%</p>
                    </div>
                  </div>
                  {experiment.metrics.winner && (
                    <Badge className="bg-green-500/20 text-green-400">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Winner: {experiment.variants.find(v => v.id === experiment.metrics.winner)?.name}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2 text-cyan-400" />
            A/B Testing Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <h4 className="font-medium text-white mb-1">✅ Run tests for statistical significance</h4>
              <p className="text-xs text-gray-400">Wait for at least 95% confidence before making decisions</p>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="font-medium text-white mb-1">📊 Test one variable at a time</h4>
              <p className="text-xs text-gray-400">Isolate variables to understand what drives results</p>
            </div>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <h4 className="font-medium text-white mb-1">🎯 Define clear success metrics</h4>
              <p className="text-xs text-gray-400">Know what you're optimizing for before starting</p>
            </div>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <h4 className="font-medium text-white mb-1">⏱️ Run tests for complete cycles</h4>
              <p className="text-xs text-gray-400">Account for weekly and daily patterns in behavior</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}