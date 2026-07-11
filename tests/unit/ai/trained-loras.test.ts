import {
  TrainedLora,
  TrainedLoraRegistry,
  trainedLoraSchema,
  resolveLora,
  findLorasForVendor,
} from '@/lib/services/ai/image/trained-loras';

describe('trained-loras', () => {
  const fixtureLora1: TrainedLora = {
    id: 'lora-001-active',
    kind: 'style',
    industry: 'carpet-cleaning',
    triggerToken: '<carpet-lora>',
    loraUrl: 'https://private-fal.example.com/v1/loras/lora-001.safetensors',
    configUrl: 'https://private-fal.example.com/v1/loras/lora-001.json',
    trainedAt: '2024-06-15T10:00:00Z',
    steps: 1500,
    learningRate: 0.0001,
    costUsd: 12.5,
    imageCount: 250,
    falRequestId: 'req-train-001',
    status: 'active',
    sourceImages: [
      {
        path: '/reference-library/carpet-cleaning/image-1.jpg',
        sha256: 'hash-1-abc123',
        vendorKey: 'ccw-supplier-a',
      },
      {
        path: '/reference-library/carpet-cleaning/image-2.jpg',
        sha256: 'hash-2-def456',
        vendorKey: 'ccw-supplier-a',
      },
    ],
  };

  const fixtureLora2: TrainedLora = {
    id: 'lora-002-retired',
    kind: 'style',
    industry: 'water-damage',
    triggerToken: '<water-lora>',
    loraUrl: 'https://private-fal.example.com/v1/loras/lora-002.safetensors',
    configUrl: 'https://private-fal.example.com/v1/loras/lora-002.json',
    trainedAt: '2024-05-01T08:00:00Z',
    steps: 1200,
    learningRate: 0.0001,
    costUsd: 10.0,
    imageCount: 180,
    falRequestId: 'req-train-002',
    status: 'retired',
    retiredAt: '2024-07-01T12:00:00Z',
    retiredReason: 'model quality degraded',
    sourceImages: [
      {
        path: '/reference-library/water-damage/image-3.jpg',
        sha256: 'hash-3-ghi789',
        vendorKey: 'ccw-supplier-b',
      },
    ],
  };

  const fixtureRegistry: TrainedLoraRegistry = {
    version: 1,
    loras: [fixtureLora1, fixtureLora2],
  };

  describe('trainedLoraSchema', () => {
    it('accepts a valid TrainedLora', () => {
      const result = trainedLoraSchema.safeParse(fixtureLora1);
      expect(result.success).toBe(true);
    });

    it('rejects an entry missing loraUrl', () => {
      const invalid = { ...fixtureLora1, loraUrl: undefined };
      const result = trainedLoraSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('accepts optional retiredAt/retiredReason for active loras', () => {
      const active = { ...fixtureLora1 };
      const result = trainedLoraSchema.safeParse(active);
      expect(result.success).toBe(true);
    });

    it('accepts retiredAt/retiredReason for retired loras', () => {
      const retired = fixtureLora2;
      const result = trainedLoraSchema.safeParse(retired);
      expect(result.success).toBe(true);
    });
  });

  describe('resolveLora', () => {
    it('returns null on empty registry', () => {
      const result = resolveLora('lora-001-active');
      // Empty registry (or no matching entry) means null
      expect(result).toBeNull();
    });

    it('returns null on unknown id', () => {
      const result = resolveLora('lora-999-nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findLorasForVendor', () => {
    it('finds loras by sourceImages[].vendorKey', () => {
      const result = findLorasForVendor(fixtureRegistry, 'ccw-supplier-a');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lora-001-active');
    });

    it('returns retired entries too (audit sees everything)', () => {
      const result = findLorasForVendor(fixtureRegistry, 'ccw-supplier-b');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lora-002-retired');
      expect(result[0].status).toBe('retired');
    });

    it('returns empty array if no matching vendor', () => {
      const result = findLorasForVendor(fixtureRegistry, 'unknown-vendor');
      expect(result).toHaveLength(0);
    });

    it('returns multiple loras from same vendor', () => {
      const lora3: TrainedLora = {
        ...fixtureLora1,
        id: 'lora-003',
        sourceImages: [
          {
            path: '/reference-library/carpet/image-4.jpg',
            sha256: 'hash-4-jkl012',
            vendorKey: 'ccw-supplier-a',
          },
        ],
      };
      const registry: TrainedLoraRegistry = {
        version: 1,
        loras: [fixtureLora1, lora3],
      };
      const result = findLorasForVendor(registry, 'ccw-supplier-a');
      expect(result).toHaveLength(2);
      expect(result.map(l => l.id)).toContain('lora-001-active');
      expect(result.map(l => l.id)).toContain('lora-003');
    });
  });
});
