/**
 * Mock for bullmq ESM module
 * Jest can't transform bullmq's TypeScript source, so we provide a minimal mock.
 */

const mockQueue = jest.fn().mockImplementation(() => ({
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  getJob: jest.fn().mockResolvedValue(null),
  getJobs: jest.fn().mockResolvedValue([]),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
}));

const mockWorker = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
}));

const mockFlowProducer = jest.fn().mockImplementation(() => ({
  add: jest.fn().mockResolvedValue({ job: { id: 'mock-flow-job-id' } }),
  close: jest.fn().mockResolvedValue(undefined),
}));

const mockJob = {
  fromId: jest.fn().mockResolvedValue(null),
};

module.exports = {
  Queue: mockQueue,
  Worker: mockWorker,
  FlowProducer: mockFlowProducer,
  Job: mockJob,
  QueueEvents: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
};
