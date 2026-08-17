import { general } from './general'
import type { ComponentPack } from './types'

export { general }
export type { ComponentPack }
export { composePacks } from './compose'

export const packs: ComponentPack[] = [general]
