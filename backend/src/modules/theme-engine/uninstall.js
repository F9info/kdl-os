import { prisma } from '../../config/database.js';
import { PLATFORMS } from './schema/index.js';

/**
 * Uninstall hook (ARCH §Known Risks "Uninstall cleanliness"): remove every
 * catalogue row this module seeded into the shared Type/Category/SettingField
 * tables, keyed by the platform slug prefixes only this module writes.
 *
 * SettingField (and SettingValue below it) cascade from Type, but
 * Category.type_id is onDelete:SetNull — categories must be deleted
 * explicitly or they orphan.
 */
export default async function uninstallThemeEngine(prismaClient = prisma) {
  const byPrefix = { OR: PLATFORMS.map((p) => ({ slug: { startsWith: `${p.id}.` } })) };

  const categories = await prismaClient.category.deleteMany({ where: byPrefix });
  const types = await prismaClient.type.deleteMany({ where: byPrefix });
  await prismaClient.appSetting.deleteMany({
    where: {
      key: {
        in: [
          'theme_engine.tokens_public',
          ...PLATFORMS.map((p) => `theme_engine.active_theme.${p.id}`),
        ],
      },
    },
  });

  return { types: types.count, categories: categories.count };
}
