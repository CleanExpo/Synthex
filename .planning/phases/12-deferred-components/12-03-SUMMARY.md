---
phase: 12-deferred-components
plan: 03
status: complete
subsystem: components
tags: [analytics-components, api-wiring, mock-removal]
key-files: [components/PredictiveAnalytics.tsx, components/CompetitorAnalysis.tsx, components/ROICalculator.tsx]
affects: [12-04-rate-limiters]
---

# Plan 12-03 Summary: Wire Analytics Components

## Completed

Successfully wired 3 analytics components from mock data to real API endpoints.

### Task 1: PredictiveAnalytics

**Before:** Used setTimeout, Math.random, and 4 mock generator functions (generatePredictions, generateTimeSeriesData, generateScenarios, generateAnomalies)
**After:** Calls real API endpoints in parallel

**API Endpoints Used:**
- GET `/api/analytics/insights` - Trends and anomaly detection
- GET `/api/analytics/predict-engagement` - Predictions with accuracy stats
- GET `/api/predict/trends` - Trending data for scenarios

**Changes:**
- Replaced setTimeout with async/await fetch calls
- Removed 4 mock generator functions (~200 lines)
- Added proper error handling with try/catch
- Transforms API responses to component's Prediction, TimeSeriesData, Scenario, Anomaly interfaces

**Commit:** `981f27b` — feat(12-03): wire PredictiveAnalytics to real API

### Task 2: CompetitorAnalysis

**Before:** Used hardcoded mockCompetitors array (~130 lines), setTimeout for addCompetitor
**After:** Calls real API endpoints

**API Endpoints Used:**
- GET `/api/competitors/track` - List tracked competitors
- GET `/api/intelligence/competitors` - Competitive intelligence data
- POST `/api/competitors/track` - Add new competitor

**Changes:**
- Replaced hardcoded mockCompetitors with fetch to real endpoints
- Replaced setTimeout in addCompetitor with real POST request
- Added helper functions: determineSizeFromFollowers, buildSocialProfiles
- Transforms API responses to component's Competitor interface

**Commit:** `36e6784` — feat(12-03): wire CompetitorAnalysis to real API

### Task 3: ROICalculator

**Before:** Used hardcoded mock campaigns/channels/funnel data (~75 lines), Math.random for roiTrendData
**After:** Calls real API endpoints

**API Endpoints Used:**
- GET `/api/campaigns` - Campaign list with post metrics
- GET `/api/analytics/performance` - Channel performance and timeline
- GET `/api/stats` - Statistics for funnel estimation

**Changes:**
- Replaced loadCampaignData mock data with fetch to 3 endpoints
- Added roiTrendData state, populated from performance timeline
- Removed Math.random from chart data
- Transforms API responses to Campaign, ChannelPerformance, FunnelStage interfaces

**Commit:** `c87757b` — feat(12-03): wire ROICalculator to real API

## Metrics

| Component | Mock Functions/Data Removed | Lines Removed | Lines Added |
|-----------|----------------------------|---------------|-------------|
| PredictiveAnalytics | 4 generator functions | 209 | 180 |
| CompetitorAnalysis | 1 mock array, 1 setTimeout | 143 | 233 |
| ROICalculator | 3 mock arrays, Math.random | 78 | 173 |
| **Total** | **8** | **430** | **586** |

## Verification

- [x] PredictiveAnalytics: No mock/Math.random/setTimeout patterns
- [x] CompetitorAnalysis: No mock/Math.random/setTimeout patterns
- [x] ROICalculator: No mock/Math.random/setTimeout patterns
- [x] All 3 components have fetch calls to real API endpoints
- [x] `npm run type-check` — no new errors in modified files

## Next Steps

Continue with Plan 12-04: Consolidate rate limiters into lib/rate-limit/
