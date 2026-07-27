/**
 * Fixture Playwright pour Finder.
 *
 * Particularités de l'application prises en compte :
 * - la fenêtre naît volontairement cachée (comportement Spotlight) : la
 *   fixture l'affiche comme le ferait le raccourci global ;
 * - le verrou d'instance unique vit dans le profil utilisateur : chaque test
 *   reçoit un XDG_CONFIG_HOME jetable, ce qui isole aussi localStorage et
 *   évite tout conflit avec une installation réelle de Finder ;
 * - le binaire chrome-sandbox de node_modules n'est pas setuid dans cet
 *   environnement : l'instance DE TEST est lancée avec --no-sandbox. Ce
 *   drapeau ne concerne que les tests, jamais l'application livrée.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test as base, expect, type Page } from '@playwright/test'
import { type ElectronApplication, _electron as electron } from 'playwright'

export interface ConsoleEntry {
  type: string
  text: string
}

interface ElectronFixtures {
  electronApp: ElectronApplication
  mainWindow: Page
  consoleMessages: ConsoleEntry[]
  pageErrors: string[]
}

export const test = base.extend<ElectronFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: signature imposée par les fixtures Playwright
  electronApp: async ({}, use, testInfo) => {
    // Le répertoire du projet, pas le script : Electron lit alors
    // package.json et rapporte le vrai nom et la vraie version de l'app.
    const mainEntry = path.resolve(process.cwd(), process.env['ELECTRON_MAIN_ENTRY'] ?? '.')

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'finder-e2e-'))

    // ELECTRON_RUN_AS_NODE hérité d'un environnement d'outillage ferait
    // démarrer Electron en simple processus Node, sans module `app`.
    const { ELECTRON_RUN_AS_NODE: _ignored, ...cleanEnv } = process.env

    const electronApp = await electron.launch({
      args: [mainEntry, '--no-sandbox'],
      env: {
        ...cleanEnv,
        XDG_CONFIG_HOME: profile,
        NODE_ENV: 'test',
        E2E_TEST: 'true'
      },
      timeout: 30_000
    })

    await electronApp.context().tracing.start({
      screenshots: true,
      snapshots: true
    })

    try {
      await use(electronApp)
    } finally {
      const tracePath = testInfo.outputPath('trace.zip')
      await electronApp
        .context()
        .tracing.stop({ path: tracePath })
        .catch(() => {})

      if (testInfo.status === 'passed') {
        fs.rmSync(tracePath, { force: true })
      } else {
        testInfo.attachments.push({
          name: 'trace',
          path: tracePath,
          contentType: 'application/zip'
        })
      }

      await electronApp.close().catch(() => {})
      fs.rmSync(profile, { recursive: true, force: true })
    }
  },

  mainWindow: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Affiche la fenêtre cachée, comme le ferait Alt+Space.
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      win?.show()
      win?.focus()
    })

    await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 })

    await use(page)
  },

  consoleMessages: async ({ mainWindow }, use) => {
    const messages: ConsoleEntry[] = []
    mainWindow.on('console', (message) => {
      messages.push({ type: message.type(), text: message.text() })
    })
    await use(messages)
  },

  pageErrors: async ({ mainWindow }, use) => {
    const errors: string[] = []
    mainWindow.on('pageerror', (error) => {
      errors.push(error.stack ?? error.message)
    })
    await use(errors)
  }
})

export { expect }
