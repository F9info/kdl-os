import type { Config } from '@puckeditor/core'
import type { ComponentPack } from './types'

export function composePacks(root: Config['root'], packs: ComponentPack[]): Config {
  const components: NonNullable<Config['components']> = {}
  const categories: NonNullable<Config['categories']> = {}

  for (const pack of packs) {
    for (const key of Object.keys(pack.components)) {
      if (Object.prototype.hasOwnProperty.call(components, key)) {
        throw new Error(
          `[composePacks] Component key collision: "${key}" is already registered. ` +
            `Use a namespaced key (e.g. "${pack.key}:${key}") to keep packs isolated.`
        )
      }
      components[key] = pack.components[key]!
    }

    if (pack.categories) {
      for (const [catKey, cat] of Object.entries(pack.categories)) {
        if (Object.prototype.hasOwnProperty.call(categories, catKey)) {
          const existing = categories[catKey]!
          categories[catKey] = {
            ...existing,
            components: [...(existing.components ?? []), ...(cat.components ?? [])],
          }
        } else {
          categories[catKey] = cat
        }
      }
    }
  }

  return { root, components, categories }
}
