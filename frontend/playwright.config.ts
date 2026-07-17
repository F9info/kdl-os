import { defineConfig } from '@playwright/test'

// Point E2E_BASE_URL at an already-running stack (e.g. the docker compose
// frontend on http://localhost:3001) to skip spawning a dev server. Without it,
// a local `pnpm dev` is started on :3000 (needs BACKEND_INTERNAL_URL set so the
// /api rewrite reaches the backend from the host).
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL,
    // KDL-148: real-browser screen-capture coverage needs getDisplayMedia to
    // resolve without an actual OS picker (there is no desktop in CI/headless).
    // These fake-device flags plus the granted permissions make it resolve to
    // a synthetic stream instead of hanging on a picker that can never appear.
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--auto-select-desktop-capture-source=Entire screen',
      ],
    },
    permissions: ['camera', 'microphone'],
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        timeout: 120 * 1000,
        reuseExistingServer: !process.env.CI,
      },
})
