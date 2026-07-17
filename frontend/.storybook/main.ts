import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)', '../src/**/*.mdx'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  webpackFinal: async (config) => {
    // @storybook/nextjs 8.6.x + Next.js 15.5.x: standalone webpack's DefinePlugin is
    // registered on Next.js's bundled compiler; the cross-instance `instanceof Compilation`
    // check fails at build time. Strip standalone DefinePlugin — @storybook/nextjs injects
    // equivalent env definitions through Next.js's own webpack pipeline.
    config.plugins = (config.plugins ?? []).filter(
      (p: unknown) =>
        (p as { constructor?: { name?: string } })?.constructor?.name !== 'DefinePlugin'
    )
    return config
  },
}

export default config
