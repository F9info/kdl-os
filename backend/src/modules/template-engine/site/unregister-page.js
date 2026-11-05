import { prisma } from '../../../config/database.js';

// Inverse of menus/scaffold-page's registerInWebsiteStage: a deleted page must leave the WEBSITE
// stage output too, or the Layout settings pills / Pages view keep listing it.
export async function unregisterFromWebsiteStage(projectId, pageId) {
  if (!projectId) return;
  const stages = await prisma.templateEngineStage.findMany({ where: { stage: 'WEBSITE', run: { projectId } } });
  for (const stage of stages) {
    const out = stage.outputRef ?? {};
    const keys = Object.keys(out.pageKeyToId ?? {}).filter((k) => out.pageKeyToId[k] === pageId);
    if (!keys.length && !(out.pageIds ?? []).includes(pageId)) continue;
    const without = (obj) => Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => !keys.includes(k)));
    await prisma.templateEngineStage.update({
      where: { id: stage.id },
      data: {
        outputRef: {
          ...out,
          pageIds: (out.pageIds ?? []).filter((id) => id !== pageId),
          pageKeyToId: without(out.pageKeyToId),
          pageKeyToTitle: without(out.pageKeyToTitle),
        },
      },
    });
  }
}

// A renamed detail menu item renames its same-titled pages; keep the stage's title map in step.
export async function renameInWebsiteStage(projectId, oldTitle, newTitle) {
  if (!projectId) return;
  const stages = await prisma.templateEngineStage.findMany({ where: { stage: 'WEBSITE', run: { projectId } } });
  for (const stage of stages) {
    const out = stage.outputRef ?? {};
    const titles = out.pageKeyToTitle ?? {};
    if (!Object.values(titles).includes(oldTitle)) continue;
    const next = Object.fromEntries(Object.entries(titles).map(([k, v]) => [k, v === oldTitle ? newTitle : v]));
    await prisma.templateEngineStage.update({ where: { id: stage.id }, data: { outputRef: { ...out, pageKeyToTitle: next } } });
  }
}
