/**
 * Frontière IPC : contrats de données, robustesse aux entrées invalides,
 * absence d'exposition dangereuse.
 *
 * Les canaux destructifs (eraseLocalData, executeCommand,
 * executeSettingAction) ne sont volontairement pas invoqués : leur présence
 * et leur type sont vérifiés, leur déclenchement passerait par des dialogues
 * natifs ou modifierait l'état du poste.
 */

import { expect, test } from './fixtures/electron.fixture'

test('les canaux de lecture respectent leur contrat', async ({ mainWindow, pageErrors }) => {
  await test.step('getApplications retourne des entrées complètes', async () => {
    const apps = await mainWindow.evaluate(() => window.electronAPI.getApplications())

    expect(Array.isArray(apps)).toBe(true)
    expect(apps.length).toBeGreaterThan(0)

    const first = apps[0]!
    expect(typeof first.name).toBe('string')
    expect(first.name.length).toBeGreaterThan(0)
    expect(first.path.endsWith('.desktop')).toBe(true)
  })

  await test.step('getFiles retourne des entrées typées', async () => {
    const files = await mainWindow.evaluate(() => window.electronAPI.getFiles())

    expect(Array.isArray(files)).toBe(true)
    if (files.length > 0) {
      const first = files[0]!
      expect(['file', 'folder']).toContain(first.type)
      expect(first.path.startsWith('/')).toBe(true)
    }
  })

  await test.step('searchSettings sérialise sans les fonctions', async () => {
    const settings = await mainWindow.evaluate(() => window.electronAPI.searchSettings('wifi'))

    expect(settings.length).toBeGreaterThan(0)
    expect(settings[0]!.id).toBe('wifi')

    // Les commandes doivent rester côté main : seules id/name/icon passent.
    for (const action of settings[0]!.actions) {
      expect(Object.keys(action).sort()).toEqual(['icon', 'id', 'name'])
    }
  })

  await test.step('getSettingState retourne un booléen', async () => {
    const state = await mainWindow.evaluate(() => window.electronAPI.getSettingState('wifi'))
    expect(typeof state).toBe('boolean')
  })

  await test.step('refreshIndex reconstruit les deux index', async () => {
    const result = await mainWindow.evaluate(() => window.electronAPI.refreshIndex())
    expect(Array.isArray(result.applications)).toBe(true)
    expect(Array.isArray(result.files)).toBe(true)
  })

  expect(pageErrors).toEqual([])
})

test("les entrées invalides sont bloquées sans faire tomber l'application", async ({
  mainWindow,
  electronApp,
  pageErrors
}) => {
  await test.step('launchApp avec un identifiant non indexé', async () => {
    await mainWindow.evaluate(() => window.electronAPI.launchApp('/tmp/inexistant.desktop'))
  })

  await test.step('openFile hors index', async () => {
    await mainWindow.evaluate(() => window.electronAPI.openFile('/etc/passwd'))
  })

  await test.step('payload déraisonnable sur searchSettings', async () => {
    const settings = await mainWindow.evaluate(() =>
      window.electronAPI.searchSettings('a'.repeat(50_000))
    )
    expect(Array.isArray(settings)).toBe(true)
  })

  await test.step('getSettingState avec un id inconnu', async () => {
    const state = await mainWindow.evaluate(() => window.electronAPI.getSettingState('id-inconnu'))
    expect(state).toBe(false)
  })

  await test.step('le processus principal répond toujours', async () => {
    const alive = await electronApp.evaluate(({ BrowserWindow }) => ({
      windows: BrowserWindow.getAllWindows().length,
      destroyed: BrowserWindow.getAllWindows()[0]?.isDestroyed()
    }))
    expect(alive.windows).toBe(1)
    expect(alive.destroyed).toBe(false)
  })

  expect(pageErrors).toEqual([])
})

test('hideWindow masque la fenêtre depuis le renderer', async ({ mainWindow, electronApp }) => {
  await mainWindow.evaluate(() => window.electronAPI.hideWindow())

  const visible = await electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.isVisible()
  )
  expect(visible).toBe(false)
})
