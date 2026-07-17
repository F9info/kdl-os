import type { Preview } from '@storybook/react'
import '../src/app/globals.css'
import '../src/app/te-components.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0f172a' },
      ],
    },
    a11y: {
      config: {},
    },
  },
  decorators: [
    (Story, context) => {
      const isDark = context.globals.backgrounds?.value === '#0f172a'
      return (
        <div
          className={isDark ? 'dark' : ''}
          style={{
            padding: '1rem',
            minHeight: '100vh',
            background: isDark ? '#0f172a' : '#ffffff',
          }}
        >
          <Story />
        </div>
      )
    },
  ],
}

export default preview
