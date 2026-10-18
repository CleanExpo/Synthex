/** @jest-environment node */

const mockUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockUserId(...a),
}));

const mockUserFind = jest.fn();
const mockOrgFind = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFind(...a) },
    organization: { findUnique: (...a: unknown[]) => mockOrgFind(...a) },
  },
}));

jest.mock('next/og', () => ({
  ImageResponse: class {
    status = 200;
    constructor(public element: unknown) {}
  },
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/results/testimonial-card/route';

const req = () =>
  new NextRequest('http://localhost/api/results/testimonial-card?quarter=Q1');

beforeEach(() => {
  mockUserId.mockResolvedValue('user-a');
  mockUserFind.mockResolvedValue({ organizationId: 'org-a' });
});

describe('GET /api/results/testimonial-card', () => {
  it('issues a card only from the real organisation row', async () => {
    mockOrgFind.mockResolvedValue({ name: 'Acme Cleaning' });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(mockOrgFind).toHaveBeenCalledWith({
      where: { id: 'org-a' },
      select: { name: true },
    });
    expect(
      JSON.stringify((res as unknown as { element: unknown }).element)
    ).toContain('Acme Cleaning');
  });

  it('404, not a placeholder card, when the organisation row is missing', async () => {
    mockOrgFind.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(404);
  });

  it('503, not a placeholder card, when the organisation read fails', async () => {
    mockOrgFind.mockRejectedValue(new Error('db down'));
    const res = await GET(req());
    expect(res.status).toBe(503);
  });

  it('401 without a session', async () => {
    mockUserId.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockOrgFind).not.toHaveBeenCalled();
  });
});
