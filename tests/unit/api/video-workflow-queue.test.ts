/**
 * AT-032 — POST/GET /api/video async workflow production.
 *
 * POST must enqueue and return 202 immediately — it must NOT await
 * orchestrator.produceVideo inline. GET ?jobId= reads job status from lib/queue.
 */

/** @jest-environment node */

const mockCheck = jest.fn();
const mockRequireEntitlement = jest.fn();
const mockQueueWorkflowProduction = jest.fn();
const mockRegisterWorkflowProductionHandler = jest.fn();
const mockGetJob = jest.fn();
const mockRecoverJobs = jest.fn();
const mockCheckReadiness = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
  },
}));

jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: (...a: unknown[]) => mockRequireEntitlement(...a),
}));

jest.mock('@/lib/video/workflow-production-job-handler', () => ({
  queueWorkflowProduction: (...a: unknown[]) =>
    mockQueueWorkflowProduction(...a),
  registerWorkflowProductionHandler: (...a: unknown[]) =>
    mockRegisterWorkflowProductionHandler(...a),
}));

jest.mock('@/lib/queue', () => ({
  getJob: (...a: unknown[]) => mockGetJob(...a),
  recoverJobsFromRedis: (...a: unknown[]) => mockRecoverJobs(...a),
}));

jest.mock('@/lib/video/video-orchestrator', () => ({
  __esModule: true,
  VideoOrchestrator: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { VideoOrchestrator } from '@/lib/video/video-orchestrator';
import { POST, GET } from '@/app/api/video/route';
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const MockVideoOrchestrator = VideoOrchestrator as jest.MockedClass<
  typeof VideoOrchestrator
>;

function postRequest(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'https://synthex.example/api/video',
    body,
  });
}

function getRequest(query = '') {
  return createMockNextRequest({
    url: `https://synthex.example/api/video${query}`,
  });
}

beforeEach(() => {
  // Avoid clearAllMocks — it wipes the module-load register() call history
  // and can leave VideoOrchestrator without an implementation mid-suite.
  mockCheck.mockReset().mockResolvedValue({
    allowed: true,
    context: { userId: 'user-1' },
  });
  mockRequireEntitlement.mockReset().mockResolvedValue({
    allowed: true,
    effectivePlan: 'business',
  });
  mockCheckReadiness.mockReset().mockResolvedValue({ ready: true, issues: [] });
  mockQueueWorkflowProduction.mockReset().mockResolvedValue({
    id: 'job_video_123',
    status: 'pending',
  });
  mockGetJob.mockReset();
  mockRecoverJobs.mockReset();
  MockVideoOrchestrator.mockReset().mockImplementation(
    () =>
      ({
        checkReadiness: (...a: unknown[]) => mockCheckReadiness(...a),
      }) as unknown as InstanceType<typeof VideoOrchestrator>
  );
});

describe('POST /api/video — AT-032 queue contract', () => {
  it('enqueues workflow production and returns 202 without inline capture', async () => {
    const res = await POST(
      postRequest({ workflow: 'platformOverview', skipUpload: false })
    );

    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json).toEqual({
      success: true,
      jobId: 'job_video_123',
      status: 'pending',
      message: 'Video production queued',
    });

    expect(mockQueueWorkflowProduction).toHaveBeenCalledTimes(1);
    expect(mockQueueWorkflowProduction).toHaveBeenCalledWith({
      userId: 'user-1',
      workflow: 'platformOverview',
      skipUpload: false,
    });
  });

  it('503s when the system is not ready and upload is not skipped', async () => {
    mockCheckReadiness.mockResolvedValue({
      ready: false,
      issues: ['YouTube API credentials not configured'],
    });

    const res = await POST(
      postRequest({ workflow: 'platformOverview', skipUpload: false })
    );

    expect(res.status).toBe(503);
    expect(mockQueueWorkflowProduction).not.toHaveBeenCalled();
  });

  it('still enqueues when not fully configured but skipUpload is true', async () => {
    mockCheckReadiness.mockResolvedValue({
      ready: false,
      issues: ['ElevenLabs API key not configured'],
    });

    const res = await POST(
      postRequest({ workflow: 'contentGenerator', skipUpload: true })
    );

    expect(res.status).toBe(202);
    expect(mockQueueWorkflowProduction).toHaveBeenCalledWith({
      userId: 'user-1',
      workflow: 'contentGenerator',
      skipUpload: true,
    });
  });
});

describe('GET /api/video?jobId= — job status', () => {
  it('returns job status for the owning user', async () => {
    mockGetJob.mockReturnValue({
      id: 'job_video_123',
      status: 'completed',
      data: {
        userId: 'user-1',
        workflow: 'platformOverview',
        skipUpload: false,
      },
      createdAt: new Date('2026-08-05T00:00:00.000Z'),
      completedAt: new Date('2026-08-05T00:05:00.000Z'),
      result: {
        success: true,
        production: { workflowName: 'Platform Overview' },
      },
    });

    const res = await GET(getRequest('?jobId=job_video_123'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.job.id).toBe('job_video_123');
    expect(json.job.status).toBe('completed');
    expect(json.job.result).toEqual({
      success: true,
      production: { workflowName: 'Platform Overview' },
    });
  });

  it('404s when the job belongs to another user', async () => {
    mockGetJob.mockReturnValue({
      id: 'job_video_123',
      status: 'pending',
      data: {
        userId: 'other-user',
        workflow: 'platformOverview',
        skipUpload: false,
      },
      createdAt: new Date(),
    });

    const res = await GET(getRequest('?jobId=job_video_123'));
    expect(res.status).toBe(404);
  });
});
