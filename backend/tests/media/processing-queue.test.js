import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1', name: 'test-job', data: {} }),
    getJob: vi.fn().mockResolvedValue({ id: 'job-1', name: 'test-job', data: {} }),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('../../src/config/redis.js', () => ({ redis: {} }));
vi.mock('../../src/shared/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { Worker } from 'bullmq';
import {
  processingQueue,
  startProcessingWorker,
  closeProcessingWorker,
  enqueueProcessingJob,
} from '../../src/modules/media/processing.queue.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('C1 Processing queue worker lifecycle', () => {
  it('startProcessingWorker returns a Worker instance', () => {
    const worker = startProcessingWorker();
    expect(worker).toBeDefined();
    expect(Worker).toHaveBeenCalledWith(
      'media-processing',
      expect.any(Function),
      expect.objectContaining({ concurrency: 2 }),
    );
  });

  it('closeProcessingWorker resolves without throwing', async () => {
    startProcessingWorker();
    await expect(closeProcessingWorker()).resolves.toBeUndefined();
  });

  it('enqueueProcessingJob delegates to processingQueue.add and returns the job', async () => {
    const job = await enqueueProcessingJob('image-edit', { mediaId: 'm1' });
    expect(processingQueue.add).toHaveBeenCalledWith(
      'image-edit',
      { mediaId: 'm1' },
      expect.any(Object),
    );
    expect(job).toMatchObject({ id: 'job-1' });
  });

  it('processingQueue.getJob retrieves a job by id', async () => {
    const job = await processingQueue.getJob('job-1');
    expect(job).toMatchObject({ id: 'job-1', name: 'test-job' });
  });
});
