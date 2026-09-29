// Editor-side entity binding for template-bound pages. The public route
// resolves a template with the entity's own copy; the editor must show the
// same thing (otherwise it shows the template's placeholder text), but must
// never write that per-entity copy back into the shared template on save.
import { getDetailPageType } from './registry.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function loadContext(page, template) {
  const type = getDetailPageType(template.type_key);
  if (!type?.resolveEntityBindings || !page.entity_id) return null;
  const entities = await type.listEntities(page.project_id ?? template.project_id);
  const entity = entities.find((e) => e.id === page.entity_id);
  return entity ? { type, entity } : null;
}

// Template data as this page's entity sees it (what the editor displays).
export async function resolveForEditor(page, template) {
  const ctx = await loadContext(page, template);
  return ctx ? ctx.type.resolveEntityBindings(template.data, ctx.entity) : template.data;
}

// Editor saved `incoming` (the resolved view, possibly edited). Any prop the
// admin did NOT touch — still equal to its resolved value — goes back to the
// template's own value, so entity copy never leaks into the shared template.
export async function stripEntityBindings(page, template, incoming) {
  const ctx = await loadContext(page, template);
  if (!ctx || !incoming?.content) return incoming;
  const resolved = ctx.type.resolveEntityBindings(template.data, ctx.entity);
  const byId = (data) => new Map((data.content ?? []).map((b) => [b.props?.id, b]));
  const tplBlocks = byId(template.data);
  const resBlocks = byId(resolved);
  const content = incoming.content.map((block) => {
    const tpl = tplBlocks.get(block.props?.id);
    const res = resBlocks.get(block.props?.id);
    if (!tpl || !res) return block;
    const props = { ...block.props };
    for (const k of Object.keys(props)) {
      if (same(props[k], res.props[k]) && !same(props[k], tpl.props[k])) {
        if (k in tpl.props) props[k] = tpl.props[k];
        else delete props[k];
      }
    }
    return { ...block, props };
  });
  const root =
    incoming.root && same(incoming.root.props?.title, resolved.root?.props?.title)
      ? { ...incoming.root, props: { ...incoming.root.props, title: template.data.root?.props?.title } }
      : incoming.root;
  return { ...incoming, root, content };
}

