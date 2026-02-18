# Phase 48: Revenue Tracker

## Overview
Track income from multiple creator revenue sources including sponsorships, affiliate commissions, ad revenue, tips/donations, and merchandise sales.

## Goal
Give creators a unified view of their earnings across all monetization channels with trends, breakdowns, and projections.

## Plans

### 48-01: Revenue Model + API + Hook
- Create RevenueEntry Prisma model
- CRUD API routes for revenue entries
- useRevenue hook with filters and aggregations
- Revenue service for calculations

### 48-02: Revenue Dashboard UI
- Revenue overview stats (total, by source, trends)
- Revenue charts (line chart over time, pie by source)
- Revenue entry management (list, add, edit)
- Dashboard page + navigation

## Technical Notes

**RevenueEntry Model:**
- userId (relation to User)
- source: 'sponsorship' | 'affiliate' | 'ads' | 'tips' | 'merchandise' | 'other'
- amount (Decimal for currency precision)
- currency (ISO code, default USD)
- description
- platform (optional - which social platform generated it)
- postId (optional - link to specific content)
- paidAt (when payment was received)
- metadata (JSON for source-specific details)

**Revenue Sources:**
1. Sponsorship - Brand deals, paid partnerships
2. Affiliate - Commission from product links
3. Ads - YouTube AdSense, platform ad revenue
4. Tips - Ko-fi, Buy Me a Coffee, Patreon
5. Merchandise - Product sales
6. Other - Consulting, courses, etc.

## Dependencies
- Phase 47 (Benchmark Reports) - Complete
- Prisma schema access
- Existing dashboard patterns
