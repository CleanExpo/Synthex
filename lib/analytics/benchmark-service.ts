/**
 * Benchmark Service
 *
 * @description Industry benchmark data and comparison logic for
 * social media performance metrics.
 *
 * Data sources:
 * - Industry standard engagement rates by platform
 * - Follower growth benchmarks
 * - Post frequency recommendations
 *
 * @module lib/analytics/benchmark-service
 */

// =============================================================================
// TYPES
// =============================================================================

export interface MetricBenchmark {
  average: number;
  good: number;
  excellent: number;
}

export interface PlatformBenchmarks {
  platform: string;
  metrics: {
    engagementRate: MetricBenchmark;
    followerGrowth: MetricBenchmark;
    postFrequency: MetricBenchmark;
    reachRate: MetricBenchmark;
  };
}

export interface UserMetrics {
  platform: string;
  engagementRate: number;
  followerGrowth: number;
  postFrequency: number;
  reachRate: number;
}

export interface BenchmarkComparison {
  metric: string;
  displayName: string;
  userValue: number;
  benchmark: MetricBenchmark;
  percentile: number;
  rating: 'below' | 'average' | 'good' | 'excellent';
  delta: number;
  deltaPercent: number;
  unit: string;
}

export interface PlatformReport {
  platform: string;
  comparisons: BenchmarkComparison[];
  overallRating: 'below' | 'average' | 'good' | 'excellent';
  overallScore: number;
}

export interface BenchmarkReport {
  overall: {
    score: number;
    rating: 'below' | 'average' | 'good' | 'excellent';
    percentile: number;
  };
  byPlatform: PlatformReport[];
  insights: string[];
  recommendations: string[];
  generatedAt: string;
}

// =============================================================================
// BENCHMARK DATA
// =============================================================================

const PLATFORM_BENCHMARKS: Record<string, PlatformBenchmarks> = {
  instagram: {
    platform: 'instagram',
    metrics: {
      engagementRate: { average: 2.0, good: 4.0, excellent: 6.0 },
      followerGrowth: { average: 2.0, good: 4.0, excellent: 6.0 },
      postFrequency: { average: 3, good: 5, excellent: 7 }, // posts per week
      reachRate: { average: 20, good: 35, excellent: 50 }, // % of followers
    },
  },
  twitter: {
    platform: 'twitter',
    metrics: {
      engagementRate: { average: 0.5, good: 1.5, excellent: 3.0 },
      followerGrowth: { average: 1.5, good: 3.0, excellent: 5.0 },
      postFrequency: { average: 5, good: 10, excellent: 20 },
      reachRate: { average: 5, good: 15, excellent: 30 },
    },
  },
  tiktok: {
    platform: 'tiktok',
    metrics: {
      engagementRate: { average: 5.0, good: 10.0, excellent: 15.0 },
      followerGrowth: { average: 5.0, good: 10.0, excellent: 20.0 },
      postFrequency: { average: 3, good: 7, excellent: 14 },
      reachRate: { average: 15, good: 30, excellent: 50 },
    },
  },
  youtube: {
    platform: 'youtube',
    metrics: {
      engagementRate: { average: 3.0, good: 5.0, excellent: 8.0 },
      followerGrowth: { average: 2.0, good: 5.0, excellent: 10.0 },
      postFrequency: { average: 1, good: 2, excellent: 4 }, // videos per week
      reachRate: { average: 30, good: 50, excellent: 70 },
    },
  },
  linkedin: {
    platform: 'linkedin',
    metrics: {
      engagementRate: { average: 2.0, good: 4.0, excellent: 6.0 },
      followerGrowth: { average: 2.0, good: 4.0, excellent: 8.0 },
      postFrequency: { average: 2, good: 4, excellent: 7 },
      reachRate: { average: 10, good: 20, excellent: 35 },
    },
  },
  facebook: {
    platform: 'facebook',
    metrics: {
      engagementRate: { average: 0.5, good: 1.5, excellent: 3.0 },
      followerGrowth: { average: 1.0, good: 2.5, excellent: 5.0 },
      postFrequency: { average: 3, good: 5, excellent: 10 },
      reachRate: { average: 5, good: 12, excellent: 25 },
    },
  },
  pinterest: {
    platform: 'pinterest',
    metrics: {
      engagementRate: { average: 0.2, good: 0.5, excellent: 1.0 },
      followerGrowth: { average: 3.0, good: 6.0, excellent: 12.0 },
      postFrequency: { average: 5, good: 15, excellent: 30 },
      reachRate: { average: 10, good: 25, excellent: 50 },
    },
  },
  reddit: {
    platform: 'reddit',
    metrics: {
      engagementRate: { average: 1.0, good: 3.0, excellent: 8.0 },
      followerGrowth: { average: 1.0, good: 3.0, excellent: 7.0 },
      postFrequency: { average: 2, good: 5, excellent: 10 },
      reachRate: { average: 5, good: 15, excellent: 40 },
    },
  },
  threads: {
    platform: 'threads',
    metrics: {
      engagementRate: { average: 2.0, good: 5.0, excellent: 10.0 },
      followerGrowth: { average: 3.0, good: 7.0, excellent: 15.0 },
      postFrequency: { average: 3, good: 7, excellent: 14 },
      reachRate: { average: 15, good: 30, excellent: 50 },
    },
  },
};

const METRIC_DISPLAY_NAMES: Record<string, { name: string; unit: string }> = {
  engagementRate: { name: 'Engagement Rate', unit: '%' },
  followerGrowth: { name: 'Follower Growth', unit: '%/month' },
  postFrequency: { name: 'Post Frequency', unit: '/week' },
  reachRate: { name: 'Reach Rate', unit: '%' },
};

// =============================================================================
// BENCHMARK SERVICE CLASS
// =============================================================================

export class BenchmarkService {
  /**
   * Get benchmarks for a specific platform
   */
  getBenchmarks(platform: string): PlatformBenchmarks | null {
    const normalized = platform.toLowerCase();
    return PLATFORM_BENCHMARKS[normalized] || null;
  }

  /**
   * Get all available platform benchmarks
   */
  getAllBenchmarks(): PlatformBenchmarks[] {
    return Object.values(PLATFORM_BENCHMARKS);
  }

  /**
   * Calculate percentile based on value and benchmark
   */
  calculatePercentile(value: number, benchmark: MetricBenchmark): number {
    if (value <= 0) return 0;
    if (value >= benchmark.excellent) return 95 + Math.min(5, (value - benchmark.excellent) / benchmark.excellent * 5);
    if (value >= benchmark.good) {
      const range = benchmark.excellent - benchmark.good;
      const position = (value - benchmark.good) / range;
      return 75 + position * 20;
    }
    if (value >= benchmark.average) {
      const range = benchmark.good - benchmark.average;
      const position = (value - benchmark.average) / range;
      return 50 + position * 25;
    }
    // Below average
    const position = value / benchmark.average;
    return Math.max(0, position * 50);
  }

  /**
   * Get rating based on value and benchmark
   */
  getRating(value: number, benchmark: MetricBenchmark): 'below' | 'average' | 'good' | 'excellent' {
    if (value >= benchmark.excellent) return 'excellent';
    if (value >= benchmark.good) return 'good';
    if (value >= benchmark.average) return 'average';
    return 'below';
  }

  /**
   * Compare user metrics against benchmarks
   */
  compareMetrics(userMetrics: UserMetrics): BenchmarkComparison[] {
    const benchmarks = this.getBenchmarks(userMetrics.platform);
    if (!benchmarks) return [];

    const comparisons: BenchmarkComparison[] = [];
    const metricKeys: (keyof typeof benchmarks.metrics)[] = [
      'engagementRate',
      'followerGrowth',
      'postFrequency',
      'reachRate',
    ];

    for (const metric of metricKeys) {
      const userValue = userMetrics[metric];
      const benchmark = benchmarks.metrics[metric];
      const displayInfo = METRIC_DISPLAY_NAMES[metric];

      const percentile = this.calculatePercentile(userValue, benchmark);
      const rating = this.getRating(userValue, benchmark);
      const delta = userValue - benchmark.average;
      const deltaPercent = benchmark.average > 0 ? (delta / benchmark.average) * 100 : 0;

      comparisons.push({
        metric,
        displayName: displayInfo.name,
        userValue,
        benchmark,
        percentile: Math.round(percentile),
        rating,
        delta: Math.round(delta * 100) / 100,
        deltaPercent: Math.round(deltaPercent),
        unit: displayInfo.unit,
      });
    }

    return comparisons;
  }

  /**
   * Calculate overall platform score from comparisons
   */
  calculatePlatformScore(comparisons: BenchmarkComparison[]): number {
    if (comparisons.length === 0) return 0;
    const avgPercentile = comparisons.reduce((sum, c) => sum + c.percentile, 0) / comparisons.length;
    return Math.round(avgPercentile);
  }

  /**
   * Generate full benchmark report
   */
  generateReport(userMetricsList: UserMetrics[]): BenchmarkReport {
    const byPlatform: PlatformReport[] = [];
    let totalScore = 0;
    let platformCount = 0;

    for (const userMetrics of userMetricsList) {
      const comparisons = this.compareMetrics(userMetrics);
      if (comparisons.length === 0) continue;

      const overallScore = this.calculatePlatformScore(comparisons);
      const overallRating = this.getOverallRating(overallScore);

      byPlatform.push({
        platform: userMetrics.platform,
        comparisons,
        overallRating,
        overallScore,
      });

      totalScore += overallScore;
      platformCount++;
    }

    const avgScore = platformCount > 0 ? Math.round(totalScore / platformCount) : 0;
    const overallRating = this.getOverallRating(avgScore);

    const insights = this.generateInsights(byPlatform);
    const recommendations = this.generateRecommendations(byPlatform);

    return {
      overall: {
        score: avgScore,
        rating: overallRating,
        percentile: avgScore,
      },
      byPlatform,
      insights,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get overall rating from score
   */
  private getOverallRating(score: number): 'below' | 'average' | 'good' | 'excellent' {
    if (score >= 85) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 40) return 'average';
    return 'below';
  }

  /**
   * Generate insights from platform reports
   */
  private generateInsights(platforms: PlatformReport[]): string[] {
    const insights: string[] = [];

    if (platforms.length === 0) {
      return ['Connect platforms to see benchmark comparisons'];
    }

    // Find best performing platform
    const bestPlatform = [...platforms].sort((a, b) => b.overallScore - a.overallScore)[0];
    if (bestPlatform && bestPlatform.overallScore >= 50) {
      insights.push(
        `Your best performing platform is ${this.formatPlatformName(bestPlatform.platform)} with a ${bestPlatform.overallScore}th percentile ranking`
      );
    }

    // Find metrics above average
    const excellentMetrics: string[] = [];
    const belowMetrics: string[] = [];

    for (const platform of platforms) {
      for (const comparison of platform.comparisons) {
        if (comparison.rating === 'excellent') {
          excellentMetrics.push(`${comparison.displayName} on ${this.formatPlatformName(platform.platform)}`);
        } else if (comparison.rating === 'below') {
          belowMetrics.push(`${comparison.displayName} on ${this.formatPlatformName(platform.platform)}`);
        }
      }
    }

    if (excellentMetrics.length > 0) {
      insights.push(`You're excelling in: ${excellentMetrics.slice(0, 3).join(', ')}`);
    }

    if (belowMetrics.length > 0) {
      insights.push(`Opportunity for improvement: ${belowMetrics.slice(0, 2).join(', ')}`);
    }

    // Engagement insight
    const avgEngagement = platforms.reduce((sum, p) => {
      const engComp = p.comparisons.find((c) => c.metric === 'engagementRate');
      return sum + (engComp?.percentile || 0);
    }, 0) / platforms.length;

    if (avgEngagement >= 70) {
      insights.push('Your engagement rates are above industry average across platforms');
    } else if (avgEngagement < 40) {
      insights.push('Your engagement rates have room for improvement compared to industry benchmarks');
    }

    return insights.slice(0, 5);
  }

  /**
   * Generate recommendations from platform reports
   */
  private generateRecommendations(platforms: PlatformReport[]): string[] {
    const recommendations: string[] = [];

    for (const platform of platforms) {
      for (const comparison of platform.comparisons) {
        if (comparison.rating === 'below') {
          recommendations.push(
            this.getRecommendation(platform.platform, comparison.metric, comparison.userValue, comparison.benchmark)
          );
        }
      }
    }

    // Add general recommendations
    if (recommendations.length === 0) {
      recommendations.push('Keep up the great work! Your metrics are performing well');
      recommendations.push('Consider A/B testing to push metrics even higher');
    }

    return recommendations.slice(0, 6);
  }

  /**
   * Get specific recommendation for a metric
   */
  private getRecommendation(
    platform: string,
    metric: string,
    userValue: number,
    benchmark: MetricBenchmark
  ): string {
    const platformName = this.formatPlatformName(platform);
    const target = benchmark.average;

    switch (metric) {
      case 'engagementRate':
        return `Boost ${platformName} engagement by adding more calls-to-action and questions. Target: ${target}%`;
      case 'followerGrowth':
        return `Increase ${platformName} follower growth through consistent posting and collaborations. Target: ${target}%/month`;
      case 'postFrequency':
        return `Post more frequently on ${platformName}. Industry average is ${target} posts/week`;
      case 'reachRate':
        return `Improve ${platformName} reach by optimizing posting times and using relevant hashtags. Target: ${target}%`;
      default:
        return `Improve ${metric} on ${platformName} to reach industry average`;
    }
  }

  /**
   * Format platform name for display
   */
  private formatPlatformName(platform: string): string {
    const names: Record<string, string> = {
      instagram: 'Instagram',
      twitter: 'Twitter',
      tiktok: 'TikTok',
      youtube: 'YouTube',
      linkedin: 'LinkedIn',
      facebook: 'Facebook',
      pinterest: 'Pinterest',
      reddit: 'Reddit',
      threads: 'Threads',
    };
    return names[platform.toLowerCase()] || platform;
  }
}

export default BenchmarkService;
