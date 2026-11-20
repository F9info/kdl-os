import { describe, it, expect } from 'vitest';
import { categoryOf, normalizeEvent, normalizeTeam, readChapter, GDG_API } from './chapter-feed.js';
import { createEventSchema, saveSyncSchema } from './schema.js';

const row = (over = {}) => ({
  id: 134465,
  title: '  Local2Global   Hack : GDGVIZAG ',
  start_date: '2026-11-05T03:30:00Z',
  end_date: '2026-11-06T03:30:00Z',
  venue_name: 'Gayatri Vidya Parishad  , Visakhapatnam',
  event_type_title: 'Hackathon',
  cropped_picture_url: 'https://img/p.png',
  cropped_banner_url: '',
  url: 'https://gdg.community.dev/events/details/x/',
  cohost_registration_url: null,
  description_short: 'A 24-hour hackathon.',
  tags: ['AI', 'Web'],
  ...over,
});

describe('categoryOf', () => {
  it.each([
    ['DevFest Vizag 2025', 'DevFest'],
    ["International Women's Day Vizag", 'Women Techmakers'],
    ['Google I/O Extended Vizag', 'I/O Extended'],
    ['Android Study Jam', 'Study Jams'],
    ['Prompt to Product: A 5-Day AI & Developer Experience', 'Build with AI'],
    ['Flutter hands-on workshop', 'Workshops and talks'],
    ['Monthly meetup', 'Meetups'],
    [undefined, 'Meetups'],
  ])('%s -> %s', (title, cat) => expect(categoryOf(title)).toBe(cat));
});

describe('normalizeEvent', () => {
  it('cleans the text and maps the fields', () => {
    const e = normalizeEvent(row());
    expect(e).toMatchObject({
      source: 'gdg',
      source_id: '134465',
      title: 'Local2Global Hack : GDGVIZAG',
      venue: 'Gayatri Vidya Parishad, Visakhapatnam',
      event_type: 'Hackathon',
      banner_url: null,
      register_url: 'https://gdg.community.dev/events/details/x/',
      tags: ['AI', 'Web'],
    });
    expect(e.start_date.toISOString()).toBe('2026-11-05T03:30:00.000Z');
  });

  it('prefers the co-host registration link and drops a "." venue', () => {
    const e = normalizeEvent(row({ cohost_registration_url: 'https://reg.example/x', venue_name: '.', end_date: null }));
    expect(e.register_url).toBe('https://reg.example/x');
    expect(e.venue).toBeNull();
    expect(e.end_date).toBeNull();
  });
});

describe('normalizeTeam', () => {
  it('builds names and tolerates missing parts', () => {
    expect(
      normalizeTeam([{ user: { first_name: 'Satish', last_name: 'K', avatar: { url: 'a.png' } }, title: 'Organizer' }, {}])
    ).toEqual([
      { name: 'Satish K', title: 'Organizer', avatar: 'a.png' },
      { name: '', title: '', avatar: '' },
    ]);
  });
  it('returns [] for a non-array', () => expect(normalizeTeam(null)).toEqual([]));
});

describe('readChapter', () => {
  it('merges live and completed, skips duplicates and bad dates, and reads team + chapter', async () => {
    const calls = [];
    const fetchJson = async (url) => {
      calls.push(url);
      if (url.includes('status=Live')) return { results: [row({ id: 1, title: 'DevFest' })] };
      if (url.includes('status=Completed')) return { results: [row({ id: 1 }), row({ id: 2 }), row({ id: 3, start_date: 'nope' })] };
      if (url.endsWith('/team/')) return [{ user: { first_name: 'A', last_name: 'B' }, title: 'Lead' }];
      return { members_count: 3270, cropped_logo_url: 'logo.png' };
    };
    const out = await readChapter({ chapterId: 318, chapterSlug: 'gdg-vizag' }, fetchJson);
    expect(out.events.map((e) => e.source_id)).toEqual(['1', '2']);
    expect(out.team).toEqual([{ name: 'A B', title: 'Lead', avatar: '' }]);
    expect(out.chapter).toEqual({ members_count: 3270, logo_url: 'logo.png' });
    expect(calls[0].startsWith(`${GDG_API}/event_slim/for_chapter/318/`)).toBe(true);
  });

  it('throws when events cannot be read, but tolerates a failing team call', async () => {
    await expect(readChapter({ chapterId: 1 }, async () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    const out = await readChapter({ chapterId: 1, chapterSlug: 'x' }, async (url) => {
      if (url.includes('event_slim')) return { results: [] };
      throw new Error('team down');
    });
    expect(out).toEqual({ events: [], team: null, chapter: null });
  });
});

describe('schemas', () => {
  it('rejects an end before the start', () => {
    const r = createEventSchema.safeParse({ body: { title: 'Meetup', start_date: '2026-12-02', end_date: '2026-12-01' } });
    expect(r.success).toBe(false);
  });
  it('rejects a javascript: link', () => {
    const r = createEventSchema.safeParse({ body: { title: 'Meetup', start_date: '2026-12-02', register_url: 'javascript:alert(1)' } });
    expect(r.success).toBe(false);
  });
  it('accepts sync settings and rejects a bad slug', () => {
    expect(saveSyncSchema.safeParse({ query: {}, body: { chapter_id: '318', chapter_slug: 'gdg-vizag' } }).success).toBe(true);
    expect(saveSyncSchema.safeParse({ query: {}, body: { chapter_id: 318, chapter_slug: '../x' } }).success).toBe(false);
  });
});
