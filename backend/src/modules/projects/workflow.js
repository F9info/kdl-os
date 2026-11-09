// T12: progress of the guided project workflow, kept in projects.config.workflow as { <step>: { at: ISO } }
// (a step key present = done). A dedicated merge-only write: updateProject replaces all of `config`, so using it
// for a tick would erase every other config key (and two quick ticks would overwrite each other).
import { prisma } from '../../config/database.js';

// Order = the order shown in the stepper. The frontend keeps the same keys (admin/lib/project-workflow.ts).
export const WORKFLOW_STEPS = [
  'setup', 'theme', 'homepage', 'navigation', 'footer', 'pages',
  'sections', 'layout', 'content', 'preview', 'launch',
];

/** Mark a step done or not done. One SQL statement, so concurrent ticks never lose each other. */
export async function setWorkflowStep(projectId, step, done, client = prisma) {
  if (!WORKFLOW_STEPS.includes(step)) throw Object.assign(new Error('Unknown workflow step'), { status: 400 });
  const path = ['workflow', step];
  const rows = done
    ? await client.$queryRaw`
        UPDATE projects
        SET config = jsonb_set(
          jsonb_set(config, '{workflow}', COALESCE(config->'workflow', '{}'::jsonb), true),
          ${path}::text[], jsonb_build_object('at', ${new Date().toISOString()}::text), true)
        WHERE id = ${projectId} AND deleted_at IS NULL
        RETURNING config`
    : await client.$queryRaw`
        UPDATE projects SET config = config #- ${path}::text[]
        WHERE id = ${projectId} AND deleted_at IS NULL
        RETURNING config`;
  if (!rows.length) throw Object.assign(new Error('Project not found'), { status: 404 });
  return rows[0].config?.workflow ?? {};
}
