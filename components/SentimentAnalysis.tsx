// components/SentimentAnalysis.tsx — NOW A RE-EXPORT
// Original monolithic component (744 lines) has been decomposed into:
//   components/sentiment-analysis/types.ts        — Interfaces + API response types
//   components/sentiment-analysis/helpers.ts       — Sentiment/priority color/icon helpers
//   components/sentiment-analysis/OverviewTab.tsx  — Trend chart + emotion breakdown
//   components/sentiment-analysis/TopicsTab.tsx    — Topic sentiment list
//   components/sentiment-analysis/MentionsTab.tsx  — Recent mentions cards
//   components/sentiment-analysis/AnalyzerTab.tsx  — Real-time text analyzer
//   components/sentiment-analysis/index.tsx        — Main composition (state, API, score card)

export { SentimentAnalysis } from './sentiment-analysis';
