// T12: the guided workflow's eleven steps, in the order a website is built. Each step opens an existing
// screen; progress is stored per project in `config.workflow` (backend/src/modules/projects/workflow.js,
// same keys, same order).

export interface WorkflowStep {
  key: string
  title: string
  help: string
  href: (projectId: string) => string
  cta: string
}

const web = (id: string) => `/admin/template-engine/projects/${id}/website`

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    key: 'setup',
    title: 'Project setup',
    help: 'Company name, logo and contact details.',
    href: () => '/admin/settings/identity',
    cta: 'Open Identity',
  },
  {
    key: 'theme',
    title: 'Theme',
    help: 'Colours, fonts, buttons and form fields.',
    href: () => '/admin/theme-engine',
    cta: 'Open Themes',
  },
  {
    key: 'homepage',
    title: 'Homepage',
    help: 'Build the home page of the website.',
    href: web,
    cta: 'Open website builder',
  },
  {
    key: 'navigation',
    title: 'Header and navigation',
    help: 'The top bar, header and menu links.',
    href: () => '/admin/menus',
    cta: 'Open Navigation',
  },
  {
    key: 'footer',
    title: 'Footer',
    help: 'The footer design and its links.',
    href: (id) => `${web(id)}/layout`,
    cta: 'Open Layout',
  },
  {
    key: 'pages',
    title: 'Pages',
    help: 'Add, edit and duplicate the pages of the site.',
    href: () => '/admin/pages',
    cta: 'Open Pages',
  },
  {
    key: 'sections',
    title: 'Section builder',
    help: 'Reusable sections you can drop on any page.',
    href: () => '/admin/page-builder/section-builder',
    cta: 'Open Sections',
  },
  {
    key: 'layout',
    title: 'Layout',
    help: 'The header and footer shared by every page.',
    href: () => '/admin/layouts',
    cta: 'Open Layouts',
  },
  {
    key: 'content',
    title: 'Content',
    help: 'Words and pictures: FAQ, team, gallery and more.',
    href: () => '/admin/brands',
    cta: 'Open Content',
  },
  {
    key: 'preview',
    title: 'Preview',
    help: 'Look at the site on desktop, tablet and phone.',
    href: web,
    cta: 'Open preview',
  },
  {
    key: 'launch',
    title: 'Launch',
    help: 'Check every page, then publish the whole site.',
    href: () => '/admin/static-website',
    cta: 'Open Launch',
  },
]

export type WorkflowState = Record<string, { at?: string } | undefined>

/** The saved progress of a project (`config.workflow`), tolerant of a missing or malformed value. */
export function readWorkflow(config: Record<string, unknown> | undefined | null): WorkflowState {
  const w = config?.workflow
  return w && typeof w === 'object' && !Array.isArray(w) ? (w as WorkflowState) : {}
}

/** How many steps are done, and the first one that is not (null when all are). */
export function workflowProgress(state: WorkflowState) {
  const done = WORKFLOW_STEPS.filter((s) => state[s.key]).length
  return {
    done,
    total: WORKFLOW_STEPS.length,
    next: WORKFLOW_STEPS.find((s) => !state[s.key]) ?? null,
  }
}
