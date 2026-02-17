'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  Users,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  BarChart3,
  Activity,
  AlertCircle,
  Plus,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  Minus,
  Globe,
  Twitter,
  Instagram,
  Linkedin,
  Facebook,
  Youtube,
  Crown,
  Zap,
  Clock
} from '@/components/icons';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { notify } from '@/lib/notifications';

interface Competitor {
  id: string;
  name: string;
  domain: string;
  logo?: string;
  description: string;
  industry: string;
  size: 'small' | 'medium' | 'large' | 'enterprise';
  metrics: CompetitorMetrics;
  socialProfiles: SocialProfile[];
  contentStrategy: ContentStrategy;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  tracking: boolean;
}

interface CompetitorMetrics {
  followers: PlatformMetrics;
  engagement: PlatformMetrics;
  postFrequency: PlatformMetrics;
  growthRate: number;
  sentimentScore: number;
  shareOfVoice: number;
  contentPerformance: ContentPerformance;
}

interface PlatformMetrics {
  twitter?: number;
  instagram?: number;
  linkedin?: number;
  facebook?: number;
  youtube?: number;
  tiktok?: number;
  total: number;
}

interface SocialProfile {
  platform: string;
  handle: string;
  url: string;
  verified: boolean;
}

interface ContentStrategy {
  topContent: ContentItem[];
  postingTimes: string[];
  contentTypes: { type: string; percentage: number }[];
  hashtagStrategy: string[];
  toneOfVoice: string;
}

interface ContentItem {
  id: string;
  platform: string;
  content: string;
  engagement: number;
  reach: number;
  date: Date;
  type: string;
}

interface ContentPerformance {
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  viralPosts: number;
}

export function CompetitorAnalysis() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  useEffect(() => {
    loadCompetitors();
  }, []);

  const loadCompetitors = async () => {
    setLoading(true);

    try {
      // Fetch competitors from both tracking and intelligence APIs
      const [trackRes, intelRes] = await Promise.all([
        fetch('/api/competitors/track?active=true'),
        fetch('/api/intelligence/competitors?action=list')
      ]);

      const loadedCompetitors: Competitor[] = [];

      // Process tracked competitors
      if (trackRes.ok) {
        const trackData = await trackRes.json();

        if (trackData.competitors && Array.isArray(trackData.competitors)) {
          for (const comp of trackData.competitors) {
            // Transform API response to component interface
            const snapshot = comp.latestSnapshot || {};

            loadedCompetitors.push({
              id: comp.id,
              name: comp.name,
              domain: comp.domain || '',
              description: comp.description || 'Competitor being tracked',
              industry: comp.industry || 'Unknown',
              size: determineSizeFromFollowers(snapshot.followers || 0),
              metrics: {
                followers: {
                  twitter: snapshot.twitterFollowers || 0,
                  instagram: snapshot.instagramFollowers || 0,
                  linkedin: snapshot.linkedinFollowers || 0,
                  facebook: snapshot.facebookFollowers || 0,
                  youtube: snapshot.youtubeFollowers || 0,
                  tiktok: snapshot.tiktokFollowers || 0,
                  total: snapshot.followers || 0
                },
                engagement: {
                  twitter: snapshot.twitterEngagement || 0,
                  instagram: snapshot.instagramEngagement || 0,
                  linkedin: snapshot.linkedinEngagement || 0,
                  facebook: snapshot.facebookEngagement || 0,
                  youtube: snapshot.youtubeEngagement || 0,
                  tiktok: snapshot.tiktokEngagement || 0,
                  total: snapshot.engagementRate || 0
                },
                postFrequency: {
                  twitter: snapshot.twitterPostFreq || 0,
                  instagram: snapshot.instagramPostFreq || 0,
                  linkedin: snapshot.linkedinPostFreq || 0,
                  facebook: snapshot.facebookPostFreq || 0,
                  youtube: snapshot.youtubePostFreq || 0,
                  tiktok: snapshot.tiktokPostFreq || 0,
                  total: snapshot.totalPostFreq || 0
                },
                growthRate: snapshot.growthRate || 0,
                sentimentScore: snapshot.sentimentScore || 0,
                shareOfVoice: snapshot.shareOfVoice || 0,
                contentPerformance: {
                  avgLikes: snapshot.avgLikes || 0,
                  avgComments: snapshot.avgComments || 0,
                  avgShares: snapshot.avgShares || 0,
                  viralPosts: snapshot.viralPosts || 0
                }
              },
              socialProfiles: buildSocialProfiles(comp),
              contentStrategy: {
                topContent: [],
                postingTimes: snapshot.postingTimes || [],
                contentTypes: snapshot.contentTypes || [],
                hashtagStrategy: comp.tags || [],
                toneOfVoice: snapshot.toneOfVoice || ''
              },
              strengths: snapshot.strengths || [],
              weaknesses: snapshot.weaknesses || [],
              opportunities: snapshot.opportunities || [],
              tracking: comp.isActive !== false
            });
          }
        }
      }

      // Add competitors from intelligence API if any
      if (intelRes.ok) {
        const intelData = await intelRes.json();

        if (intelData.competitors && Array.isArray(intelData.competitors)) {
          for (const comp of intelData.competitors) {
            // Only add if not already in list
            if (!loadedCompetitors.some(c => c.id === comp.id)) {
              loadedCompetitors.push({
                id: comp.id,
                name: comp.name,
                domain: comp.website || '',
                description: comp.notes || 'Competitor profile',
                industry: comp.industry || 'Unknown',
                size: 'medium',
                metrics: {
                  followers: { total: 0 },
                  engagement: { total: 0 },
                  postFrequency: { total: 0 },
                  growthRate: 0,
                  sentimentScore: 0,
                  shareOfVoice: 0,
                  contentPerformance: {
                    avgLikes: 0,
                    avgComments: 0,
                    avgShares: 0,
                    viralPosts: 0
                  }
                },
                socialProfiles: [],
                contentStrategy: {
                  topContent: [],
                  postingTimes: [],
                  contentTypes: [],
                  hashtagStrategy: [],
                  toneOfVoice: ''
                },
                strengths: [],
                weaknesses: [],
                opportunities: [],
                tracking: comp.isActive !== false
              });
            }
          }
        }
      }

      setCompetitors(loadedCompetitors);
      if (loadedCompetitors.length > 0) {
        setSelectedCompetitor(loadedCompetitors[0]);
      }

    } catch (error) {
      console.error('Error loading competitors:', error);
      notify.error('Failed to load competitors');
      setCompetitors([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to determine company size from follower count
  const determineSizeFromFollowers = (followers: number): 'small' | 'medium' | 'large' | 'enterprise' => {
    if (followers >= 1000000) return 'enterprise';
    if (followers >= 100000) return 'large';
    if (followers >= 10000) return 'medium';
    return 'small';
  };

  // Helper to build social profiles from competitor data
  const buildSocialProfiles = (comp: {
    twitterHandle?: string;
    instagramHandle?: string;
    linkedinHandle?: string;
    facebookHandle?: string;
    youtubeHandle?: string;
    tiktokHandle?: string;
  }): SocialProfile[] => {
    const profiles: SocialProfile[] = [];

    if (comp.twitterHandle) {
      profiles.push({ platform: 'twitter', handle: comp.twitterHandle, url: `twitter.com/${comp.twitterHandle}`, verified: false });
    }
    if (comp.instagramHandle) {
      profiles.push({ platform: 'instagram', handle: comp.instagramHandle, url: `instagram.com/${comp.instagramHandle}`, verified: false });
    }
    if (comp.linkedinHandle) {
      profiles.push({ platform: 'linkedin', handle: comp.linkedinHandle, url: `linkedin.com/company/${comp.linkedinHandle}`, verified: false });
    }
    if (comp.facebookHandle) {
      profiles.push({ platform: 'facebook', handle: comp.facebookHandle, url: `facebook.com/${comp.facebookHandle}`, verified: false });
    }
    if (comp.youtubeHandle) {
      profiles.push({ platform: 'youtube', handle: comp.youtubeHandle, url: `youtube.com/${comp.youtubeHandle}`, verified: false });
    }
    if (comp.tiktokHandle) {
      profiles.push({ platform: 'tiktok', handle: comp.tiktokHandle, url: `tiktok.com/@${comp.tiktokHandle}`, verified: false });
    }

    return profiles;
  };
  
  const addCompetitor = async () => {
    if (!newCompetitorUrl) {
      notify.error('Please enter a competitor URL');
      return;
    }

    setLoading(true);

    try {
      // Extract domain name for competitor name
      let domain = newCompetitorUrl;
      let name = newCompetitorUrl;

      try {
        const url = new URL(newCompetitorUrl.startsWith('http') ? newCompetitorUrl : `https://${newCompetitorUrl}`);
        domain = url.hostname.replace(/^www\./, '');
        name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
      } catch {
        // Use as-is if not a valid URL
      }

      const response = await fetch('/api/competitors/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          domain: newCompetitorUrl.startsWith('http') ? newCompetitorUrl : `https://${newCompetitorUrl}`,
          description: 'Added for competitive analysis',
          trackingFrequency: 'daily'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          notify.error('Competitor with this domain already exists');
        } else {
          throw new Error(errorData.error || 'Failed to add competitor');
        }
        return;
      }

      const data = await response.json();

      // Add the new competitor to state
      const newCompetitor: Competitor = {
        id: data.competitor.id,
        name: data.competitor.name,
        domain: domain,
        description: 'Analyzing... Tracking will begin shortly.',
        industry: data.competitor.industry || 'Unknown',
        size: 'medium',
        metrics: {
          followers: { total: 0 },
          engagement: { total: 0 },
          postFrequency: { total: 0 },
          growthRate: 0,
          sentimentScore: 0,
          shareOfVoice: 0,
          contentPerformance: {
            avgLikes: 0,
            avgComments: 0,
            avgShares: 0,
            viralPosts: 0
          }
        },
        socialProfiles: [],
        contentStrategy: {
          topContent: [],
          postingTimes: [],
          contentTypes: [],
          hashtagStrategy: [],
          toneOfVoice: ''
        },
        strengths: [],
        weaknesses: [],
        opportunities: [],
        tracking: true
      };

      setCompetitors([...competitors, newCompetitor]);
      setNewCompetitorUrl('');
      setShowAddForm(false);
      notify.success('Competitor added for tracking');

    } catch (error) {
      console.error('Error adding competitor:', error);
      notify.error('Failed to add competitor');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleComparison = (competitorId: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(competitorId)) {
        return prev.filter(id => id !== competitorId);
      }
      if (prev.length >= 3) {
        notify.error('Maximum 3 competitors for comparison');
        return prev;
      }
      return [...prev, competitorId];
    });
  };
  
  // Generate comparison data
  const getComparisonData = () => {
    const selected = competitors.filter(c => selectedForComparison.includes(c.id));
    
    return {
      followers: selected.map(c => ({
        name: c.name,
        value: c.metrics.followers.total
      })),
      engagement: selected.map(c => ({
        name: c.name,
        twitter: c.metrics.engagement.twitter || 0,
        instagram: c.metrics.engagement.instagram || 0,
        linkedin: c.metrics.engagement.linkedin || 0
      })),
      radar: selected.map(c => ({
        competitor: c.name,
        followers: (c.metrics.followers.total / 1000000) * 10,
        engagement: c.metrics.engagement.total * 10,
        growth: c.metrics.growthRate,
        sentiment: c.metrics.sentimentScore / 10,
        frequency: c.metrics.postFrequency.total / 5
      }))
    };
  };
  
  const getChangeIndicator = (value: number) => {
    if (value > 0) return <ArrowUp className="h-3 w-3 text-green-400" />;
    if (value < 0) return <ArrowDown className="h-3 w-3 text-red-400" />;
    return <Minus className="h-3 w-3 text-gray-400" />;
  };
  
  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, React.ElementType> = {
      twitter: Twitter,
      instagram: Instagram,
      linkedin: Linkedin,
      facebook: Facebook,
      youtube: Youtube,
      tiktok: Zap
    };
    return icons[platform] || Globe;
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <Target className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Competitor Analysis</h2>
            <p className="text-gray-400">Track and analyze competitor performance</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setComparisonMode(!comparisonMode)}
            className={comparisonMode ? 'bg-cyan-500/20 border-cyan-500' : 'bg-white/5 border-white/10'}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Compare
          </Button>
          <Button
            onClick={() => setShowAddForm(true)}
            className="gradient-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Competitor
          </Button>
        </div>
      </div>
      
      {/* Add Competitor Form */}
      {showAddForm && (
        <Card variant="glass">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter competitor website or social profile URL..."
                value={newCompetitorUrl}
                onChange={(e) => setNewCompetitorUrl(e.target.value)}
                className="flex-1 bg-white/5 border-white/10"
              />
              <Button onClick={addCompetitor} disabled={loading}>
                {loading ? 'Analyzing...' : 'Add'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddForm(false)}
                className="bg-white/5 border-white/10"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Competitors Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {competitors.map(competitor => (
          <motion.div
            key={competitor.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              variant="glass"
              className={`cursor-pointer ${
                selectedCompetitor?.id === competitor.id ? 'ring-2 ring-cyan-500' : ''
              } ${
                selectedForComparison.includes(competitor.id) ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => !comparisonMode && setSelectedCompetitor(competitor)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      {competitor.name}
                      {competitor.metrics.growthRate > 20 && (
                        <Crown className="h-4 w-4 text-yellow-400" />
                      )}
                    </h3>
                    <p className="text-xs text-gray-400">{competitor.domain}</p>
                  </div>
                  {comparisonMode && (
                    <input
                      type="checkbox"
                      checked={selectedForComparison.includes(competitor.id)}
                      onChange={() => toggleComparison(competitor.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4"
                    />
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-400">Followers</p>
                    <p className="text-lg font-bold text-white">
                      {(competitor.metrics.followers.total / 1000000).toFixed(1)}M
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Engagement</p>
                    <p className="text-lg font-bold text-white">
                      {competitor.metrics.engagement.total.toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Growth Rate</span>
                    <div className="flex items-center gap-1">
                      {getChangeIndicator(competitor.metrics.growthRate)}
                      <span className="text-xs text-white">
                        {Math.abs(competitor.metrics.growthRate)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Share of Voice</span>
                    <Progress value={competitor.metrics.shareOfVoice} className="w-20 h-2" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Sentiment</span>
                    <Badge 
                      variant={competitor.metrics.sentimentScore > 70 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {competitor.metrics.sentimentScore}%
                    </Badge>
                  </div>
                </div>
                
                {/* Platform Icons */}
                <div className="flex gap-2 mt-3">
                  {Object.keys(competitor.metrics.followers)
                    .filter(p => p !== 'total' && competitor.metrics.followers[p as keyof PlatformMetrics])
                    .map(platform => {
                      const Icon = getPlatformIcon(platform);
                      return (
                        <div
                          key={platform}
                          className="p-1.5 bg-white/5 rounded"
                          title={platform}
                        >
                          <Icon className="h-3 w-3 text-gray-400" />
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      
      {/* Comparison View */}
      {comparisonMode && selectedForComparison.length > 1 && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Competitor Comparison</CardTitle>
            <CardDescription>
              Comparing {selectedForComparison.length} competitors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Follower Comparison */}
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Total Followers</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={getComparisonData().followers}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Engagement by Platform */}
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Engagement by Platform</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={getComparisonData().engagement}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="twitter" fill="#1DA1F2" />
                    <Bar dataKey="instagram" fill="#E4405F" />
                    <Bar dataKey="linkedin" fill="#0077B5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Radar Comparison */}
              <div className="lg:col-span-2">
                <h4 className="text-sm font-medium text-white mb-3">Overall Performance</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={getComparisonData().radar[0] ? [getComparisonData().radar[0]] : []}>
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis 
                      dataKey="competitor" 
                      stroke="#666"
                      tick={{ fill: '#999', fontSize: 12 }}
                    />
                    <PolarRadiusAxis stroke="#666" />
                    {getComparisonData().radar.map((_, index) => (
                      <Radar
                        key={index}
                        name={competitors.find(c => selectedForComparison[index] === c.id)?.name || ''}
                        dataKey="followers"
                        stroke={['#06b6d4', '#ec4899', '#3b82f6'][index]}
                        fill={['#06b6d4', '#ec4899', '#3b82f6'][index]}
                        fillOpacity={0.3}
                      />
                    ))}
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Selected Competitor Details */}
      {selectedCompetitor && !comparisonMode && (
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedCompetitor.name}</CardTitle>
                <CardDescription>{selectedCompetitor.description}</CardDescription>
              </div>
              <Badge>{selectedCompetitor.size}</Badge>
            </div>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 bg-white/5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="swot">SWOT</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6">
                {/* Platform Breakdown */}
                <div>
                  <h4 className="font-medium text-white mb-3">Platform Performance</h4>
                  <div className="grid gap-3">
                    {Object.entries(selectedCompetitor.metrics.followers)
                      .filter(([key]) => key !== 'total' && selectedCompetitor.metrics.followers[key as keyof PlatformMetrics])
                      .map(([platform, followers]) => {
                        const Icon = getPlatformIcon(platform);
                        const engagement = selectedCompetitor.metrics.engagement[platform as keyof PlatformMetrics] || 0;
                        
                        return (
                          <div key={platform} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                            <Icon className="h-5 w-5 text-gray-400" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white capitalize">{platform}</p>
                              <p className="text-xs text-gray-400">
                                {(followers as number).toLocaleString()} followers • {engagement}% engagement
                              </p>
                            </div>
                            <Badge variant="secondary">
                              {selectedCompetitor.metrics.postFrequency[platform as keyof PlatformMetrics]}/day
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                </div>
                
                {/* Content Performance */}
                <div>
                  <h4 className="font-medium text-white mb-3">Content Performance</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-white/5 rounded-lg text-center">
                      <Heart className="h-5 w-5 text-red-400 mx-auto mb-2" />
                      <p className="text-lg font-bold text-white">
                        {selectedCompetitor.metrics.contentPerformance.avgLikes.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">Avg Likes</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg text-center">
                      <MessageSquare className="h-5 w-5 text-blue-400 mx-auto mb-2" />
                      <p className="text-lg font-bold text-white">
                        {selectedCompetitor.metrics.contentPerformance.avgComments}
                      </p>
                      <p className="text-xs text-gray-400">Avg Comments</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg text-center">
                      <Share2 className="h-5 w-5 text-green-400 mx-auto mb-2" />
                      <p className="text-lg font-bold text-white">
                        {selectedCompetitor.metrics.contentPerformance.avgShares}
                      </p>
                      <p className="text-xs text-gray-400">Avg Shares</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg text-center">
                      <TrendingUp className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
                      <p className="text-lg font-bold text-white">
                        {selectedCompetitor.metrics.contentPerformance.viralPosts}
                      </p>
                      <p className="text-xs text-gray-400">Viral Posts</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="content" className="space-y-6">
                {/* Content Mix */}
                <div>
                  <h4 className="font-medium text-white mb-3">Content Mix</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={selectedCompetitor.contentStrategy.contentTypes}
                          dataKey="percentage"
                          nameKey="type"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {selectedCompetitor.contentStrategy.contentTypes.map((_, index) => (
                            <Cell 
                              key={index} 
                              fill={['#06b6d4', '#ec4899', '#3b82f6', '#10b981'][index]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Posting Times */}
                <div>
                  <h4 className="font-medium text-white mb-3">Optimal Posting Times</h4>
                  <div className="flex gap-2">
                    {selectedCompetitor.contentStrategy.postingTimes.map(time => (
                      <Badge key={time} variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        {time}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {/* Hashtag Strategy */}
                <div>
                  <h4 className="font-medium text-white mb-3">Top Hashtags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCompetitor.contentStrategy.hashtagStrategy.map(tag => (
                      <Badge key={tag} className="bg-cyan-500/20 text-cyan-400">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="swot" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Strengths */}
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <h4 className="font-medium text-green-400 mb-3">Strengths</h4>
                    <ul className="space-y-2">
                      {selectedCompetitor.strengths.map((strength, i) => (
                        <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-green-400">•</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Weaknesses */}
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <h4 className="font-medium text-red-400 mb-3">Weaknesses</h4>
                    <ul className="space-y-2">
                      {selectedCompetitor.weaknesses.map((weakness, i) => (
                        <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-red-400">•</span>
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Opportunities */}
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg md:col-span-2">
                    <h4 className="font-medium text-blue-400 mb-3">Opportunities</h4>
                    <ul className="space-y-2">
                      {selectedCompetitor.opportunities.map((opportunity, i) => (
                        <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-blue-400">•</span>
                          {opportunity}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="insights" className="space-y-6">
                <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-5 w-5 text-cyan-400" />
                    <h4 className="font-medium text-white">AI Insights</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-black/20 rounded">
                      <p className="text-sm text-gray-300">
                        <strong className="text-white">Growth Opportunity:</strong> {selectedCompetitor.name} has 
                        strong engagement on Instagram ({selectedCompetitor.metrics.engagement.instagram}%) but 
                        relatively low posting frequency. Increasing posts could drive significant growth.
                      </p>
                    </div>
                    <div className="p-3 bg-black/20 rounded">
                      <p className="text-sm text-gray-300">
                        <strong className="text-white">Content Gap:</strong> Only 20% user-generated content 
                        despite high engagement rates. Encouraging more UGC could boost authenticity.
                      </p>
                    </div>
                    <div className="p-3 bg-black/20 rounded">
                      <p className="text-sm text-gray-300">
                        <strong className="text-white">Platform Strategy:</strong> Consider their TikTok absence 
                        as an opportunity to capture younger audience before they establish presence.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}