// Reads a chapter's events, organizers and member count from gdg.community.dev (the JSON API the
// chapter page itself uses). Pure functions plus one injectable fetcher, so tests never touch the network.

export const GDG_API = 'https://gdg.community.dev/api';
const FIELDS =
  'id,title,start_date,end_date,venue_name,event_type_title,cropped_picture_url,cropped_banner_url,url,cohost_registration_url,description_short,tags';
const TIMEOUT_MS = 20_000;

// Event categories worked out from the title, first match wins (same rules as the GDG Vizag site).
export const CATEGORY_RULES = [
  ['DevFest', /dev ?fest|developers fest/i],
  ['Women Techmakers', /women|wtm|iwd/i],
  ['I/O Extended', /i\/?o extended|google i\/o/i],
  [
    'Study Jams',
    /study jam|compose camp|flutter forward|flutter interact|android study|cloud study|onboard|summit/i,
  ],
  ['Build with AI', /build ?with ?ai|buildathon|prompt to product|agentic|google cloud ai|ready, set, ml|\bai\b/i],
  ['Workshops and talks', /workshop|hands-on|session|talk|open.?source|jax|zero to hero|lab|wonder of wonders|startup|silicon/i],
];
export const CATEGORY_NAMES = [...CATEGORY_RULES.map(([name]) => name), 'Meetups'];

export function categoryOf(title) {
  for (const [name, re] of CATEGORY_RULES) if (re.test(title ?? '')) return name;
  return 'Meetups';
}

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/** One gdg.community.dev event row -> the fields a ChapterEvent stores (minus project and admin-only fields). */
export function normalizeEvent(row) {
  const venue = row.venue_name && row.venue_name !== '.' ? clean(row.venue_name.replace(/\s+,/g, ',')) : null;
  return {
    source: 'gdg',
    source_id: String(row.id),
    title: clean(row.title),
    start_date: new Date(row.start_date),
    end_date: row.end_date ? new Date(row.end_date) : null,
    venue: venue || null,
    event_type: row.event_type_title || null,
    image_url: row.cropped_picture_url || null,
    banner_url: row.cropped_banner_url || null,
    register_url: row.cohost_registration_url || row.url || null,
    page_url: row.url || null,
    description: clean(row.description_short).slice(0, 2000) || null,
    tags: Array.isArray(row.tags) ? row.tags.map(String).slice(0, 50) : [],
  };
}

export function normalizeTeam(rows) {
  return (Array.isArray(rows) ? rows : []).map((m) => ({
    name: clean(`${m?.user?.first_name ?? ''} ${m?.user?.last_name ?? ''}`),
    title: m?.title ?? '',
    avatar: m?.user?.avatar?.url ?? '',
  }));
}

async function defaultFetchJson(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'KDL-OS events sync' },
    });
    if (!res.ok) throw new Error(`gdg.community.dev answered HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Everything one sync needs: { events, team, chapter: { members_count, logo_url } }.
 * Throws when the events cannot be read; the team and chapter facts are optional extras.
 */
export async function readChapter({ chapterId, chapterSlug }, fetchJson = defaultFetchJson) {
  const list = (status, order) =>
    fetchJson(
      `${GDG_API}/event_slim/for_chapter/${chapterId}/?page_size=500&status=${status}` +
        `&include_cohosted_events=true&visible_on_parent_chapter_only=true&order=${order}&fields=${FIELDS}`
    ).then((d) => (Array.isArray(d?.results) ? d.results : []));

  const [live, done] = await Promise.all([list('Live', 'start_date'), list('Completed', '-start_date')]);
  const seen = new Set();
  const events = [...live, ...done]
    .filter((r) => r && r.id != null && !Number.isNaN(Date.parse(r.start_date)))
    .filter((r) => !seen.has(r.id) && seen.add(r.id))
    .map(normalizeEvent);

  let team = null;
  let chapter = null;
  if (chapterSlug) {
    const slug = encodeURIComponent(chapterSlug);
    team = await fetchJson(`${GDG_API}/chapter_slim/${slug}/team/`).then(normalizeTeam, () => null);
    chapter = await fetchJson(`${GDG_API}/chapter_slim/${slug}/`).then(
      (c) => ({ members_count: Number.isInteger(c?.members_count) ? c.members_count : null, logo_url: c?.cropped_logo_url ?? null }),
      () => null
    );
  }
  return { events, team, chapter };
}
