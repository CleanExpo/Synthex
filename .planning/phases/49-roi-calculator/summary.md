# Phase 49: ROI Calculator

## Overview
Calculate return on investment for content creation by tracking time and money investments, then comparing against revenue generated.

## Goal
Help creators understand the true value of their content work by measuring ROI per piece of content, per platform, and overall.

## Plans

### 49-01: Investment Model + ROI Service + API + Hook
- Create ContentInvestment Prisma model
- ROI calculation service with formulas
- API routes for investments and ROI reports
- useROI hook

### 49-02: ROI Dashboard UI
- Investment tracking form
- ROI metrics cards
- ROI comparison charts
- Dashboard page + navigation

## Technical Notes

**ContentInvestment Model:**
- userId
- type: 'time' | 'money'
- category: 'creation' | 'equipment' | 'software' | 'promotion' | 'other'
- amount (hours for time, currency amount for money)
- currency (for money investments)
- description
- postId (optional - link to specific content)
- platform (optional)
- investedAt (date)

**ROI Calculations:**
1. **Overall ROI** = (Total Revenue - Total Money Investment) / Total Money Investment * 100
2. **ROI per Hour** = Total Revenue / Total Time Investment
3. **Platform ROI** = Platform Revenue / Platform Investment
4. **Content ROI** = Content Revenue / Content Investment

**Integration with Revenue:**
- Links to RevenueEntry from Phase 48
- Aggregate revenue by platform for comparisons
- Time-based filtering for period analysis

## Dependencies
- Phase 48 (Revenue Tracker) - Complete
- RevenueEntry model and RevenueService
