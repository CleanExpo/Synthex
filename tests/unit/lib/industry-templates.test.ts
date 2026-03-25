/**
 * Unit Tests for Industry Templates lib
 * lib/content/industry-templates.ts — getTemplatesForIndustry function
 *
 * SYN-446 — Add test coverage for recently added API routes
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockPrisma = {
  industryTemplate: {
    findMany: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// ---------------------------------------------------------------------------
// Import the functions under test AFTER mocks are declared
// ---------------------------------------------------------------------------

import {
  getTemplatesForIndustry,
  INDUSTRIES,
  INDUSTRY_LABELS,
  INDUSTRY_TONES,
} from '@/lib/content/industry-templates';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getTemplatesForIndustry', () => {
  const MOCK_TEMPLATES = [
    {
      id: 'tmpl-1',
      industry: 'trades',
      scenarioName: 'After-job reveal',
      promptTemplate: 'Write a post for {{businessName}}.',
      exampleOutput: 'Great job by {{businessName}}!',
    },
    {
      id: 'tmpl-2',
      industry: 'trades',
      scenarioName: 'Emergency call-out availability',
      promptTemplate: 'Write an emergency post for {{businessName}}.',
      exampleOutput: '24/7 emergency by {{businessName}}!',
    },
  ];

  beforeEach(() => {
    mockPrisma.industryTemplate.findMany.mockResolvedValue(MOCK_TEMPLATES);
  });

  it('calls prisma.industryTemplate.findMany with the given industry', async () => {
    await getTemplatesForIndustry('trades');

    expect(mockPrisma.industryTemplate.findMany).toHaveBeenCalledWith({
      where: { industry: 'trades' },
    });
  });

  it('returns the array of templates returned by prisma', async () => {
    const result = await getTemplatesForIndustry('trades');

    expect(result).toEqual(MOCK_TEMPLATES);
    expect(result).toHaveLength(2);
  });

  it('passes the exact industry string to the query', async () => {
    await getTemplatesForIndustry('cafe');

    expect(mockPrisma.industryTemplate.findMany).toHaveBeenCalledWith({
      where: { industry: 'cafe' },
    });
  });

  it('returns an empty array when prisma returns no results', async () => {
    mockPrisma.industryTemplate.findMany.mockResolvedValue([]);

    const result = await getTemplatesForIndustry('nonexistent');

    expect(result).toEqual([]);
  });

  it('propagates prisma errors to the caller', async () => {
    mockPrisma.industryTemplate.findMany.mockRejectedValue(
      new Error('DB connection failed')
    );

    await expect(getTemplatesForIndustry('trades')).rejects.toThrow(
      'DB connection failed'
    );
  });

  it('works for all supported industry keys', async () => {
    mockPrisma.industryTemplate.findMany.mockResolvedValue([]);

    for (const industry of INDUSTRIES) {
      mockPrisma.industryTemplate.findMany.mockClear();
      await getTemplatesForIndustry(industry);

      expect(mockPrisma.industryTemplate.findMany).toHaveBeenCalledWith({
        where: { industry },
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Constant shape tests (no DB needed)
// ---------------------------------------------------------------------------

describe('INDUSTRIES constant', () => {
  it('contains exactly the expected industry keys', () => {
    expect(INDUSTRIES).toEqual(
      expect.arrayContaining([
        'trades',
        'cafe',
        'salon',
        'gym',
        'clinic',
        'retail',
      ])
    );
    expect(INDUSTRIES).toHaveLength(6);
  });
});

describe('INDUSTRY_LABELS', () => {
  it('has a label for every supported industry', () => {
    for (const industry of INDUSTRIES) {
      expect(INDUSTRY_LABELS).toHaveProperty(industry);
      expect(typeof INDUSTRY_LABELS[industry]).toBe('string');
      expect(INDUSTRY_LABELS[industry].length).toBeGreaterThan(0);
    }
  });
});

describe('INDUSTRY_TONES', () => {
  it('has a tone descriptor for every supported industry', () => {
    for (const industry of INDUSTRIES) {
      expect(INDUSTRY_TONES).toHaveProperty(industry);
      expect(typeof INDUSTRY_TONES[industry]).toBe('string');
      expect(INDUSTRY_TONES[industry].length).toBeGreaterThan(0);
    }
  });
});
