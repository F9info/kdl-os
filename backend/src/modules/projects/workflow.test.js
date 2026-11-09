import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
const { setWorkflowStep, WORKFLOW_STEPS } = await import('./workflow.js');
const { workflowStepSchema } = await import('./schema.js');

const client = (rows) => ({ $queryRaw: vi.fn(async () => rows) });

describe('project workflow (T12)', () => {
  it('has the eleven steps in the vision order', () => {
    expect(WORKFLOW_STEPS).toEqual(['setup', 'theme', 'homepage', 'navigation', 'footer', 'pages', 'sections', 'layout', 'content', 'preview', 'launch']);
  });

  it('returns the project workflow after a tick, for both done and not done', async () => {
    const c = client([{ config: { other: 1, workflow: { theme: { at: 'x' } } } }]);
    expect(await setWorkflowStep('p1', 'theme', true, c)).toEqual({ theme: { at: 'x' } });
    expect(await setWorkflowStep('p1', 'theme', false, c)).toEqual({ theme: { at: 'x' } });
    expect(c.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('is a 404 for a missing or deleted project and a 400 for an unknown step', async () => {
    await expect(setWorkflowStep('nope', 'theme', true, client([]))).rejects.toMatchObject({ status: 404 });
    await expect(setWorkflowStep('p1', 'bogus', true, client([{}]))).rejects.toMatchObject({ status: 400 });
  });

  it('the request schema only accepts a known step and a boolean', () => {
    const ok = { params: { id: 'p1' }, body: { step: 'footer', done: true } };
    expect(workflowStepSchema.safeParse(ok).success).toBe(true);
    expect(workflowStepSchema.safeParse({ ...ok, body: { step: 'x', done: true } }).success).toBe(false);
    expect(workflowStepSchema.safeParse({ ...ok, body: { step: 'footer', done: 'yes' } }).success).toBe(false);
  });
});
