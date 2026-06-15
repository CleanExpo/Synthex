// jsPDF ships ESM and cannot load under jest's CJS transform, so we mock the
// (production-proven) PDF generator and assert our packaging: branch selection,
// base64 encoding, filename, content-type, and the name/type adapter mapping.
import { buildReportAttachments } from '@/lib/reports/report-attachments';
import { generatePDF } from '@/lib/reports/pdf-generator';

jest.mock('@/lib/reports/pdf-generator', () => ({
  __esModule: true,
  generatePDF: jest.fn(),
}));

const mockGeneratePDF = generatePDF as jest.MockedFunction<typeof generatePDF>;

beforeEach(() => {
  mockGeneratePDF.mockResolvedValue(Buffer.from('%PDF-1.4\n%mock-pdf-bytes'));
});

const SAMPLE = {
  summary: { impressions: 1200, engagements: 90 },
  byPlatform: { instagram: { impressions: 1200, engagements: 90 } },
  byDay: [{ date: '2026-06-01', metrics: { impressions: 1200, engagements: 90 } }],
  dateRange: { start: '2026-06-01', end: '2026-06-07' },
  generatedAt: '2026-06-07T00:00:00.000Z',
};

describe('buildReportAttachments', () => {
  it('produces a real PDF attachment for format "pdf"', async () => {
    const attachments = await buildReportAttachments(
      'Weekly Performance',
      'overview',
      SAMPLE,
      'pdf'
    );
    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe('Weekly_Performance.pdf');
    expect(attachments[0].contentType).toBe('application/pdf');
    // base64 content must decode to bytes starting with the PDF magic header "%PDF"
    const decoded = Buffer.from(attachments[0].content, 'base64');
    expect(decoded.subarray(0, 4).toString('latin1')).toBe('%PDF');
    // adapter passes name + type through to the generator
    expect(mockGeneratePDF).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Weekly Performance', type: 'overview' })
    );
  });

  it('produces a CSV attachment for format "csv"', async () => {
    const attachments = await buildReportAttachments(
      'Weekly Performance',
      'overview',
      SAMPLE,
      'csv'
    );
    expect(attachments[0].filename).toBe('Weekly_Performance.csv');
    expect(attachments[0].contentType).toBe('text/csv');
    const csv = Buffer.from(attachments[0].content, 'base64').toString('utf8');
    expect(csv).toContain('Metric,Value');
    expect(csv).toContain('impressions,1200');
    expect(csv).toContain('2026-06-01');
  });

  it('falls back to JSON for unknown formats', async () => {
    const attachments = await buildReportAttachments('R', 'overview', SAMPLE, 'json');
    expect(attachments[0].filename).toBe('R.json');
    expect(attachments[0].contentType).toBe('application/json');
  });
});
