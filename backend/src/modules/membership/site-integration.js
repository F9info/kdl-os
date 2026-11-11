// Adds Membership to the public website: a "Membership" menu link, Log in / Become a member buttons in
// the header, footer links, and a banner on the home page (mockup: static-kdl-os/frontend/home.html).
// Works on Puck page data, is idempotent, and never touches a header/footer it cannot recognise.
const MEMBERSHIP_LINK = 'Membership|/membership';
const BANNER_ID = 'membership-banner';

const LEGACY = 'Member login|/login';
const hasLine = (links, line) => links.split('\n').some((l) => l.trim() === line);
const addLines = (links, lines) => [links.split('\n').filter((l) => l.trim() !== LEGACY).join('\n').trimEnd(), ...lines.filter((l) => !hasLine(links, l))].filter(Boolean).join('\n');

export function patchBlock(block) {
  const { type, props } = block ?? {};
  if (!type || !props || typeof props.links !== 'string') return block;
  if (/(Header|NavBar)$/.test(type)) {
    const next = { ...props, links: addLines(props.links, [MEMBERSHIP_LINK]) };
    if ('loginLabel' in props) Object.assign(next, { loginLabel: 'Log in', loginHref: '/membership/login' });
    if ('ctaLabel' in props) Object.assign(next, { ctaLabel: 'Become a member', ctaHref: '/membership' });
    return { ...block, props: next };
  }
  if (/Footer$/.test(type)) {
    return { ...block, props: { ...props, links: addLines(props.links, [MEMBERSHIP_LINK, 'Member login|/membership/login']) } };
  }
  return block;
}

export function patchPageData(data, slug) {
  if (!data || !Array.isArray(data.content)) return data;
  let content = data.content.map(patchBlock);
  const isHome = /(^|-)home$/.test(slug ?? '');
  const footerAt = content.findIndex((b) => b.type === 'ConstructionFooter');
  if (isHome && footerAt >= 0 && !content.some((b) => b.props?.id === BANNER_ID)) {
    const banner = {
      type: 'ConstructionQuoteCTA',
      props: {
        id: BANNER_ID,
        eyebrow: 'Membership',
        headline: 'Join as a member',
        subtext: 'Member-only resources, event discounts and priority support.',
        ctaLabel: 'See plans →',
        ctaHref: '/membership',
        secondaryCtaLabel: 'Member login →',
        secondaryCtaHref: '/membership/login',
        phoneLabel: '',
        phoneNumber: '',
        background: 'accent',
      },
    };
    content = [...content.slice(0, footerAt), banner, ...content.slice(footerAt)];
  }
  return { ...data, content };
}

export async function applyMembershipToSite(db) {
  const pages = await db.builderPage.findMany({ where: { deleted_at: null }, select: { id: true, slug: true, data: true, draft_data: true } });
  let changed = 0;
  for (const p of pages) {
    const data = patchPageData(p.data, p.slug);
    const draft = p.draft_data ? patchPageData(p.draft_data, p.slug) : p.draft_data;
    if (JSON.stringify(data) === JSON.stringify(p.data) && JSON.stringify(draft) === JSON.stringify(p.draft_data)) continue;
    await db.builderPage.update({ where: { id: p.id }, data: { data, ...(p.draft_data ? { draft_data: draft } : {}) } });
    changed += 1;
  }
  return { pages_updated: changed };
}

// Menus module: header gets "Membership"; footer gets "Membership" + "Member login". Skips a url already present.
const MENU_ITEMS = {
  header: [{ label: 'Membership', url: '/membership' }],
  footer: [{ label: 'Membership', url: '/membership' }, { label: 'Member login', url: '/membership/login' }],
};

export async function applyMembershipToMenus(db) {
  let added = 0;
  for (const menu of await db.menu.findMany({ where: { key: { in: Object.keys(MENU_ITEMS) } }, include: { items: { where: { parent_id: null }, select: { url: true, order: true } } } })) {
    let order = Math.max(-1, ...menu.items.map((i) => i.order)) + 1;
    for (const it of MENU_ITEMS[menu.key]) {
      if (menu.items.some((i) => i.url === it.url)) continue;
      await db.menuItem.create({ data: { menu_id: menu.id, label: it.label, url: it.url, link_type: 'custom', order: order++ } });
      added += 1;
    }
  }
  return { menu_items_added: added };
}
