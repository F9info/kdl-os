import { construction } from './construction'
import { general } from './general'
import { landing } from './landing'
import { medical } from './medical'
import type { ComponentPack } from './types'

export { general, construction, medical, landing }
export type { ComponentPack }
export { composePacks } from './compose'

export const packs: ComponentPack[] = [general, construction, medical, landing]
