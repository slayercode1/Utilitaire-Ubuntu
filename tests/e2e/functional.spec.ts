/**
 * Parcours fonctionnels du renderer : snippets, recherche, calculatrice,
 * conversions, paramètres système et navigation clavier.
 *
 * Aucune action à effet de bord système n'est déclenchée : pas de lancement
 * d'application, pas d'exécution de commande, pas de bascule WiFi/Bluetooth,
 * pas d'ouverture de navigateur externe.
 */

import path from 'node:path'
import { naturalClick, naturalFill } from '../helpers/interactions'
import { expect, test } from './fixtures/electron.fixture'

const SCREENSHOTS = path.resolve('test-results/screenshots')

test("état vide : les cinq snippets d'aide sont proposés", async ({ mainWindow, pageErrors }) => {
  const snippets = mainWindow.locator('.snippet-item')
  await expect(snippets).toHaveCount(5)

  const symbols = await mainWindow.locator('.snippet-symbol').allTextContents()
  expect(symbols).toEqual(['.', '?', '??', '>', 'to'])

  await mainWindow.screenshot({
    path: path.join(SCREENSHOTS, '02-empty-snippets-600x500.png')
  })
  expect(pageErrors).toEqual([])
})

test("recherche d'applications réelles indexées", async ({ mainWindow, pageErrors }) => {
  const firstApp = await mainWindow.evaluate(async () => {
    const apps = await window.electronAPI.getApplications()
    return apps[0]?.name ?? null
  })

  test.skip(firstApp === null, 'Aucune application indexée sur ce poste')

  const query = firstApp!.slice(0, 4)
  const input = mainWindow.locator('#searchInput')
  await naturalFill(mainWindow, input, query)

  const results = mainWindow.locator('.result-item')
  await expect(results.first()).toBeVisible()

  const names = await mainWindow.locator('.result-name').allTextContents()
  expect(names.some((name) => name.toLowerCase().includes(query.toLowerCase()))).toBe(true)

  await mainWindow.screenshot({
    path: path.join(SCREENSHOTS, '03-app-search-600x500.png')
  })
  expect(pageErrors).toEqual([])
})

test('calculatrice intégrée : nominal, décimales et expression invalide', async ({
  mainWindow,
  pageErrors
}) => {
  const input = mainWindow.locator('#searchInput')
  const calc = mainWindow.locator('#calculationResult')

  await test.step('2+2 affiche = 4', async () => {
    await naturalFill(mainWindow, input, '2+2')
    await expect(calc).toHaveText('= 4')
    await mainWindow.screenshot({
      path: path.join(SCREENSHOTS, '04-calc-result-600x500.png')
    })
  })

  await test.step('décimales et priorités : 10/4+1 affiche = 3.5', async () => {
    await naturalFill(mainWindow, input, '10/4+1')
    await expect(calc).toHaveText('= 3.5')
  })

  await test.step('parenthèses : (2+3)*4 affiche = 20', async () => {
    await naturalFill(mainWindow, input, '(2+3)*4')
    await expect(calc).toHaveText('= 20')
  })

  await test.step('expression invalide 2++2 : repli sans erreur', async () => {
    await naturalFill(mainWindow, input, '2++2')
    await expect(calc).toHaveText('')
    // L'application propose la recherche web plutôt qu'un état cassé.
    await expect(mainWindow.locator('.google-search')).toBeVisible()
  })

  expect(pageErrors).toEqual([])
})

test("conversions d'unités : longueurs, températures, pixels", async ({
  mainWindow,
  pageErrors
}) => {
  const input = mainWindow.locator('#searchInput')
  const firstResult = mainWindow.locator('.result-item .result-name').first()

  await test.step('100 cm to m', async () => {
    await naturalFill(mainWindow, input, '100 cm to m')
    await expect(firstResult).toHaveText('1 M')
  })

  await test.step('32°c to f', async () => {
    await naturalFill(mainWindow, input, '32°c to f')
    await expect(firstResult).toHaveText('89.6 F')
  })

  await test.step('16px to rem', async () => {
    await naturalFill(mainWindow, input, '16px to rem')
    await expect(firstResult).toHaveText('1 REM')
    await mainWindow.screenshot({
      path: path.join(SCREENSHOTS, '05-conversion-600x500.png')
    })
  })

  expect(pageErrors).toEqual([])
})

test('snippets web et commande : proposés sans être déclenchés', async ({
  mainWindow,
  pageErrors
}) => {
  const input = mainWindow.locator('#searchInput')

  await test.step('?? propose la recherche web', async () => {
    await naturalFill(mainWindow, input, '?? météo paris')
    const item = mainWindow.locator('.result-item .result-name').first()
    await expect(item).toHaveText('Rechercher sur Google')
  })

  await test.step("> propose l'exécution de commande", async () => {
    await naturalFill(mainWindow, input, '> echo bonjour')
    const item = mainWindow.locator('.result-item .result-name').first()
    await expect(item).toHaveText('Exécuter la commande')
    await expect(mainWindow.locator('.result-item .result-description').first()).toHaveText(
      'echo bonjour'
    )
  })

  await test.step('requête introuvable : repli Google', async () => {
    await naturalFill(mainWindow, input, 'zzzqqqxyzzw')
    await expect(mainWindow.locator('.google-search')).toBeVisible()
    await mainWindow.screenshot({
      path: path.join(SCREENSHOTS, '06-web-fallback-600x500.png')
    })
  })

  expect(pageErrors).toEqual([])
})

test('paramètres système : résultat WiFi avec interrupteur, sans bascule', async ({
  mainWindow,
  pageErrors
}) => {
  const input = mainWindow.locator('#searchInput')
  await naturalFill(mainWindow, input, 'wifi')

  const wifiItem = mainWindow.locator('.result-item').filter({ hasText: 'WiFi' }).first()
  await expect(wifiItem).toBeVisible()
  await expect(wifiItem.locator('.result-description')).toHaveText('Paramètre système')

  // L'interrupteur doit exister ; il n'est jamais actionné pour ne pas
  // couper le réseau du poste de test.
  await expect(wifiItem.locator('.toggle-switch')).toBeVisible()

  await mainWindow.screenshot({
    path: path.join(SCREENSHOTS, '07-settings-wifi-600x500.png')
  })
  expect(pageErrors).toEqual([])
})

test('navigation clavier : flèches, Échap, saisies hostiles', async ({
  mainWindow,
  electronApp,
  pageErrors
}) => {
  const input = mainWindow.locator('#searchInput')

  await test.step('les flèches déplacent la sélection', async () => {
    await naturalFill(mainWindow, input, 'a')

    const results = mainWindow.locator('.result-item')
    const count = await results.count()
    test.skip(count < 2, 'Moins de deux résultats pour la requête « a »')

    await expect(results.nth(0)).toHaveClass(/selected/)
    await input.press('ArrowDown')
    await expect(results.nth(1)).toHaveClass(/selected/)
    await input.press('ArrowUp')
    await expect(results.nth(0)).toHaveClass(/selected/)
  })

  await test.step('Échap vide la recherche et masque la fenêtre', async () => {
    await input.press('Escape')

    await expect(input).toHaveValue('')
    const visible = await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible()
    )
    expect(visible).toBe(false)

    // Réaffiche pour la suite du test.
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      win?.show()
      win?.focus()
    })
  })

  await test.step('saisie très longue et caractères spéciaux', async () => {
    const hostile = '<img src=x onerror=alert(1)>' + 'a'.repeat(300)
    await input.fill(hostile)

    // Rendu via textContent : la charge ne doit produire aucun élément.
    const injected = await mainWindow.evaluate(
      () => document.querySelectorAll('img[src="x"]').length
    )
    expect(injected).toBe(0)
    await expect(mainWindow.locator('.google-search')).toBeVisible()
  })

  await test.step('clics répétés sur un élément inerte', async () => {
    await input.fill('')
    const snippet = mainWindow.locator('.snippet-item').first()
    await naturalClick(mainWindow, snippet)
    await snippet.click({ clickCount: 2 })
    await expect(mainWindow.locator('.snippet-item')).toHaveCount(5)
  })

  expect(pageErrors).toEqual([])
})
