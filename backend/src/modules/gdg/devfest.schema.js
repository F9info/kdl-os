import { z } from 'zod';

// Request schemas for DevFest editions and their speakers, sessions, sponsors and team.

const optionalText = (max) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v ? v.trim() || null : null));

const optionalUrl = z
  .string()
  .max(1000)
  .nullish()
  .transform((v) => (v ? v.trim() || null : null))
  .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v) || v.startsWith('/'), 'Use a full http(s) link or a site path');

// '' and null clear the date (z.coerce.date would turn null into 1 January 1970).
const optionalDate = z.preprocess((v) => (v === '' || v === null ? null : v), z.coerce.date().nullable()).optional();

const slug = z
  .string()
  .trim()
  .max(120)
  .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, 'Lowercase letters, numbers and dashes only')
  .optional();

export const SESSION_KINDS = ['talk', 'keynote', 'workshop', 'panel', 'break'];
export const SPONSOR_TIERS = ['title', 'gold', 'silver', 'community', 'partner'];
export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const idParams = z.object({ id: z.string().min(1) });
const project = { project_id: z.string().min(1).optional() };

const editionFields = {
  ...project,
  year: z.coerce.number().int().min(2000).max(2100),
  name: z.string().trim().min(2).max(200),
  theme: optionalText(300),
  start_date: optionalDate,
  end_date: optionalDate,
  venue: optionalText(300),
  venue_address: optionalText(500),
  map_url: optionalUrl,
  ticket_url: optionalUrl,
  cfp_url: optionalUrl,
  cfp_closes: optionalDate,
  cfp_open: z.boolean().default(false),
  tracks: z
    .array(z.object({ name: z.string().trim().min(1).max(60), color: z.string().trim().max(20).default('') }))
    .max(20)
    .default([]),
  stats: z
    .array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(20) }))
    .max(8)
    .default([]),
  is_current: z.boolean().default(false),
};

const speakerFields = {
  ...project,
  edition_id: z.string().min(1),
  slug,
  name: z.string().trim().min(2).max(120),
  photo_url: optionalUrl,
  role: optionalText(200),
  company: optionalText(200),
  bio: optionalText(3000),
  links: z
    .record(z.string().trim().min(1).max(40), z.string().trim().url().max(500))
    .refine((o) => Object.keys(o).length <= 8, 'At most 8 links')
    .default({}),
  badges: z.array(z.string().trim().min(1).max(40)).max(6).default([]),
  is_featured: z.boolean().default(false),
  is_visible: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(10_000).default(0),
};

const sessionFields = {
  ...project,
  edition_id: z.string().min(1),
  slug,
  title: z.string().trim().min(2).max(200),
  abstract: optionalText(4000),
  kind: z.enum(SESSION_KINDS).default('talk'),
  track: optionalText(60),
  level: z.enum(LEVELS).nullish(),
  room: optionalText(80),
  starts_at: optionalDate,
  ends_at: optionalDate,
  speaker_ids: z.array(z.string().min(1)).max(10).default([]),
  slides_url: optionalUrl,
  video_url: optionalUrl,
  is_visible: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(10_000).default(0),
};

const sponsorFields = {
  ...project,
  edition_id: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  logo_url: optionalUrl,
  tier: z.enum(SPONSOR_TIERS).default('partner'),
  url: optionalUrl,
  is_visible: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(10_000).default(0),
};

const teamFields = {
  ...project,
  edition_id: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  role: optionalText(120),
  photo_url: optionalUrl,
  url: optionalUrl,
  is_visible: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(10_000).default(0),
};

const endAfterStart = (a, b) => (v) => !v[a] || !v[b] || v[b] >= v[a];

/** create / update / get / delete / list schemas for one kind of record. */
function crud(fields, { list = {}, refine } = {}) {
  const create = refine ? z.object(fields).refine(...refine) : z.object(fields);
  // An update may not move a row to another edition or project.
  const { project_id: _p, edition_id: _e, ...editable } = fields;
  return {
    list: z.object({ query: z.object({ ...project, ...list }) }),
    get: z.object({ params: idParams }),
    create: z.object({ body: create }),
    update: z.object({ params: idParams, body: z.object(editable).partial() }),
    remove: z.object({ params: idParams }),
  };
}

const byEdition = { edition_id: z.string().min(1) };

export const editionSchemas = crud(editionFields, {
  refine: [endAfterStart('start_date', 'end_date'), { message: 'The end must be after the start', path: ['end_date'] }],
});
export const speakerSchemas = crud(speakerFields, { list: byEdition });
export const sessionSchemas = crud(sessionFields, {
  list: byEdition,
  refine: [endAfterStart('starts_at', 'ends_at'), { message: 'The end must be after the start', path: ['ends_at'] }],
});
export const sponsorSchemas = crud(sponsorFields, { list: byEdition });
export const teamSchemas = crud(teamFields, { list: byEdition });

export const publicDevfestSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
});

// ─── Call for speakers ───────────────────────────────────────────────────────

export const PROPOSAL_FORMATS = ['talk', 'workshop', 'lightning', 'panel'];
export const PROPOSAL_STATUSES = ['new', 'shortlisted', 'waitlist', 'accepted', 'rejected'];

const httpUrl = z
  .string()
  .max(500)
  .nullish()
  .transform((v) => (v ? v.trim() || null : null))
  .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), 'Use a full link starting with https://');

/** What a visitor sends from the call for speakers form. `company_site` is a hidden trap field for bots. */
export const publicProposalSchema = z.object({
  body: z.object({
    project_id: z.string().min(1).optional(),
    name: z.string().trim().min(2, 'Add your name').max(120),
    email: z.string().trim().toLowerCase().email('Add a valid email').max(254),
    phone: optionalText(40),
    city: optionalText(80),
    role: optionalText(120),
    company: optionalText(120),
    bio: z.string().trim().min(30, 'Tell us a little more about you (30+ characters)').max(1500),
    linkedin: httpUrl,
    website: httpUrl,
    title: z.string().trim().min(5, 'Add a talk title').max(150),
    abstract: z.string().trim().min(80, 'Describe the talk in a few sentences (80+ characters)').max(3000),
    format: z.enum(PROPOSAL_FORMATS).default('talk'),
    track: optionalText(60),
    level: z.enum(LEVELS).nullish(),
    notes: optionalText(1000),
    first_time: z.boolean().default(false),
    consent: z.literal(true, { errorMap: () => ({ message: 'Please agree so we can contact you' }) }),
    company_site: z.string().max(200).optional(),
  }),
});

/** A stored DevFest image, e.g. 0b1c…e9.jpg. */
export const imageParamSchema = z.object({
  params: z.object({ name: z.string().regex(/^[a-f0-9-]{36}\.(jpg|png|webp)$/) }),
});

export const proposalSchemas = {
  list: z.object({
    query: z.object({ ...project, edition_id: z.string().min(1), status: z.enum(PROPOSAL_STATUSES).optional() }),
  }),
  get: z.object({ params: idParams }),
  update: z.object({
    params: idParams,
    body: z
      .object({ status: z.enum(PROPOSAL_STATUSES), review_note: optionalText(2000) })
      .partial()
      .refine((b) => Object.keys(b).length > 0, 'Nothing to change'),
  }),
  remove: z.object({ params: idParams }),
  accept: z.object({ params: idParams }),
};
