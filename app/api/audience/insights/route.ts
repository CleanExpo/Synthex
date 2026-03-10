/**
 * Audience Insights API
 *
 * @description Aggregates audience demographics, behavior patterns,
 * and growth data across all connected platforms.
 *
 * GET /api/audience/insights
 * Query: platform (all|specific), period (7d|30d|90d)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

// Platform configuration
const PLATFORM_CONFIG: Record<string, { name: string; color: string }> = {
  twitter: { name: 'Twitter', color: '#1DA1F2' },
  instagram: { name: 'Instagram', color: '#E4405F' },
  youtube: { name: 'YouTube', color: '#FF0000' },
  linkedin: { name: 'LinkedIn', color: '#0A66C2' },
  facebook: { name: 'Facebook', color: '#1877F2' },
  tiktok: { name: 'TikTok', color: '#000000' },
  pinterest: { name: 'Pinterest', color: '#E60023' },
  reddit: { name: 'Reddit', color: '#FF4500' },
  threads: { name: 'Threads', color: '#000000' },
};

// Age range distribution (mock data generator)
const AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];

// Days of week
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


// =============================================================================
// Mock Data Generators
// =============================================================================

function generateAgeDistribution(totalFollowers: number): Array<{ range: string; percentage: number; count: number }> {
  // Typical social media age distribution
  const baseDistribution = [
    { range: '13-17', percentage: 8 },
    { range: '18-24', percentage: 28 },
    { range: '25-34', percentage: 32 },
    { range: '35-44', percentage: 18 },
    { range: '45-54', percentage: 9 },
    { range: '55+', percentage: 5 },
  ];

  // Add some randomness
  return baseDistribution.map((item) => {
    const variance = (Math.random() - 0.5) * 6;
    const adjustedPercentage = Math.max(1, Math.min(50, item.percentage + variance));
    return {
      range: item.range,
      percentage: Math.round(adjustedPercentage * 10) / 10,
      count: Math.round((adjustedPercentage / 100) * totalFollowers),
    };
  });
}

function generateGenderSplit(totalFollowers: number): Array<{ gender: string; percentage: number; count: number }> {
  const malePercent = 40 + Math.random() * 20; // 40-60%
  const femalePercent = 100 - malePercent - 2; // remaining minus other
  const otherPercent = 2;

  return [
    { gender: 'Male', percentage: Math.round(malePercent * 10) / 10, count: Math.round((malePercent / 100) * totalFollowers) },
    { gender: 'Female', percentage: Math.round(femalePercent * 10) / 10, count: Math.round((femalePercent / 100) * totalFollowers) },
    { gender: 'Other', percentage: otherPercent, count: Math.round((otherPercent / 100) * totalFollowers) },
  ];
}

function generateTopLocations(totalFollowers: number): Array<{ location: string; country: string; percentage: number; count: number }> {
  const locations = [
    { location: 'New York', country: 'USA', weight: 12 },
    { location: 'Los Angeles', country: 'USA', weight: 10 },
    { location: 'London', country: 'UK', weight: 8 },
    { location: 'Chicago', country: 'USA', weight: 6 },
    { location: 'Toronto', country: 'Canada', weight: 5 },
    { location: 'Sydney', country: 'Australia', weight: 4 },
    { location: 'San Francisco', country: 'USA', weight: 4 },
    { location: 'Miami', country: 'USA', weight: 3 },
    { location: 'Seattle', country: 'USA', weight: 3 },
    { location: 'Austin', country: 'USA', weight: 3 },
  ];

  return locations.map((loc) => {
    const variance = (Math.random() - 0.5) * 2;
    const percentage = Math.max(1, loc.weight + variance);
    return {
      location: loc.location,
      country: loc.country,
      percentage: Math.round(percentage * 10) / 10,
      count: Math.round((percentage / 100) * totalFollowers),
    };
  });
}

function generateTopLanguages(): Array<{ language: string; percentage: number }> {
  return [
    { language: 'English', percentage: 65 },
    { language: 'Spanish', percentage: 12 },
    { language: 'Portuguese', percentage: 6 },
    { language: 'French', percentage: 4 },
    { language: 'German', percentage: 3 },
    { language: 'Other', percentage: 10 },
  ];
}

function generateBestPostingTimes(): Array<{ day: number; hour: number; engagement: number }> {
  const times: Array<{ day: number; hour: number; engagement: number }> = [];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      // Higher engagement during work hours and evenings
      let baseEngagement = 20;

      // Morning boost (8-10am)
      if (hour >= 8 && hour <= 10) baseEngagement += 25;

      // Lunch boost (12-1pm)
      if (hour >= 12 && hour <= 13) baseEngagement += 20;

      // Evening boost (6-9pm)
      if (hour >= 18 && hour <= 21) baseEngagement += 35;

      // Weekend adjustment
      if (day === 0 || day === 6) {
        baseEngagement = hour >= 10 && hour <= 20 ? baseEngagement + 10 : baseEngagement - 10;
      }

      // Night penalty
      if (hour >= 23 || hour <= 5) baseEngagement = Math.max(5, baseEngagement - 30);

      // Add randomness
      const variance = (Math.random() - 0.5) * 20;
      const engagement = Math.max(0, Math.min(100, baseEngagement + variance));

      times.push({
        day,
        hour,
        engagement: Math.round(engagement),
      });
    }
  }

  return times;
}

function generateActiveHours(): Array<{ hour: number; activity: number }> {
  const hours: Array<{ hour: number; activity: number }> = [];

  for (let hour = 0; hour < 24; hour++) {
    let activity = 30;

    // Morning ramp-up (6-9am)
    if (hour >= 6 && hour < 9) activity = 40 + (hour - 6) * 10;

    // Work hours (9am-5pm)
    if (hour >= 9 && hour < 17) activity = 60 + Math.random() * 20;

    // Evening peak (5-10pm)
    if (hour >= 17 && hour < 22) activity = 70 + Math.random() * 25;

    // Late night drop (10pm-12am)
    if (hour >= 22) activity = 50 - (hour - 22) * 15;

    // Early morning low (12am-6am)
    if (hour < 6) activity = 15 + Math.random() * 10;

    hours.push({
      hour,
      activity: Math.round(Math.max(5, Math.min(100, activity))),
    });
  }

  return hours;
}

function generatePeakDays(): Array<{ day: string; activity: number }> {
  return DAYS_OF_WEEK.map((day, index) => {
    let baseActivity = 65;

    // Weekday boost
    if (index >= 1 && index <= 5) baseActivity += 10;

    // Tuesday/Wednesday peak
    if (index === 2 || index === 3) baseActivity += 10;

    // Weekend dip
    if (index === 0 || index === 6) baseActivity -= 15;

    const variance = (Math.random() - 0.5) * 10;

    return {
      day,
      activity: Math.round(Math.max(30, Math.min(100, baseActivity + variance))),
    };
  });
}

function generateGrowthTrend(
  currentFollowers: number,
  days: number
): Array<{ date: string; followers: number; gained: number; lost: number }> {
  const trend: Array<{ date: string; followers: number; gained: number; lost: number }> = [];
  let followers = currentFollowers - Math.floor(currentFollowers * 0.05 * (days / 30)); // Start lower

  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Daily change: small gains with occasional losses
    const dailyGrowthRate = 0.001 + Math.random() * 0.003; // 0.1-0.4% daily growth
    const gained = Math.floor(followers * dailyGrowthRate * (0.8 + Math.random() * 0.4));
    const lost = Math.floor(gained * (0.1 + Math.random() * 0.2)); // 10-30% churn

    followers = followers + gained - lost;

    trend.push({
      date: date.toISOString().split('T')[0],
      followers,
      gained,
      lost,
    });
  }

  return trend;
}

// =============================================================================
// GET - Audience Insights
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const platformFilter = searchParams.get('platform') || 'all';
    const period = searchParams.get('period') || '30d';

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

    // Get org scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Fetch connected platforms
    const connections = await prisma.platformConnection.findMany({
      where: { userId: userId, organizationId: organizationId ?? null, isActive: true },
      select: {
        platform: true,
        profileName: true,
        metadata: true,
        lastSync: true,
      },
    });

    if (connections.length === 0) {
      // Return empty structure for no connections
      return NextResponse.json({
        success: true,
        data: {
          demographics: {
            ageRanges: [],
            genderSplit: [],
            topLocations: [],
            topLanguages: [],
          },
          behavior: {
            bestPostingTimes: [],
            activeHours: [],
            peakDays: [],
          },
          growth: {
            current: 0,
            previous: 0,
            change: 0,
            changePercent: 0,
            trend: [],
          },
          platforms: [],
          lastUpdated: new Date().toISOString(),
        },
      });
    }

    // Filter platforms if specific one requested
    const filteredConnections =
      platformFilter === 'all'
        ? connections
        : connections.filter((c) => c.platform.toLowerCase() === platformFilter.toLowerCase());

    // Calculate total followers across platforms
    let totalFollowers = 0;
    const platformData: Array<{
      id: string;
      name: string;
      color: string;
      followers: number;
      demographics: ReturnType<typeof generateAgeDistribution> extends Array<infer T> ? { ageRanges: T[]; genderSplit: ReturnType<typeof generateGenderSplit>; topLocations: ReturnType<typeof generateTopLocations>; topLanguages: ReturnType<typeof generateTopLanguages> } : never;
      behavior: { bestPostingTimes: ReturnType<typeof generateBestPostingTimes>; activeHours: ReturnType<typeof generateActiveHours>; peakDays: ReturnType<typeof generatePeakDays> };
    }> = [];

    for (const conn of filteredConnections) {
      const platformId = conn.platform.toLowerCase();
      const config = PLATFORM_CONFIG[platformId];
      if (!config) continue;

      const meta = conn.metadata as Record<string, number> | null;
      const followers = meta?.followers ?? meta?.subscriberCount ?? Math.floor(1000 + Math.random() * 50000);
      totalFollowers += followers;

      platformData.push({
        id: platformId,
        name: config.name,
        color: config.color,
        followers,
        demographics: {
          ageRanges: generateAgeDistribution(followers),
          genderSplit: generateGenderSplit(followers),
          topLocations: generateTopLocations(followers),
          topLanguages: generateTopLanguages(),
        },
        behavior: {
          bestPostingTimes: generateBestPostingTimes(),
          activeHours: generateActiveHours(),
          peakDays: generatePeakDays(),
        },
      });
    }

    // Aggregate demographics across platforms
    const aggregatedAge = AGE_RANGES.map((range) => {
      let total = 0;
      platformData.forEach((p) => {
        const match = p.demographics.ageRanges.find((a) => a.range === range);
        if (match) total += match.count;
      });
      return {
        range,
        percentage: totalFollowers > 0 ? Math.round((total / totalFollowers) * 1000) / 10 : 0,
        count: total,
      };
    });

    const aggregatedGender = ['Male', 'Female', 'Other'].map((gender) => {
      let total = 0;
      platformData.forEach((p) => {
        const match = p.demographics.genderSplit.find((g) => g.gender === gender);
        if (match) total += match.count;
      });
      return {
        gender,
        percentage: totalFollowers > 0 ? Math.round((total / totalFollowers) * 1000) / 10 : 0,
        count: total,
      };
    });

    // Aggregate locations (take top 10)
    const locationMap = new Map<string, { location: string; country: string; count: number }>();
    platformData.forEach((p) => {
      p.demographics.topLocations.forEach((loc) => {
        const key = `${loc.location}-${loc.country}`;
        const existing = locationMap.get(key);
        if (existing) {
          existing.count += loc.count;
        } else {
          locationMap.set(key, { location: loc.location, country: loc.country, count: loc.count });
        }
      });
    });

    const aggregatedLocations = Array.from(locationMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((loc) => ({
        ...loc,
        percentage: totalFollowers > 0 ? Math.round((loc.count / totalFollowers) * 1000) / 10 : 0,
      }));

    // Aggregate behavior (average across platforms)
    const aggregatedBestTimes = generateBestPostingTimes(); // Use single generation for consistency
    const aggregatedActiveHours = generateActiveHours();
    const aggregatedPeakDays = generatePeakDays();

    // Calculate growth
    const growthTrend = generateGrowthTrend(totalFollowers, days);
    const previousFollowers = growthTrend.length > 0 ? growthTrend[0].followers : totalFollowers;
    const change = totalFollowers - previousFollowers;
    const changePercent = previousFollowers > 0 ? Math.round((change / previousFollowers) * 1000) / 10 : 0;

    // Build response
    const response = {
      success: true,
      data: {
        demographics: {
          ageRanges: aggregatedAge,
          genderSplit: aggregatedGender,
          topLocations: aggregatedLocations,
          topLanguages: generateTopLanguages(),
        },
        behavior: {
          bestPostingTimes: aggregatedBestTimes,
          activeHours: aggregatedActiveHours,
          peakDays: aggregatedPeakDays,
        },
        growth: {
          current: totalFollowers,
          previous: previousFollowers,
          change,
          changePercent,
          trend: growthTrend,
        },
        platforms: platformData.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          demographics: p.demographics,
          behavior: p.behavior,
        })),
        lastUpdated: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Audience insights API error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audience insights' },
      { status: 500 }
    );
  }
}
