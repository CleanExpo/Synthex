/**
 * Data export utilities for CSV, JSON, and PDF
 * Allows users to export their data in various formats
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

/** Cell value in export row */
type CellValue = string | number | boolean | Date | null | undefined;

// Types
interface ExportData {
  headers: string[];
  rows: CellValue[][];
  metadata?: {
    title?: string;
    description?: string;
    generatedAt?: Date;
    filters?: Record<string, unknown>;
  };
}

/** Campaign export data */
interface CampaignExportItem {
  id: string;
  name: string;
  status: string;
  platform: string;
  createdAt: Date | string;
  performance: number | string;
}

/** Analytics export data */
interface AnalyticsExportItem {
  date: Date | string;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  revenue: number;
}

/** Content export data */
interface ContentExportItem {
  id: string;
  title: string;
  type: string;
  status: string;
  author: string;
  createdAt: Date | string;
  views: number;
}

interface ExportOptions {
  filename?: string;
  format: 'csv' | 'json' | 'pdf' | 'excel';
  includeMetadata?: boolean;
  dateFormat?: string;
}

/**
 * Export data to CSV format
 */
export function exportToCSV(data: ExportData, filename = 'export.csv') {
  const { headers, rows } = data;
  
  // Build CSV content
  const csvContent = [
    // Headers
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
    // Data rows
    ...rows.map(row => 
      row.map(cell => {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'string') return `"${cell.replace(/"/g, '""')}"`;
        if (cell instanceof Date) return `"${format(cell, 'yyyy-MM-dd HH:mm:ss')}"`;
        return `"${String(cell)}"`;
      }).join(',')
    )
  ].join('\n');
  
  // Create blob and download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Export data to JSON format
 */
export function exportToJSON(data: ExportData, filename = 'export.json') {
  const { headers, rows, metadata } = data;
  
  // Convert rows to objects
  const jsonData = rows.map(row => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  // Include metadata if requested
  const exportData = metadata ? { metadata, data: jsonData } : jsonData;
  
  // Create blob and download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
    type: 'application/json' 
  });
  downloadBlob(blob, filename);
}

/**
 * Export data to PDF format
 */
export function exportToPDF(data: ExportData, filename = 'export.pdf') {
  const { headers, rows, metadata } = data;
  
  // Create PDF document
  const doc = new jsPDF({
    orientation: headers.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Add metadata
  let yPosition = 20;
  
  if (metadata?.title) {
    doc.setFontSize(18);
    doc.text(metadata.title, 14, yPosition);
    yPosition += 10;
  }
  
  if (metadata?.description) {
    doc.setFontSize(12);
    doc.text(metadata.description, 14, yPosition);
    yPosition += 8;
  }
  
  if (metadata?.generatedAt) {
    doc.setFontSize(10);
    doc.text(`Generated: ${format(metadata.generatedAt, 'PPpp')}`, 14, yPosition);
    yPosition += 8;
  }
  
  // Add table - using type assertion for jspdf-autotable plugin
  (doc as jsPDF & { autoTable: (options: Record<string, unknown>) => void }).autoTable({
    head: [headers],
    body: rows.map(row => 
      row.map(cell => {
        if (cell === null || cell === undefined) return '';
        if (cell instanceof Date) return format(cell, 'yyyy-MM-dd HH:mm');
        return String(cell);
      })
    ),
    startY: yPosition + 5,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    headStyles: {
      fillColor: [139, 92, 246], // Purple color
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 250]
    }
  });
  
  // Add page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 30,
      doc.internal.pageSize.height - 10
    );
  }
  
  // Save PDF
  doc.save(filename);
}

/**
 * Export data to Excel format (CSV as fallback due to xlsx vulnerability)
 * Note: Temporarily using CSV format until xlsx vulnerability is resolved
 */
export async function exportToExcel(data: ExportData, filename = 'export.csv') {
  // Using CSV export as safer alternative to vulnerable xlsx package
  return exportToCSV(data, filename);
  
  /* Original XLSX code - disabled due to security vulnerability
  const XLSX = await import('xlsx');
  
  const { headers, rows, metadata } = data;
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Add metadata sheet if provided
  if (metadata) {
    const metadataSheet = XLSX.utils.json_to_sheet([
      { Property: 'Title', Value: metadata.title || 'N/A' },
      { Property: 'Description', Value: metadata.description || 'N/A' },
      { Property: 'Generated At', Value: metadata.generatedAt ? format(metadata.generatedAt, 'PPpp') : 'N/A' },
      { Property: 'Filters Applied', Value: JSON.stringify(metadata.filters || {}) }
    ]);
    XLSX.utils.book_append_sheet(wb, metadataSheet, 'Metadata');
  }
  
  // Create data sheet
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Auto-size columns
  const colWidths = headers.map((_, colIndex) => {
    const maxLength = Math.max(
      headers[colIndex].length,
      ...rows.map(row => String(row[colIndex] || '').length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  ws['!cols'] = colWidths;
  
  // Add data sheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  
  // Write file
  XLSX.writeFile(wb, filename);
  */
}

/**
 * Universal export function
 */
export async function exportData(
  data: ExportData,
  options: ExportOptions
) {
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
  const defaultFilename = `export-${timestamp}`;
  
  const filename = options.filename || `${defaultFilename}.${options.format}`;
  
  // Add metadata
  const enrichedData = {
    ...data,
    metadata: {
      ...data.metadata,
      generatedAt: new Date()
    }
  };
  
  switch (options.format) {
    case 'csv':
      exportToCSV(enrichedData, filename);
      break;
    case 'json':
      exportToJSON(enrichedData, filename);
      break;
    case 'pdf':
      exportToPDF(enrichedData, filename);
      break;
    case 'excel':
      await exportToExcel(enrichedData, filename);
      break;
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

/**
 * Helper function to download blob
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export component data helpers
 */
export const exportHelpers = {
  // Format data for campaigns
  formatCampaignData: (campaigns: CampaignExportItem[]): ExportData => ({
    headers: ['ID', 'Name', 'Status', 'Platform', 'Created', 'Performance'],
    rows: campaigns.map(c => [
      c.id,
      c.name,
      c.status,
      c.platform,
      c.createdAt,
      c.performance
    ])
  }),

  // Format data for analytics
  formatAnalyticsData: (analytics: AnalyticsExportItem[]): ExportData => ({
    headers: ['Date', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'Revenue'],
    rows: analytics.map(a => [
      a.date,
      a.impressions,
      a.clicks,
      `${a.ctr}%`,
      a.conversions,
      `$${a.revenue}`
    ])
  }),

  // Format data for content
  formatContentData: (content: ContentExportItem[]): ExportData => ({
    headers: ['ID', 'Title', 'Type', 'Status', 'Author', 'Created', 'Views'],
    rows: content.map(c => [
      c.id,
      c.title,
      c.type,
      c.status,
      c.author,
      c.createdAt,
      c.views
    ])
  })
};