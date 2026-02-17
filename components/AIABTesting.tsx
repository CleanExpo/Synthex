'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FlaskConical, 
  TrendingUp, 
  BarChart3,
  Sparkles,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Clock,
  Target,
  Zap,
  Copy,
  RefreshCw,
  ChevronRight
} from '@/components/icons';
import { notify } from '@/lib/notifications';
import { fadeInUp, scaleIn } from '@/lib/animations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ABTest {
  id: string;
  name: string;
  hypothesis: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  variantA: TestVariant;
  variantB: TestVariant;
  metrics: TestMetrics;
  duration: number; // days
  startDate?: Date;
  endDate?: Date;
  winner?: 'A' | 'B' | 'inconclusive';
  confidence: number;
  recommendations: string[];
}

interface TestVariant {
  name: string;
  content: string;
  image?: string;
  cta?: string;
  hashtags?: string[];
  impressions: number;
  engagement: number;
  conversions: number;
  conversionRate: number;
}

interface TestMetrics {
  sampleSize: number;
  statisticalSignificance: number;
  uplift: number;
  timeToSignificance?: number;
}

export function AIABTesting() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [testName, setTestName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [variantAContent, setVariantAContent] = useState('');
  const [variantBContent, setVariantBContent] = useState('');
  const [duration, setDuration] = useState(7);
  const [loading, setLoading] = useState(false);
  
  // Load tests from API
  const loadTests = useCallback(async () => {
    try {
      const response = await fetch('/api/ab-testing/tests');
      if (!response.ok) {
        if (response.status === 401) {
          setTests([]);
          return;
        }
        throw new Error('Failed to load tests');
      }

      const { data } = await response.json();

      // Transform API response to component's ABTest format
      const transformed: ABTest[] = (data || []).map((test: {
        id: string;
        name: string;
        hypothesis?: string;
        status: string;
        duration?: number;
        startDate?: string;
        endDate?: string;
        winner?: string;
        variants: Array<{
          name: string;
          content: string;
          image?: string;
          cta?: string;
          hashtags?: string[];
          impressions: number;
          engagement: number;
          conversions: number;
          conversionRate?: number;
        }>;
        metrics?: {
          sampleSize: number;
          statisticalSignificance: number;
          uplift: number;
          timeToSignificance?: number;
        };
      }) => {
        const variantA = test.variants[0] || { name: 'A', content: '', impressions: 0, engagement: 0, conversions: 0, conversionRate: 0 };
        const variantB = test.variants[1] || { name: 'B', content: '', impressions: 0, engagement: 0, conversions: 0, conversionRate: 0 };

        return {
          id: test.id,
          name: test.name,
          hypothesis: test.hypothesis || '',
          status: test.status as ABTest['status'],
          variantA: {
            name: variantA.name,
            content: variantA.content,
            image: variantA.image,
            cta: variantA.cta,
            hashtags: variantA.hashtags,
            impressions: variantA.impressions || 0,
            engagement: variantA.engagement || 0,
            conversions: variantA.conversions || 0,
            conversionRate: variantA.conversionRate || 0
          },
          variantB: {
            name: variantB.name,
            content: variantB.content,
            image: variantB.image,
            cta: variantB.cta,
            hashtags: variantB.hashtags,
            impressions: variantB.impressions || 0,
            engagement: variantB.engagement || 0,
            conversions: variantB.conversions || 0,
            conversionRate: variantB.conversionRate || 0
          },
          metrics: test.metrics || { sampleSize: 0, statisticalSignificance: 0, uplift: 0 },
          duration: test.duration || 7,
          startDate: test.startDate ? new Date(test.startDate) : undefined,
          endDate: test.endDate ? new Date(test.endDate) : undefined,
          winner: test.winner as ABTest['winner'],
          confidence: test.metrics?.statisticalSignificance || 0,
          recommendations: generateRecommendationsFromData(test)
        };
      });

      setTests(transformed);
    } catch (error) {
      console.error('Failed to load tests:', error);
    }
  }, []);

  // Generate recommendations from API data
  const generateRecommendationsFromData = (test: {
    winner?: string;
    variants: Array<{ name: string; content: string; conversionRate?: number }>;
    metrics?: { uplift: number };
  }): string[] => {
    const recommendations: string[] = [];
    const variantA = test.variants[0];
    const variantB = test.variants[1];

    if (test.winner === 'B' || test.winner === 'A') {
      const winningVariant = test.winner === 'B' ? variantB : variantA;
      recommendations.push(`Implement winning variant: "${winningVariant?.name}"`);
      if (test.metrics?.uplift) {
        recommendations.push(`Expected uplift: ${test.metrics.uplift.toFixed(1)}% in conversions`);
      }
    }

    return recommendations;
  };

  useEffect(() => {
    loadTests();
  }, [loadTests]);
  
  // Create new test via API
  const createTest = async () => {
    if (!testName || !hypothesis || !variantAContent || !variantBContent) {
      notify.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ab-testing/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testName,
          hypothesis,
          duration,
          variants: [
            { name: 'Control', content: variantAContent },
            { name: 'Test', content: variantBContent }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create test');
      }

      setShowCreateForm(false);
      resetForm();
      notify.success('A/B test created successfully!');

      // Reload tests from API
      await loadTests();
    } catch (error) {
      notify.error('Failed to create test');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // Start test via API
  const startTest = async (test: ABTest) => {
    try {
      const response = await fetch(`/api/ab-testing/tests/${test.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running' })
      });

      if (!response.ok) {
        throw new Error('Failed to start test');
      }

      notify.success('Test started!');
      await loadTests();
    } catch (error) {
      notify.error('Failed to start test');
      console.error(error);
    }
  };

  // Pause test via API
  const pauseTest = async (test: ABTest) => {
    try {
      const response = await fetch(`/api/ab-testing/tests/${test.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' })
      });

      if (!response.ok) {
        throw new Error('Failed to pause test');
      }

      notify.info('Test paused');
      await loadTests();
    } catch (error) {
      notify.error('Failed to pause test');
      console.error(error);
    }
  };
  
  // Reset form
  const resetForm = () => {
    setTestName('');
    setHypothesis('');
    setVariantAContent('');
    setVariantBContent('');
    setDuration(7);
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'running': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Generate chart data from test metrics
  const generateChartData = (test: ABTest) => {
    if (!test.startDate) return [];

    const days = Math.min(7, Math.floor((Date.now() - test.startDate.getTime()) / (24 * 60 * 60 * 1000)));
    const data: { day: string; variantA: number; variantB: number }[] = [];

    // Calculate daily averages based on total metrics
    const avgA = test.variantA.impressions > 0
      ? (test.variantA.engagement / test.variantA.impressions) * 100
      : 0;
    const avgB = test.variantB.impressions > 0
      ? (test.variantB.engagement / test.variantB.impressions) * 100
      : 0;

    // Distribute across days (real data would come from API time-series endpoint)
    for (let i = 0; i <= days; i++) {
      const progress = (i + 1) / (days + 1);
      data.push({
        day: `Day ${i + 1}`,
        variantA: Math.round(avgA * progress * 100) / 100,
        variantB: Math.round(avgB * progress * 100) / 100
      });
    }

    return data;
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <FlaskConical className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">A/B Testing</h2>
            <p className="text-gray-400">AI-powered testing recommendations</p>
          </div>
        </div>
        
        <Button
          onClick={() => setShowCreateForm(true)}
          className="gradient-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Test
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
              <CardTitle>Create A/B Test</CardTitle>
              <CardDescription>Set up your experiment with AI guidance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Test name (e.g., Emoji vs No Emoji)"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="bg-white/5 border-white/10"
              />
              
              <Textarea
                placeholder="Hypothesis (e.g., Adding emojis will increase engagement by 20%)"
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                className="bg-white/5 border-white/10"
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Variant A (Control)</label>
                  <Textarea
                    placeholder="Control content..."
                    value={variantAContent}
                    onChange={(e) => setVariantAContent(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Variant B (Test)</label>
                  <Textarea
                    placeholder="Test content..."
                    value={variantBContent}
                    onChange={(e) => setVariantBContent(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Test Duration: {duration} days
                </label>
                <input
                  type="range"
                  min="3"
                  max="30"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={createTest} className="gradient-primary">
                  Create Test
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="bg-white/5 border-white/10"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
      
      {/* Active Tests */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tests.map(test => (
          <motion.div
            key={test.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              variant="glass"
              className="cursor-pointer"
              onClick={() => setSelectedTest(test)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{test.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">{test.hypothesis}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(test.status)}`} />
                </div>
                
                <div className="space-y-3">
                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-2 bg-white/5 rounded">
                      <p className="text-xs text-gray-400">Variant A</p>
                      <p className="text-lg font-bold text-white">
                        {test.variantA.conversionRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-2 bg-white/5 rounded">
                      <p className="text-xs text-gray-400">Variant B</p>
                      <p className="text-lg font-bold text-white">
                        {test.variantB.conversionRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  
                  {/* Significance */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Statistical Significance</span>
                      <span className="text-white">{test.metrics.statisticalSignificance}%</span>
                    </div>
                    <Progress value={test.metrics.statisticalSignificance} className="h-2" />
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex items-center justify-between">
                    <Badge variant={test.status === 'completed' ? 'default' : 'secondary'}>
                      {test.status}
                    </Badge>
                    
                    {test.winner && (
                      <Badge className="bg-green-500/20 text-green-400">
                        Winner: Variant {test.winner}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                {test.status === 'draft' && (
                  <Button
                    size="sm"
                    className="w-full mt-3 gradient-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      startTest(test);
                    }}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Start Test
                  </Button>
                )}
                
                {test.status === 'running' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 bg-white/5 border-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      pauseTest(test);
                    }}
                  >
                    <Pause className="h-3 w-3 mr-1" />
                    Pause Test
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      
      {/* Selected Test Details */}
      {selectedTest && (
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedTest.name}</CardTitle>
                <CardDescription>{selectedTest.hypothesis}</CardDescription>
              </div>
              <Badge variant={selectedTest.status === 'completed' ? 'default' : 'secondary'}>
                {selectedTest.status}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Performance Chart */}
            {selectedTest.status !== 'draft' && (
              <div>
                <h4 className="font-medium text-white mb-3">Performance Over Time</h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={generateChartData(selectedTest)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="day" stroke="#666" />
                      <YAxis stroke="#666" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                          borderRadius: '8px'
                        }}
                      />
                      <Line type="monotone" dataKey="variantA" stroke="#06b6d4" name="Variant A" />
                      <Line type="monotone" dataKey="variantB" stroke="#ec4899" name="Variant B" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
            {/* Variants Comparison */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <h4 className="font-medium text-white mb-3">Variant A (Control)</h4>
                <p className="text-sm text-gray-300 mb-3">{selectedTest.variantA.content}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Impressions</span>
                    <span className="text-white">{selectedTest.variantA.impressions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Engagement</span>
                    <span className="text-white">{selectedTest.variantA.engagement}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Conversions</span>
                    <span className="text-white">{selectedTest.variantA.conversions}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-400">Conversion Rate</span>
                    <span className="text-white">{selectedTest.variantA.conversionRate.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-white/5 rounded-lg">
                <h4 className="font-medium text-white mb-3">Variant B (Test)</h4>
                <p className="text-sm text-gray-300 mb-3">{selectedTest.variantB.content}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Impressions</span>
                    <span className="text-white">{selectedTest.variantB.impressions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Engagement</span>
                    <span className="text-white">{selectedTest.variantB.engagement}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Conversions</span>
                    <span className="text-white">{selectedTest.variantB.conversions}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-400">Conversion Rate</span>
                    <span className="text-white">{selectedTest.variantB.conversionRate.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* AI Recommendations */}
            {selectedTest.recommendations.length > 0 && (
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  <h4 className="font-medium text-white">AI Recommendations</h4>
                </div>
                <div className="space-y-2">
                  {selectedTest.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5" />
                      <span className="text-sm text-gray-300">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Import Plus icon
import { Plus } from '@/components/icons';
