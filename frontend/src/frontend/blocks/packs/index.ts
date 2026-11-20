import { construction } from './construction'
import { gdg } from './gdg'
import { general } from './general'
import { landing } from './landing'
import { medical } from './medical'
import type { ComponentPack } from './types'

export { general, construction, medical, landing, gdg }
export type { ComponentPack }
export { composePacks } from './compose'

export const packs: ComponentPack[] = [general, construction, medical, landing, gdg]
