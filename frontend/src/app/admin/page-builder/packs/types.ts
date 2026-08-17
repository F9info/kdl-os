import type { Config } from '@puckeditor/core'

export interface ComponentPack {
  key: string
  label: string
  components: NonNullable<Config['components']>
  categories?: NonNullable<Config['categories']>
}
