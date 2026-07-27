/**
 * Persistance : l'historique survit à un redémarrage complet de
 * l'application, et les données corrompues sont écartées au rechargement.
 *
 * Ce test n'utilise pas la fixture : il doit contrôler lui-même le profil
 * pour lancer deux fois l'application sur les mêmes données.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'

const MAIN_ENTRY = path.resolve('.')

async function launchWithProfile(profile: string) {
  // Voir electron.fixture.ts : cette variable ferait démarrer Electron en
  // simple processus Node.
  const { ELECTRON_RUN_AS_NODE: _ignored, ...cleanEnv } = process.env

  const app = await electron.launch({
    args: [MAIN_ENTRY, '--no-sandbox'],
    env: {
      ...cleanEnv,
      XDG_CONFIG_HOME: profile,
      NODE_ENV: 'test',
      E2E_TEST: 'true'
    },
    timeout: 30_000
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win?.show()
    win?.focus()
  })

  return { app, page }
}

test("l'historique persiste après fermeture et relance", async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'finder-storage-'))

  try {
    await test.step('première session : écrire un historique', async () => {
      const { app, page } = await launchWithProfile(profile)

      await page.evaluate(() => {
        localStorage.setItem(
          'finderHistory',
          JSON.stringify([
            {
              query: 'test-persistance',
              type: 'app',
              name: 'Test Persistance',
              timestamp: Date.now()
            }
          ])
        )
      })

      await app.close()
    })

    await test.step("seconde session : l'historique est restauré", async () => {
      const { app, page } = await launchWithProfile(profile)

      // Champ vide → l'accueil affiche l'historique, pas les snippets.
      const historyItem = page.locator('.history-item .result-name').first()
      await expect(historyItem).toHaveText('Test Persistance')

      await app.close()
    })

    await test.step('données corrompues : purgées sans crash', async () => {
      const { app, page } = await launchWithProfile(profile)

      await page.evaluate(() => {
        localStorage.setItem('finderHistory', '{"pas":"un tableau"}')
      })
      await app.close()

      const second = await launchWithProfile(profile)
      // Retour aux snippets : l'entrée invalide a été écartée.
      await expect(second.page.locator('.snippet-item')).toHaveCount(5)

      const cleaned = await second.page.evaluate(() => localStorage.getItem('finderHistory'))
      expect(cleaned).toBeNull()

      await second.app.close()
    })
  } finally {
    fs.rmSync(profile, { recursive: true, force: true })
  }
})
