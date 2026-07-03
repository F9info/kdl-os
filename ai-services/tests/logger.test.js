import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createLogger } from '../src/utils/logger.js';

describe('logger regression — leveled logging (KDL-26 M1)', () => {
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  let stdout = [];
  let stderr = [];

  beforeEach(() => {
    stdout = [];
    stderr = [];
    process.stdout.write = vi.fn((chunk) => {
      stdout.push(chunk);
      return true;
    });
    process.stderr.write = vi.fn((chunk) => {
      stderr.push(chunk);
      return true;
    });
  });

  it('writes info to stdout and error to stderr', () => {
    const logger = createLogger('test');
    logger.info('hello');
    logger.error('boom');

    expect(stdout).toHaveLength(1);
    expect(stdout[0]).toMatch(/\[INFO\] \[test\] hello/);
    expect(stderr).toHaveLength(1);
    expect(stderr[0]).toMatch(/\[ERROR\] \[test\] boom/);
  });

  it('honours LOG_LEVEL threshold', () => {
    const originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'warn';

    vi.resetModules();
    return import('../src/utils/logger.js').then(({ createLogger: create }) => {
      const logger = create('test');
      logger.debug('hidden');
      logger.info('hidden');
      logger.warn('shown');

      expect(stdout).toHaveLength(0);
      expect(stderr).toHaveLength(1);

      process.env.LOG_LEVEL = originalLevel;
    });
  });
});
