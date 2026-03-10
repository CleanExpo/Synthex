'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ReverenceSidebar, type KeyStat, type CitationFormat } from './ReverenceSidebar';
import { SASScore, SASScoreInline, type ScoreFactor } from './SASScore';

/**
 * Research Report Layout Component
 *
 * Complete layout for Research Report Linkable Assets following the
 * Authority Curator skill specifications:
 *
 * - Semantic HTML5 structure with schema.org markup
 * - "Shocking Hook" H1 display
 * - Executive summary section
 * - Methodology section
 * - Key findings with data tables
 * - Reverence sidebar with key stats
 * - SAS Score display
 * - Sources/references section
 *
 * @module components/research/ResearchReportLayout
 */

export interface Finding {
  /** Finding title/headline */
  title: string;
  /** Key statistic or data point */
  statistic: string;
  /** Source for the finding */
  source: string;
  /** Detailed description */
  description: string;
}

export interface DataTableRow {
  [key: string]: string | number;
}

export interface DataTable {
  /** Table title */
  title: string;
  /** Column headers */
  headers: string[];
  /** Table rows */
  rows: DataTableRow[];
  /** Source attribution */
  source: string;
}

export interface SourceReference {
  /** Reference number */
  number: number;
  /** Full citation text */
  citation: string;
  /** URL if available */
  url?: string;
  /** Last accessed date (DD/MM/YYYY) */
  accessedDate?: string;
}

export interface ResearchReportProps {
  /** Shocking Hook H1 headline */
  headline: string;
  /** Meta information */
  meta: {
    author: string;
    publishDate: string; // DD/MM/YYYY
    lastUpdated?: string; // DD/MM/YYYY
    readTime?: string; // e.g., "8 min read"
  };
  /** Executive summary (50-100 words) */
  executiveSummary: string;
  /** Methodology section content */
  methodology: {
    dataSources: string[];
    sampleSize?: string;
    timePeriod: string;
    limitations?: string[];
  };
  /** Key findings */
  keyFindings: Finding[];
  /** Data tables */
  dataTables?: DataTable[];
  /** Expert commentary (optional) */
  expertCommentary?: {
    expertName: string;
    credentials: string;
    quote: string;
    context?: string;
  };
  /** Recommendations */
  recommendations: string[];
  /** Source references */
  sources: SourceReference[];
  /** Key statistics for sidebar */
  keyStats: KeyStat[];
  /** SAS Score data */
  sasScore: {
    totalScore: number;
    factors: ScoreFactor[];
    lastCalculated: string;
  };
  /** Report metadata for sharing/citations */
  reportMeta: {
    title: string;
    url: string;
    citations: CitationFormat;
    pdfUrl?: string;
    csvUrl?: string;
  };
  /** Additional content sections */
  children?: React.ReactNode;
  /** Additional className */
  className?: string;
}

export function ResearchReportLayout({
  headline,
  meta,
  executiveSummary,
  methodology,
  keyFindings,
  dataTables = [],
  expertCommentary,
  recommendations,
  sources,
  keyStats,
  sasScore,
  reportMeta,
  children,
  className,
}: ResearchReportProps) {
  return (
    <article
      itemScope
      itemType="https://schema.org/Article"
      className={cn('min-h-screen bg-gradient-to-b from-slate-950 to-slate-900', className)}
    >
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          {/* SAS Score Inline */}
          <div className="mb-6">
            <SASScoreInline score={sasScore.totalScore} />
          </div>

          {/* Headline - Shocking Hook H1 */}
          <h1
            itemProp="headline"
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl max-w-4xl"
          >
            {headline}
          </h1>

          {/* Meta */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <span itemProp="author">{meta.author}</span>
            <span className="text-gray-600">•</span>
            <time itemProp="datePublished" dateTime={meta.publishDate}>
              {meta.publishDate}
            </time>
            {meta.readTime && (
              <>
                <span className="text-gray-600">•</span>
                <span>{meta.readTime}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-12">
          {/* Main Article */}
          <main className="prose prose-invert prose-cyan max-w-none">
            {/* Executive Summary */}
            <section className="mb-12 rounded-xl bg-white/5 border border-white/10 p-6">
              <h2 className="mt-0 text-xl font-semibold text-cyan-400">Executive Summary</h2>
              <p itemProp="description" className="text-gray-300 leading-relaxed">
                {executiveSummary}
              </p>
            </section>

            {/* Key Findings */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">Key Findings</h2>
              <ol className="space-y-6 list-none pl-0">
                {keyFindings.map((finding, index) => (
                  <li
                    key={index}
                    className="rounded-xl bg-white/5 border border-white/10 p-6"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-400">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="mt-0 text-lg font-semibold text-white">
                          {finding.title}
                        </h3>
                        <p className="mt-1 text-2xl font-bold text-cyan-400">
                          {finding.statistic}
                        </p>
                        <p className="mt-2 text-gray-300">{finding.description}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          Source: {finding.source}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* Methodology */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">Methodology</h2>
              <div className="rounded-xl bg-white/5 border border-white/10 p-6 space-y-4">
                <div>
                  <h4 className="text-sm font-medium uppercase tracking-wider text-gray-400 mb-2">
                    Data Sources
                  </h4>
                  <ul className="list-disc list-inside text-gray-300 space-y-1">
                    {methodology.dataSources.map((source, index) => (
                      <li key={index}>{source}</li>
                    ))}
                  </ul>
                </div>
                {methodology.sampleSize && (
                  <div>
                    <h4 className="text-sm font-medium uppercase tracking-wider text-gray-400 mb-1">
                      Sample Size
                    </h4>
                    <p className="text-gray-300">{methodology.sampleSize}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium uppercase tracking-wider text-gray-400 mb-1">
                    Time Period
                  </h4>
                  <p className="text-gray-300">{methodology.timePeriod}</p>
                </div>
                {methodology.limitations && methodology.limitations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium uppercase tracking-wider text-gray-400 mb-2">
                      Limitations
                    </h4>
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                      {methodology.limitations.map((limitation, index) => (
                        <li key={index}>{limitation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            {/* Data Tables */}
            {dataTables.map((table, tableIndex) => (
              <section key={tableIndex} className="mb-12">
                <h3 className="text-xl font-semibold text-white mb-4">{table.title}</h3>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left">
                    <thead className="bg-white/5">
                      <tr>
                        {table.headers.map((header, index) => (
                          <th
                            key={index}
                            className="px-4 py-3 text-sm font-medium uppercase tracking-wider text-gray-400"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-white/5">
                          {table.headers.map((header, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-4 py-3 text-gray-300"
                            >
                              {row[header.toLowerCase().replace(/\s+/g, '_')]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-500">Source: {table.source}</p>
              </section>
            ))}

            {/* Expert Commentary */}
            {expertCommentary && (
              <section className="mb-12">
                <h2 className="text-2xl font-semibold text-white mb-4">Expert Commentary</h2>
                <blockquote className="rounded-xl bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 border border-cyan-500/20 p-6">
                  <p className="text-lg italic text-gray-200 mb-4">
                    &ldquo;{expertCommentary.quote}&rdquo;
                  </p>
                  <footer className="text-gray-400">
                    <cite className="not-italic font-medium text-white">
                      {expertCommentary.expertName}
                    </cite>
                    <span className="block text-sm">{expertCommentary.credentials}</span>
                    {expertCommentary.context && (
                      <span className="block text-sm mt-2">{expertCommentary.context}</span>
                    )}
                  </footer>
                </blockquote>
              </section>
            )}

            {/* Recommendations */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">Recommendations</h2>
              <ol className="space-y-4">
                {recommendations.map((recommendation, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-4 rounded-lg bg-white/5 border border-white/10 p-4"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                      {index + 1}
                    </span>
                    <span className="text-gray-300">{recommendation}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Additional Content */}
            {children}

            {/* Sources */}
            <footer className="border-t border-white/10 pt-8">
              <h2 className="text-2xl font-semibold text-white mb-4">Sources</h2>
              <ol className="space-y-3 text-sm">
                {sources.map((source) => (
                  <li key={source.number} className="text-gray-400">
                    <span className="text-gray-500">[{source.number}]</span>{' '}
                    {source.url ? (
                      <a
                        href={source.url}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.citation}
                      </a>
                    ) : (
                      source.citation
                    )}
                    {source.accessedDate && (
                      <span className="text-gray-500"> (Accessed: {source.accessedDate})</span>
                    )}
                  </li>
                ))}
              </ol>

              {/* Last Updated */}
              {meta.lastUpdated && (
                <p className="mt-8 text-xs text-gray-500">
                  Last updated: {meta.lastUpdated}
                </p>
              )}
            </footer>
          </main>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {/* SAS Score */}
              <SASScore
                totalScore={sasScore.totalScore}
                factors={sasScore.factors}
                lastCalculated={sasScore.lastCalculated}
                size="md"
              />

              {/* Reverence Sidebar */}
              <ReverenceSidebar
                keyStats={keyStats}
                citations={reportMeta.citations}
                reportTitle={reportMeta.title}
                reportUrl={reportMeta.url}
                pdfUrl={reportMeta.pdfUrl}
                csvUrl={reportMeta.csvUrl}
              />
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}

export default ResearchReportLayout;
