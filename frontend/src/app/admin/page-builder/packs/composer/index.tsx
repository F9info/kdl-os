import type { Config } from '@puckeditor/core'
import type { ComponentPack } from '../types'
import { ComposerProjectContext } from './atoms'
import {
  renderComposedBlock,
  DEFAULT_SETTINGS,
  type ComposedBlockConfig,
} from './render-composed-block'

type ComposerProps = {
  CustomComposedBlock: {
    config: ComposedBlockConfig
  }
}

const CustomComposedBlock: Config<ComposerProps>['components']['CustomComposedBlock'] = {
  label: 'Custom Block',
  fields: {
    config: { type: 'text' },
  },
  defaultProps: {
    config: { category: 'general', atoms: [], settings: DEFAULT_SETTINGS },
  },
  render: ({ config, puck }) => (
    <ComposerProjectContext.Provider value={puck?.metadata?.projectId as string | undefined}>
      {renderComposedBlock(config)}
    </ComposerProjectContext.Provider>
  ),
}

export const composer: ComponentPack = {
  key: 'composer',
  label: 'Composer',
  components: {
    CustomComposedBlock,
  } as NonNullable<Config['components']>,
  categories: {},
}
