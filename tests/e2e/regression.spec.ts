/**
 * Suite de régression (@regression) : parcours critique + comparaison
 * visuelle des écrans essentiels.
 *
 * Le compteur d'indexation est masqué dans les captures : son contenu dépend
 * du nombre réel de fichiers du poste et de l'instant de la capture.
 */

import { naturalFill } from '../helpers/interactions'
import { expect, test } from './fixtures/electron.fixture'

test('@regression le parcours critique reste fonctionnel', async ({
  mainWindow,
  electronApp,
  pageErrors,
  consoleMessages
}) => {
  const input = mainWindow.locator('#searchInput')
  const mask = [mainWindow.locator('#indexCounter')]

  await test.step("écran d'accueil : snippets", async () => {
    await expect(mainWindow.locator('body')).toBeVisible()
    await expect(mainWindow.locator('.snippet-item')).toHaveCount(5)

    await expect(mainWindow).toHaveScreenshot('regression-accueil.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
      mask
    })
  })

  await test.step('calculatrice : fonction critique', async () => {
    await naturalFill(mainWindow, input, '2+2')
    await expect(mainWindow.locator('#calculationResult')).toHaveText('= 4')

    await expect(mainWindow).toHaveScreenshot('regression-calculatrice.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
      mask
    })
  })

  await test.step('conversion : fonction critique', async () => {
    await naturalFill(mainWindow, input, '100 cm to m')
    await expect(mainWindow.locator('.result-item .result-name').first()).toHaveText('1 M')

    await expect(mainWindow).toHaveScreenshot('regression-conversion.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
      mask
    })
  })

  await test.step('Échap referme : comportement Spotlight', async () => {
    await input.press('Escape')
    const visible = await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible()
    )
    expect(visible).toBe(false)
  })

  await test.step('validation technique', async () => {
    expect(pageErrors).toEqual([])

    const consoleErrors = consoleMessages.filter((message) => message.type === 'error')
    expect(consoleErrors).toEqual([])
  })
})
