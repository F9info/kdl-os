import { deriveRouteKey } from './page-routes.js';

const BATCH = 500;
const MAX_BATCHES = 200; // hard cap: 100k pages

/**
 * Gives every page that has no route key one. The migration already keyed the pages the website stage generated
 * (from their slug); this covers the rest: the key the website stage recorded for the page if any (the newest run
 * wins, as before), else what deriveRouteKey gives it. Safe to run on every start: it only touches pages with
 * no key, never changes one that has it, and does nothing once all have one. Returns how many it keyed.
 */
export async function backfillRouteKeys(prisma) {
  let keyed = 0;
  let stageKeys = null; // loaded once, only if a page needs it
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const pages = await prisma.builderPage.findMany({
      where: { route_key: null },
      select: { id: true, slug: true, title: true, updated_at: true },
      take: BATCH,
    });
    if (pages.length === 0) break;
    if (!stageKeys) {
      stageKeys = new Map();
      const stages = await prisma.templateEngineStage.findMany({
        where: { stage: 'WEBSITE' },
        orderBy: { run: { createdAt: 'asc' } }, // newest last, so it wins
        select: { outputRef: true },
      });
      for (const st of stages) {
        for (const [key, id] of Object.entries(st.outputRef?.pageKeyToId ?? {})) stageKeys.set(id, key);
      }
    }
    for (const p of pages) {
      const route_key = stageKeys.get(p.id) || deriveRouteKey(p);
      // Giving a page its address is not an edit: keep its "last modified" time (Prisma would set it to now).
      await prisma.builderPage.update({ where: { id: p.id }, data: { route_key, updated_at: p.updated_at } });
      keyed += 1;
    }
  }
  return keyed;
}
