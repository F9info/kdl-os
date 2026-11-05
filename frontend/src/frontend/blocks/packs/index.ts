import { construction } from './construction'
import { general } from './general'
import { medical } from './medical'
import type { ComponentPack } from './types'

export { general, construction, medical }
export type { ComponentPack }
export { composePacks } from './compose'

export const packs: ComponentPack[] = [general, construction, medical]
