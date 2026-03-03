/**
 * Contract tests for workflow execution API routes
 * Validates request/response shapes, auth guards, and org-scoping
 */

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    workflowExecution: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    stepExecution: { findFirst: jest.fn() },
  },
}))

// Mock APISecurityChecker
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: jest.fn(),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: 'read',
    AUTHENTICATED_WRITE: 'write',
  },
}))

// Mock bull-queue
jest.mock('@/lib/queue/bull-queue', () => ({
  enqueueWorkflowStep: jest.fn().mockResolvedValue({}),
}))

// Mock orchestrator
jest.mock('@/lib/workflow/orchestrator', () => ({
  approveCurrentStep: jest.fn(),
  cancelExecution: jest.fn(),
}))

import { APISecurityChecker } from '@/lib/security/api-security-checker'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

const mockSecurityAllowed = {
  allowed: true,
  context: { userId: 'user-123' },
}
const mockSecurityDenied = {
  allowed: false,
  context: {},
}

const mockUser = { organizationId: 'org-456' }
const mockExecution = {
  id: 'exec-789',
  organizationId: 'org-456',
  title: 'Test Workflow',
  status: 'pending',
  currentStepIndex: 0,
  totalSteps: 2,
  createdAt: new Date(),
}

describe('GET /api/workflows/executions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityDenied)
    const { GET } = await import('@/app/api/workflows/executions/route')
    const req = new NextRequest('http://localhost/api/workflows/executions')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no organisation', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityAllowed)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ organizationId: null })
    const { GET } = await import('@/app/api/workflows/executions/route')
    const req = new NextRequest('http://localhost/api/workflows/executions')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns org-scoped executions', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityAllowed)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    ;(prisma.workflowExecution.findMany as jest.Mock).mockResolvedValue([mockExecution])
    const { GET } = await import('@/app/api/workflows/executions/route')
    const req = new NextRequest('http://localhost/api/workflows/executions')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.executions).toHaveLength(1)
    expect(json.executions[0].id).toBe('exec-789')
  })
})

describe('POST /api/workflows/executions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityDenied)
    const { POST } = await import('@/app/api/workflows/executions/route')
    const req = new NextRequest('http://localhost/api/workflows/executions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', steps: [{ name: 'Step 1', type: 'ai' }] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body (missing title)', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityAllowed)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    const { POST } = await import('@/app/api/workflows/executions/route')
    const req = new NextRequest('http://localhost/api/workflows/executions', {
      method: 'POST',
      body: JSON.stringify({ steps: [{ name: 'Step 1', type: 'ai' }] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates execution and returns 201', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityAllowed)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    ;(prisma.workflowExecution.create as jest.Mock).mockResolvedValue(mockExecution)
    const { POST } = await import('@/app/api/workflows/executions/route')
    const req = new NextRequest('http://localhost/api/workflows/executions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', steps: [{ name: 'Step 1', type: 'ai' }] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.execution.id).toBe('exec-789')
  })
})
