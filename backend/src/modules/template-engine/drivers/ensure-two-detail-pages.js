// Every "<Something> Detail" nav page gets two pages (the numbered badge in Layout settings
// counts them) — a lone one is doubled; ones the user already repeated are left alone.
export function ensureTwoDetailPages(titles) {
  const counts = new Map();
  for (const t of titles) counts.set(t.toLowerCase(), (counts.get(t.toLowerCase()) ?? 0) + 1);
  const doubled = new Set();
  return titles.flatMap((t) => {
    const k = t.toLowerCase();
    if (!/\bdetail$/i.test(t) || counts.get(k) !== 1 || doubled.has(k)) return [t];
    doubled.add(k);
    return [t, t];
  });
}
