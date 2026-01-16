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
  
  // Load tests
  const loadTests = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const stored = localStorage.getItem('ab_tests');
    if (stored) {
      const data = JSON.parse(stored);
      setTests(data);
    } else {
      // Create sample tests
      const sampleTests = createSampleTests();
      setTests(sampleTests);
      localStorage.setItem('ab_tests', JSON.stringify(sampleTests));
    }
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);
  
  // Create sample tests
  const createSampleTests = (): ABTest[] => {
    return [
      {
        id: 'test-1',
        name: 'Emoji vs No Emoji',
        hypothesis: 'Adding emojis to posts will increase engagement by 20%',
        status: 'completed',
        variantA: {
          name: 'Control (No Emoji)',
          content: 'Check out our new feature launch!',
          impressions: 5000,
          engagement: 250,
          conversions: 50,
          conversionRate: 1.0
        },
        variantB: {
          name: 'Test (With Emoji)',
          content: '🚀 Check out our new feature launch! ✨',
          impressions: 5000,
          engagement: 375,
          conversions: 85,
          conversionRate: 1.7
        },
        metrics: {
          sampleSize: 10000,
          statisticalSignificance: 95,
          uplift: 70,
          timeToSignificance: 3
        },
        duration: 7,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        winner: 'B',
        confidence: 95,
        recommendations: [
          'Implement emojis in all future posts',
          'Test different emoji combinations',
          'Consider platform-specific emoji usage'
        ]
      },
      {
        id: 'test-2',
        name: 'Long vs Short Copy',
        hypothesis: 'Shorter copy will improve click-through rates',
        status: 'running',
        variantA: {
          name: 'Long Copy',
          content: 'Discover the ultimate solution for your social media management needs...',
          impressions: 2500,
          engagement: 125,
          conversions: 25,
          conversionRate: 1.0
        },
        variantB: {
          name: 'Short Copy',
          content: 'Social media made simple.',
          impressions: 2500,
          engagement: 150,
          conversions: 30,
          conversionRate: 1.2
        },
        metrics: {
          sampleSize: 5000,
          statisticalSignificance: 78,
          uplift: 20,
          timeToSignificance: undefined
        },
        duration: 14,
        startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        confidence: 78,
        recommendations: [
          'Continue test for more data',
          'Current trend favors short copy',
          'Monitor engagement quality'
        ]
      }
    ];
  };
  
  // Create new test
  const createTest = () => {
    if (!testName || !hypothesis || !variantAContent || !variantBContent) {
      notify.error('Please fill in all fields');
      return;
    }
    
    const newTest: ABTest = {
      id: `test-${Date.now()}`,
      name: testName,
      hypothesis,
      status: 'draft',
      variantA: {
        name: 'Control',
        content: variantAContent,
        impressions: 0,
        engagement: 0,
        conversions: 0,
        conversionRate: 0
      },
      variantB: {
        name: 'Test',
        content: variantBContent,
        impressions: 0,
        engagement: 0,
        conversions: 0,
        conversionRate: 0
      },
      metrics: {
        sampleSize: 0,
        statisticalSignificance: 0,
        uplift: 0
      },
      duration,
      confidence: 0,
      recommendations: []
    };
    
    const updated = [...tests, newTest];
    setTests(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ab_tests', JSON.stringify(updated));
    }
    setSelectedTest(newTest);
    setShowCreateForm(false);
    resetForm();
    notify.success('A/B test created successfully!');
  };
  
  // Start test
  const startTest = (test: ABTest) => {
    test.status = 'running';
    test.startDate = new Date();
    const updated = [...tests];
    setTests(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ab_tests', JSON.stringify(updated));
    }
    notify.success('Test started!');
    
    // Simulate test progress
    simulateTestProgress(test.id);
  };
  
  // Simulate test progress
  const simulateTestProgress = (testId: string) => {
    const interval = setInterval(() => {
      setTests(prevTests => {
        const updated = prevTests.map(test => {
          if (test.id === testId && test.status === 'running') {
            // Update metrics
            test.variantA.impressions += Math.floor(Math.random() * 100);
            test.variantA.engagement += Math.floor(Math.random() * 10);
            test.variantA.conversions += Math.floor(Math.random() * 2);
            
            test.variantB.impressions += Math.floor(Math.random() * 100);
            test.variantB.engagement += Math.floor(Math.random() * 15);
            test.variantB.conversions += Math.floor(Math.random() * 3);
            
            // Calculate rates
            test.variantA.conversionRate = (test.variantA.conversions / test.variantA.impressions) * 100;
            test.variantB.conversionRate = (test.variantB.conversions / test.variantB.impressions) * 100;
            
            // Update metrics
            test.metrics.sampleSize = test.variantA.impressions + test.variantB.impressions;
            test.metrics.statisticalSignificance = Math.min(95, test.metrics.sampleSize / 100);
            test.metrics.uplift = ((test.variantB.conversionRate - test.variantA.conversionRate) / test.variantA.conversionRate) * 100;
            
            // Check for completion
            if (test.metrics.statisticalSignificance >= 95) {
              test.status = 'completed';
              test.endDate = new Date();
              test.winner = test.variantB.conversionRate > test.variantA.conversionRate ? 'B' : 'A';
              test.confidence = test.metrics.statisticalSignificance;
              test.recommendations = generateRecommendations(test);
              clearInterval(interval);
              notify.success(`Test "${test.name}" completed! Winner: Variant ${test.winner}`);
            }
          }
          return test;
        });
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('ab_tests', JSON.stringify(updated));
        }
        return updated;
      });
    }, 2000);
  };
  
  // Generate AI recommendations
  const generateRecommendations = (test: ABTest): string[] => {
    const recommendations: string[] = [];
    
    if (test.winner === 'B') {
      recommendations.push(`Implement Variant B: "${test.variantB.name}" across all content`);
      recommendations.push(`Expected uplift: ${test.metrics.uplift.toFixed(1)}% in conversions`);
      
      // Analyze differences
      if (test.variantB.content.includes('emoji') || /[\u{1F300}-\u{1F9FF}]/u.test(test.variantB.content)) {
        recommendations.push('Continue using emojis for better engagement');
      }
      
      if (test.variantB.content.length < test.variantA.content.length) {
        recommendations.push('Shorter copy performs better - keep it concise');
      }
    } else if (test.winner === 'A') {
      recommendations.push('Keep current approach - control performed better');
      recommendations.push('Test different variations of the control');
    }
    
    recommendations.push(`Run follow-up test with sample size of ${test.metrics.sampleSize * 2} for higher confidence`);
    
    return recommendations;
  };
  
  // Pause test
  const pauseTest = (test: ABTest) => {
    test.status = 'paused';
    const updated = [...tests];
    setTests(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ab_tests', JSON.stringify(updated));
    }
    notify.info('Test paused');
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
  
  // Generate chart data
  const generateChartData = (test: ABTest) => {
    if (!test.startDate) return [];
    
    const days = Math.min(7, Math.floor((Date.now() - test.startDate.getTime()) / (24 * 60 * 60 * 1000)));
    const data = [];
    
    for (let i = 0; i <= days; i++) {
      data.push({
        day: `Day ${i + 1}`,
        variantA: Math.floor(Math.random() * 100) + 50,
        variantB: Math.floor(Math.random() * 100) + 60
      });
    }
    
    return data;
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <FlaskConical className="h-6 w-6 text-purple-400" />
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
          <Card className="glass-card">
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
              className="glass-card cursor-pointer"
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
        <Card className="glass-card">
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
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: '8px'
                        }}
                      />
                      <Line type="monotone" dataKey="variantA" stroke="#8b5cf6" name="Variant A" />
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
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  <h4 className="font-medium text-white">AI Recommendations</h4>
                </div>
                <div className="space-y-2">
                  {selectedTest.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5" />
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
