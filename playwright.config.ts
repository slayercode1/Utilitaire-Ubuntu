import { defineConfig } from '@playwright/test'

/**
 * Tests E2E Electron : exécution séquentielle obligatoire. Chaque test lance
 * sa propre instance de l'application ; deux instances parallèles se
 * disputeraient le raccourci global et les scans disque.
 */
export default defineConfig({
  testDir: './tests/e2e',

  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,

  timeout: 60_000,

  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    }
  },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000
  },

  outputDir: 'test-results/artifacts'
})
