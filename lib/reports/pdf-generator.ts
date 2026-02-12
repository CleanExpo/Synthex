/**
 * PDF Report Generator
 *
 * @description Generates PDF reports from report data:
 * - Supports multiple report types
 * - Custom branding and styling
 * - Charts and visualizations
 * - Server-side PDF generation
 *
 * Uses jsPDF for PDF generation
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// ============================================================================
// TYPES
// ============================================================================

interface ReportData {
  name: string;
  type: string;
  dateRange: { start: string; end: string };
  summary: Record<string, number>;
  byPlatform?: Record<string, Record<string, number>>;
  byDay?: { date: string; metrics: Record<string, number> }[];
  generatedAt: string;
}

interface BrandingConfig {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  companyName?: string;
}

interface PDFOptions {
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  branding?: BrandingConfig;
  includeCharts?: boolean;
}

// Extend jsPDF types for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

/** AutoTable options for PDF table generation */
interface AutoTableOptions {
  startY?: number;
  head?: string[][];
  body?: (string | number)[][];
  theme?: 'striped' | 'grid' | 'plain';
  headStyles?: Record<string, unknown>;
  bodyStyles?: Record<string, unknown>;
  alternateRowStyles?: Record<string, unknown>;
  columnStyles?: Record<string, Record<string, unknown>>;
  margin?: { left?: number; right?: number; top?: number; bottom?: number };
  styles?: Record<string, unknown>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_BRANDING: BrandingConfig = {
  primaryColor: '#00d4ff',
  accentColor: '#a855f7',
  fontFamily: 'helvetica',
  companyName: 'Synthex',
};

const METRIC_LABELS: Record<string, string> = {
  impressions: 'Impressions',
  engagements: 'Engagements',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  saves: 'Saves',
  clicks: 'Clicks',
  followers: 'Followers',
  reach: 'Reach',
  engagement_rate: 'Engagement Rate',
  conversions: 'Conversions',
  revenue: 'Revenue',
  cost: 'Cost',
  roi: 'ROI',
  cpc: 'Cost per Click',
  cpm: 'Cost per 1000 Impressions',
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  facebook: '#4267B2',
  instagram: '#E1306C',
  linkedin: '#0077B5',
  tiktok: '#000000',
  youtube: '#FF0000',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format number for display
 */
function formatNumber(value: number, type?: string): string {
  if (type === 'currency' || type === 'revenue' || type === 'cost') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (type === 'percentage' || type === 'rate' || type?.includes('rate')) {
    return `${(value * 100).toFixed(2)}%`;
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return value.toLocaleString();
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
}

// ============================================================================
// PDF GENERATOR CLASS
// ============================================================================

export class PDFReportGenerator {
  private doc: jsPDF;
  private branding: BrandingConfig;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private currentY: number;

  constructor(options: PDFOptions = {}) {
    this.doc = new jsPDF({
      orientation: options.orientation || 'portrait',
      unit: 'mm',
      format: options.format || 'a4',
    });

    this.branding = { ...DEFAULT_BRANDING, ...options.branding };
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
    this.currentY = this.margin;
  }

  /**
   * Generate PDF from report data
   */
  async generate(data: ReportData): Promise<Buffer> {
    // Header
    this.addHeader(data.name, data.dateRange);

    // Executive Summary
    this.addSection('Executive Summary');
    this.addSummaryMetrics(data.summary);

    // Platform Breakdown (if available)
    if (data.byPlatform && Object.keys(data.byPlatform).length > 0) {
      this.checkPageBreak(60);
      this.addSection('Platform Performance');
      this.addPlatformTable(data.byPlatform);
    }

    // Daily Trends (if available)
    if (data.byDay && data.byDay.length > 0) {
      this.checkPageBreak(80);
      this.addSection('Daily Trends');
      this.addDailyTable(data.byDay);
    }

    // Footer
    this.addFooter(data.generatedAt);

    // Return as Buffer
    return Buffer.from(this.doc.output('arraybuffer'));
  }

  /**
   * Add header with branding
   */
  private addHeader(title: string, dateRange: { start: string; end: string }) {
    const primaryColor = hexToRgb(this.branding.primaryColor || '#00d4ff');

    // Background header bar
    this.doc.setFillColor(15, 15, 15);
    this.doc.rect(0, 0, this.pageWidth, 50, 'F');

    // Gradient accent line
    this.doc.setFillColor(...primaryColor);
    this.doc.rect(0, 50, this.pageWidth, 2, 'F');

    // Company name
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(12);
    this.doc.text(this.branding.companyName || 'Synthex', this.margin, 15);

    // Report title
    this.doc.setFontSize(22);
    this.doc.setFont(this.branding.fontFamily || 'helvetica', 'bold');
    this.doc.text(title, this.margin, 32);

    // Date range
    this.doc.setFontSize(10);
    this.doc.setFont(this.branding.fontFamily || 'helvetica', 'normal');
    this.doc.setTextColor(150, 150, 150);
    this.doc.text(
      `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`,
      this.margin,
      42
    );

    this.currentY = 65;
  }

  /**
   * Add section header
   */
  private addSection(title: string) {
    const primaryColor = hexToRgb(this.branding.primaryColor || '#00d4ff');

    this.doc.setTextColor(...primaryColor);
    this.doc.setFontSize(14);
    this.doc.setFont(this.branding.fontFamily || 'helvetica', 'bold');
    this.doc.text(title, this.margin, this.currentY);

    // Underline
    this.doc.setDrawColor(...primaryColor);
    this.doc.setLineWidth(0.5);
    this.doc.line(
      this.margin,
      this.currentY + 2,
      this.margin + 40,
      this.currentY + 2
    );

    this.currentY += 12;
  }

  /**
   * Add summary metrics as cards
   */
  private addSummaryMetrics(summary: Record<string, number>) {
    const metrics = Object.entries(summary);
    const cardsPerRow = 3;
    const cardWidth = (this.pageWidth - 2 * this.margin - 10 * (cardsPerRow - 1)) / cardsPerRow;
    const cardHeight = 25;

    metrics.forEach(([ key, value], index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      const x = this.margin + col * (cardWidth + 10);
      const y = this.currentY + row * (cardHeight + 8);

      // Card background
      this.doc.setFillColor(30, 30, 30);
      this.doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');

      // Metric label
      this.doc.setTextColor(150, 150, 150);
      this.doc.setFontSize(8);
      this.doc.setFont(this.branding.fontFamily || 'helvetica', 'normal');
      this.doc.text(METRIC_LABELS[key] || key.replace(/_/g, ' ').toUpperCase(), x + 5, y + 8);

      // Metric value
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(14);
      this.doc.setFont(this.branding.fontFamily || 'helvetica', 'bold');
      this.doc.text(formatNumber(value, key), x + 5, y + 18);
    });

    const rows = Math.ceil(metrics.length / cardsPerRow);
    this.currentY += rows * (cardHeight + 8) + 10;
  }

  /**
   * Add platform breakdown table
   */
  private addPlatformTable(byPlatform: Record<string, Record<string, number>>) {
    const platforms = Object.keys(byPlatform);
    const metrics = platforms.length > 0 ? Object.keys(byPlatform[platforms[0]]) : [];

    const headers = ['Platform', ...metrics.map((m) => METRIC_LABELS[m] || m)];
    const rows = platforms.map((platform) => [
      platform.charAt(0).toUpperCase() + platform.slice(1),
      ...metrics.map((m) => formatNumber(byPlatform[platform][m] || 0, m)),
    ]);

    this.doc.autoTable({
      startY: this.currentY,
      head: [headers],
      body: rows,
      theme: 'plain',
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [0, 212, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fillColor: [20, 20, 20],
        textColor: [200, 200, 200],
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [25, 25, 25],
      },
      margin: { left: this.margin, right: this.margin },
    });

    this.currentY = this.doc.lastAutoTable.finalY + 15;
  }

  /**
   * Add daily trends table
   */
  private addDailyTable(byDay: { date: string; metrics: Record<string, number> }[]) {
    if (byDay.length === 0) return;

    const metrics = Object.keys(byDay[0].metrics);
    const headers = ['Date', ...metrics.map((m) => METRIC_LABELS[m] || m)];

    // Limit to last 14 days for readability
    const recentDays = byDay.slice(-14);

    const rows = recentDays.map((day) => [
      formatDate(day.date),
      ...metrics.map((m) => formatNumber(day.metrics[m] || 0, m)),
    ]);

    this.doc.autoTable({
      startY: this.currentY,
      head: [headers],
      body: rows,
      theme: 'plain',
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [0, 212, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fillColor: [20, 20, 20],
        textColor: [200, 200, 200],
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [25, 25, 25],
      },
      margin: { left: this.margin, right: this.margin },
      columnStyles: {
        0: { cellWidth: 25 },
      },
    });

    this.currentY = this.doc.lastAutoTable.finalY + 15;
  }

  /**
   * Add footer
   */
  private addFooter(generatedAt: string) {
    const footerY = this.pageHeight - 15;

    // Footer line
    this.doc.setDrawColor(50, 50, 50);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, footerY - 5, this.pageWidth - this.margin, footerY - 5);

    // Generated timestamp
    this.doc.setTextColor(100, 100, 100);
    this.doc.setFontSize(8);
    this.doc.text(
      `Generated on ${formatDate(generatedAt)} at ${new Date(generatedAt).toLocaleTimeString()}`,
      this.margin,
      footerY
    );

    // Page number
    this.doc.text(
      `Page ${this.doc.internal.pages.length - 1}`,
      this.pageWidth - this.margin - 15,
      footerY
    );

    // Branding
    this.doc.text(
      `Powered by ${this.branding.companyName || 'Synthex'}`,
      this.pageWidth / 2,
      footerY,
      { align: 'center' }
    );
  }

  /**
   * Check if page break is needed
   */
  private checkPageBreak(requiredSpace: number) {
    if (this.currentY + requiredSpace > this.pageHeight - 30) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Generate PDF report
 */
export async function generatePDF(
  data: ReportData,
  options?: PDFOptions
): Promise<Buffer> {
  const generator = new PDFReportGenerator(options);
  return generator.generate(data);
}

/**
 * Generate PDF and return as base64
 */
export async function generatePDFBase64(
  data: ReportData,
  options?: PDFOptions
): Promise<string> {
  const buffer = await generatePDF(data, options);
  return buffer.toString('base64');
}
