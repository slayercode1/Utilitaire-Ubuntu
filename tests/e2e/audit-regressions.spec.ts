/**
 * Régressions relevées par l'audit de production : chaque test reproduit un
 * défaut observé dans l'application réelle.
 *
 * Les lancements sont interceptés dans le processus principal : aucun
 * programme n'est réellement démarré pendant ces tests.
 */

import type { ElectronApplication, Page } from '@playwright/test'
import { naturalFill } from '../helpers/interactions'
import { expect, test } from './fixtures/electron.fixture'

/** Remplace le lancement d'application par un simple enregistrement. */
async function recordLaunches(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ ipcMain }) => {
    const store = globalThis as typeof globalThis & { __launches?: string[] }
    store.__launches = []
    ipcMain.removeAllListeners('launch-app')
    ipcMain.on('launch-app', (_event, desktopFilePath: string) => {
      store.__launches?.push(desktopFilePath)
    })
  })
}

async function launches(electronApp: ElectronApplication): Promise<string[]> {
  return electronApp.evaluate(
    () => (globalThis as typeof globalThis & { __launches?: string[] }).__launches ?? []
  )
}

/** Remplace l'historique puis recharge l'interface pour qu'elle le relise. */
async function seedHistory(page: Page, entries: object[]): Promise<void> {
  await page.evaluate((data) => {
    localStorage.setItem('finderHistory', JSON.stringify(data))
  }, entries)
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('.history-item')).toHaveCount(entries.length)
}

test("historique : l'élément exact est rouvert, jamais un autre par sous-chaîne", async ({
  electronApp,
  mainWindow,
  pageErrors
}) => {
  const apps = await mainWindow.evaluate(() => window.electronAPI.getApplications())
  test.skip(apps.length < 2, 'Au moins deux applications indexées sont nécessaires')

  // Une application dont le nom contient une lettre partagée par une autre
  // qui la précède dans l'ordre alphabétique : cas où l'ancien code se trompait.
  const target = apps[apps.length - 1]
  if (!target) return

  await recordLaunches(electronApp)

  await test.step('entrée avec chemin : relance exactement cette application', async () => {
    await seedHistory(mainWindow, [
      {
        query: target.name.slice(0, 1),
        type: 'app',
        name: target.name,
        path: target.path,
        timestamp: Date.now()
      }
    ])
    await mainWindow.locator('.history-item').first().click()
    await expect.poll(() => launches(electronApp)).toEqual([target.path])
  })

  await test.step('entrée ancienne et ambiguë : la requête est rejouée, rien ne se lance', async () => {
    await recordLaunches(electronApp)
    await seedHistory(mainWindow, [
      { query: 'e', type: 'app', name: 'Application disparue 7f3a', timestamp: Date.now() }
    ])
    await mainWindow.locator('.history-item').first().click()

    await expect(mainWindow.locator('#searchInput')).toHaveValue('e')
    expect(await launches(electronApp)).toEqual([])
  })

  expect(pageErrors).toEqual([])
})

test('une date saisie reste une recherche et ne devient pas un calcul', async ({
  mainWindow,
  pageErrors
}) => {
  const input = mainWindow.locator('#searchInput')

  await naturalFill(mainWindow, input, '2024-01-15')
  await expect(mainWindow.locator('#calculationResult')).toHaveText('')
  await expect(mainWindow.locator('.result-item').first()).toBeVisible()

  // Le calcul ordinaire reste disponible
  await naturalFill(mainWindow, input, '2024-15')
  await expect(mainWindow.locator('#calculationResult')).toHaveText('= 2009')

  expect(pageErrors).toEqual([])
})
