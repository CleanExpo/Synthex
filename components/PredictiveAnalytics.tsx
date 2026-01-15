'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  DollarSign,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Zap,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  Sparkles,
  ChevronRight,
  Info,
  AlertCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { notify } from '@/lib/notifications';

interface Prediction {
  id: string;
  metric: string;
  category: 'engagement' | 'growth' | 'revenue' | 'risk';
  currentValue: number;
  predictedValue: number;
  change: number;
  confidence: number;
  timeframe: string;
  factors: Factor[];
  recommendations: string[];
  risk: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

interface Factor {
  name: string;
  impact: number; // -100 to 100
  description: string;
}

interface TimeSeriesData {
  date: string;
  actual: number;
  predicted: number;
  upperBound: number;
  lowerBound: number;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  probability: number;
  impact: string;
  metrics: ScenarioMetric[];
}

interface ScenarioMetric {
  metric: string;
  current: number;
  best: number;
  likely: number;
  worst: number;
}

interface Anomaly {
  id: string;
  type: 'spike' | 'drop' | 'pattern' | 'outlier';
  metric: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  value: number;
  expectedValue: number;
  description: string;
  action: string;
}

export function PredictiveAnalytics() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selectedMetric, setSelectedMetric] = useState('engagement');
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [accuracyScore, setAccuracyScore] = useState(0);
  
  const loadPredictions = useCallback(() => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setPredictions(generatePredictions());
      setTimeSeriesData(generateTimeSeriesData());
      setScenarios(generateScenarios());
      setAnomalies(generateAnomalies());
      setAccuracyScore(85 + Math.random() * 10);
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    loadPredictions();
  }, [loadPredictions, selectedMetric, selectedTimeframe]);
  
  const generatePredictions = (): Prediction[] => {
    return [
      {
        id: 'pred-1',
        metric: 'Engagement Rate',
        category: 'engagement',
        currentValue: 3.5,
        predictedValue: 4.2,
        change: 20,
        confidence: 87,
        timeframe: 'Next 7 days',
        factors: [
          { name: 'Weekend effect', impact: 35, description: 'Higher engagement on weekends' },
          { name: 'Content quality', impact: 25, description: 'Recent content performing well' },
          { name: 'Seasonal trend', impact: 20, description: 'Holiday season approaching' }
        ],
        recommendations: [
          'Post more during peak hours (2-4 PM)',
          'Increase video content by 30%',
          'Use trending hashtags more frequently'
        ],
        risk: 'low',
        impact: 'high'
      },
      {
        id: 'pred-2',
        metric: 'Follower Growth',
        category: 'growth',
        currentValue: 1250,
        predictedValue: 1580,
        change: 26.4,
        confidence: 92,
        timeframe: 'Next 30 days',
        factors: [
          { name: 'Viral potential', impact: 40, description: 'Content has viral characteristics' },
          { name: 'Competitor activity', impact: -15, description: 'Increased competition' },
          { name: 'Platform algorithm', impact: 30, description: 'Favorable algorithm changes' }
        ],
        recommendations: [
          'Launch referral campaign',
          'Collaborate with micro-influencers',
          'Optimize posting schedule'
        ],
        risk: 'medium',
        impact: 'high'
      },
      {
        id: 'pred-3',
        metric: 'Conversion Rate',
        category: 'revenue',
        currentValue: 2.1,
        predictedValue: 1.8,
        change: -14.3,
        confidence: 78,
        timeframe: 'Next 14 days',
        factors: [
          { name: 'Market saturation', impact: -30, description: 'Increased market competition' },
          { name: 'Ad fatigue', impact: -25, description: 'Audience seeing too many ads' },
          { name: 'Price sensitivity', impact: -20, description: 'Economic concerns affecting purchases' }
        ],
        recommendations: [
          'Refresh ad creative immediately',
          'Implement limited-time offers',
          'Reduce ad frequency by 20%'
        ],
        risk: 'high',
        impact: 'high'
      },
      {
        id: 'pred-4',
        metric: 'Content Reach',
        category: 'engagement',
        currentValue: 25000,
        predictedValue: 32000,
        change: 28,
        confidence: 85,
        timeframe: 'Next 7 days',
        factors: [
          { name: 'Algorithm boost', impact: 45, description: 'Recent algorithm favors your content type' },
          { name: 'Hashtag performance', impact: 30, description: 'Hashtags trending upward' },
          { name: 'Share rate', impact: 25, description: 'Increased sharing by followers' }
        ],
        recommendations: [
          'Maintain current content strategy',
          'Increase posting frequency by 15%',
          'Focus on shareable content formats'
        ],
        risk: 'low',
        impact: 'medium'
      }
    ];
  };
  
  const generateTimeSeriesData = (): TimeSeriesData[] => {
    const days = 30;
    const data: TimeSeriesData[] = [];
    let baseValue = 100;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      
      const actual = i < 20 ? baseValue + Math.random() * 20 - 10 : null;
      const predicted = baseValue + Math.random() * 15 - 5 + (i > 15 ? i * 0.5 : 0);
      
      data.push({
        date: date.toISOString().split('T')[0],
        actual: actual as any,
        predicted,
        upperBound: predicted + 10,
        lowerBound: predicted - 10
      });
      
      baseValue += Math.random() * 4 - 1;
    }
    
    return data;
  };
  
  const generateScenarios = (): Scenario[] => {
    return [
      {
        id: 'scenario-1',
        name: 'Best Case',
        description: 'All factors align favorably',
        probability: 25,
        impact: 'Very Positive',
        metrics: [
          { metric: 'Engagement', current: 3.5, best: 5.2, likely: 4.2, worst: 3.8 },
          { metric: 'Growth', current: 1250, best: 2100, likely: 1580, worst: 1400 },
          { metric: 'Revenue', current: 10000, best: 15000, likely: 12000, worst: 10500 }
        ]
      },
      {
        id: 'scenario-2',
        name: 'Most Likely',
        description: 'Expected outcome based on current trends',
        probability: 60,
        impact: 'Positive',
        metrics: [
          { metric: 'Engagement', current: 3.5, best: 4.5, likely: 4.0, worst: 3.6 },
          { metric: 'Growth', current: 1250, best: 1700, likely: 1450, worst: 1300 },
          { metric: 'Revenue', current: 10000, best: 12500, likely: 11000, worst: 10200 }
        ]
      },
      {
        id: 'scenario-3',
        name: 'Worst Case',
        description: 'Multiple negative factors occur',
        probability: 15,
        impact: 'Negative',
        metrics: [
          { metric: 'Engagement', current: 3.5, best: 3.6, likely: 3.2, worst: 2.8 },
          { metric: 'Growth', current: 1250, best: 1300, likely: 1150, worst: 1000 },
          { metric: 'Revenue', current: 10000, best: 10200, likely: 9500, worst: 8500 }
        ]
      }
    ];
  };
  
  const generateAnomalies = (): Anomaly[] => {
    return [
      {
        id: 'anomaly-1',
        type: 'spike',
        metric: 'Engagement Rate',
        severity: 'high',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        value: 8.5,
        expectedValue: 3.5,
        description: 'Unusual spike in engagement detected',
        action: 'Investigate viral content and replicate success factors'
      },
      {
        id: 'anomaly-2',
        type: 'drop',
        metric: 'Click-through Rate',
        severity: 'medium',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
        value: 0.8,
        expectedValue: 2.1,
        description: 'Sudden drop in CTR below normal range',
        action: 'Check for technical issues or content problems'
      },
      {
        id: 'anomaly-3',
        type: 'pattern',
        metric: 'Posting Frequency',
        severity: 'low',
        timestamp: new Date(),
        value: 3,
        expectedValue: 5,
        description: 'Irregular posting pattern detected',
        action: 'Review content calendar and scheduling'
      }
    ];
  };
  
  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-400';
  };
  
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <BarChart3 className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Predictive Analytics</h2>
            <p className="text-gray-400">AI-powered forecasting and insights</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/20 text-green-400">
            {accuracyScore.toFixed(1)}% Accuracy
          </Badge>
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="14d">14 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Key Predictions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {predictions.map(prediction => (
          <motion.div
            key={prediction.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400">{prediction.metric}</p>
                    <p className="text-2xl font-bold text-white">
                      {prediction.predictedValue}
                      {prediction.metric.includes('Rate') && '%'}
                    </p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${getRiskColor(prediction.risk)}`} />
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  {prediction.change > 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-green-400" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-400" />
                  )}
                  <span className={`text-sm font-medium ${getChangeColor(prediction.change)}`}>
                    {Math.abs(prediction.change).toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-400">vs current</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Confidence</span>
                    <span className="text-white">{prediction.confidence}%</span>
                  </div>
                  <Progress value={prediction.confidence} className="h-1.5" />
                </div>
                
                <p className="text-xs text-gray-400 mt-2">{prediction.timeframe}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      
      {/* Time Series Forecast */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Forecast Visualization</CardTitle>
          <CardDescription>Historical data and future predictions</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="date" 
                stroke="#666"
                tickFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <ReferenceLine x={timeSeriesData[20]?.date} stroke="#666" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="upperBound"
                stroke="transparent"
                fill="#8b5cf6"
                fillOpacity={0.1}
                name="Upper Bound"
              />
              <Area
                type="monotone"
                dataKey="lowerBound"
                stroke="transparent"
                fill="#8b5cf6"
                fillOpacity={0.1}
                name="Lower Bound"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Actual"
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Predicted"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Scenario Analysis */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Scenario Planning</CardTitle>
            <CardDescription>Possible future outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scenarios.map(scenario => (
                <div key={scenario.id} className="p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-white">{scenario.name}</h4>
                      <p className="text-xs text-gray-400">{scenario.description}</p>
                    </div>
                    <Badge variant="secondary">
                      {scenario.probability}% likely
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {scenario.metrics.map(metric => (
                      <div key={metric.metric} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{metric.metric}</span>
                        <div className="flex gap-3">
                          <span className="text-red-400">{metric.worst}</span>
                          <span className="text-yellow-400 font-medium">{metric.likely}</span>
                          <span className="text-green-400">{metric.best}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Anomaly Detection */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Anomaly Detection</CardTitle>
            <CardDescription>Unusual patterns requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {anomalies.map(anomaly => (
                <div key={anomaly.id} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {anomaly.type === 'spike' && <TrendingUp className="h-4 w-4 text-green-400" />}
                      {anomaly.type === 'drop' && <TrendingDown className="h-4 w-4 text-red-400" />}
                      {anomaly.type === 'pattern' && <Activity className="h-4 w-4 text-yellow-400" />}
                      {anomaly.type === 'outlier' && <AlertCircle className="h-4 w-4 text-purple-400" />}
                      <span className="font-medium text-white text-sm">{anomaly.metric}</span>
                    </div>
                    <Badge 
                      variant="secondary"
                      className={getSeverityColor(anomaly.severity)}
                    >
                      {anomaly.severity}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-gray-400 mb-2">{anomaly.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-xs">
                      <span className="text-gray-400">
                        Value: <span className="text-white">{anomaly.value}</span>
                      </span>
                      <span className="text-gray-400">
                        Expected: <span className="text-white">{anomaly.expectedValue}</span>
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(anomaly.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="mt-2 p-2 bg-purple-500/10 rounded flex items-start gap-2">
                    <Info className="h-3 w-3 text-purple-400 mt-0.5" />
                    <p className="text-xs text-gray-300">{anomaly.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* AI Insights */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <CardTitle>AI-Powered Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {predictions.slice(0, 3).map(prediction => (
              <div key={prediction.id} className="p-4 bg-white/5 rounded-lg">
                <h4 className="font-medium text-white mb-3">{prediction.metric}</h4>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Key Factors</p>
                    {prediction.factors.map(factor => (
                      <div key={factor.name} className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300">{factor.name}</span>
                        <div className="flex items-center gap-1">
                          {factor.impact > 0 ? (
                            <ArrowUpRight className="h-3 w-3 text-green-400" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 text-red-400" />
                          )}
                          <span className="text-xs text-white">{Math.abs(factor.impact)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Recommendations</p>
                    {prediction.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-1 mb-1">
                        <ChevronRight className="h-3 w-3 text-purple-400 mt-0.5" />
                        <span className="text-xs text-gray-300">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
