/**
 * Contract tests for workflow templates API routes
 * Validates request/response shapes, auth guards, and org-scoping
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    workflowTemplate: { findMany: jest.fn(), create: jest.fn() },
  },
}))
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: jest.fn() },
  DEFAULT_POLICIES: { AUTHENTICATED_READ: 'read', AUTHENTICATED_WRITE: 'write' },
}))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

import { APISecurityChecker } from '@/lib/security/api-security-checker'
import { prisma } from '@/lib/prisma'

const mockSecurityAllowed = { allowed: true, context: { userId: 'user-123' } }
const mockUser = { organizationId: 'org-456' }
const mockTemplate = { id: 'tmpl-001', organizationId: 'org-456', name: 'Content Pipeline', steps: [] }

/**
 * Create a mock request object compatible with Next.js route handlers.
 * Uses a plain object to avoid NextRequest polyfill issues in Jest.
 */
function createMockRequest(opts: {
  method?: string
  body?: object
  url?: string
} = {}) {
  const { method = 'GET', body, url = 'http://localhost/api/workflows/templates' } = opts
  const parsedUrl = new URL(url)
  const bodyString = body ? JSON.stringify(body) : undefined
  return {
    url,
    method,
    headers: {
      get: (name: string) => name === 'content-type' ? 'application/json' : null,
      has: () => false,
    },
    nextUrl: parsedUrl,
    json: async () => (bodyString ? JSON.parse(bodyString) : {}),
    text: async () => bodyString ?? '',
    ip: '127.0.0.1',
    geo: {},
    cookies: { get: () => undefined, getAll: () => [], has: () => false },
  } as any  
}

describe('GET /api/workflows/templates', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue({ allowed: false, context: {} })
    const { GET } = await import('@/app/api/workflows/templates/route')
    const req = createMockRequest()
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns org-scoped templates', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityAllowed)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    ;(prisma.workflowTemplate.findMany as jest.Mock).mockResolvedValue([mockTemplate])
    const { GET } = await import('@/app/api/workflows/templates/route')
    const req = createMockRequest()
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.templates).toHaveLength(1)
  })
})

describe('POST /api/workflows/templates', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates template and returns 201', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityAllowed)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    ;(prisma.workflowTemplate.create as jest.Mock).mockResolvedValue(mockTemplate)
    const { POST } = await import('@/app/api/workflows/templates/route')
    const req = createMockRequest({
      method: 'POST',
      body: { name: 'Content Pipeline', steps: [{ name: 'Generate', type: 'ai' }] },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing name', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityAllowed)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    const { POST } = await import('@/app/api/workflows/templates/route')
    const req = createMockRequest({
      method: 'POST',
      body: { steps: [{ name: 'Generate', type: 'ai' }] },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
