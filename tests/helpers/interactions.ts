/**
 * Interactions « naturelles » : mise en évidence de l'élément ciblé,
 * déplacement progressif de la souris, une seule action à la fois.
 *
 * Les temporisations rendent les actions lisibles dans les vidéos et traces ;
 * elles sont annulées en CI (QA_FAST=1 ou CI) pour garder des tests rapides.
 */

import type { Locator, Page } from '@playwright/test'

const FAST = Boolean(process.env['CI'] || process.env['QA_FAST'])

function pause(page: Page, ms: number): Promise<void> {
  return FAST ? Promise.resolve() : page.waitForTimeout(ms)
}

export async function highlightTarget(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded()
  await locator.waitFor({ state: 'visible' })

  await locator.evaluate((element) => {
    const htmlElement = element as HTMLElement
    htmlElement.dataset['previousOutline'] = htmlElement.style.outline
    htmlElement.dataset['previousOutlineOffset'] = htmlElement.style.outlineOffset
    htmlElement.style.outline = '3px solid #ff3b30'
    htmlElement.style.outlineOffset = '3px'
  })

  await pause(page, 400)
}

export async function removeHighlight(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    const htmlElement = element as HTMLElement
    htmlElement.style.outline = htmlElement.dataset['previousOutline'] ?? ''
    htmlElement.style.outlineOffset = htmlElement.dataset['previousOutlineOffset'] ?? ''
    delete htmlElement.dataset['previousOutline']
    delete htmlElement.dataset['previousOutlineOffset']
  })
}

export async function naturalClick(page: Page, locator: Locator): Promise<void> {
  await highlightTarget(page, locator)

  const box = await locator.boundingBox()
  if (!box) {
    throw new Error("Impossible de déterminer la position de l'élément.")
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 12
  })

  await pause(page, 300)
  await locator.click()
  await pause(page, 500)

  await removeHighlight(locator).catch(() => {
    // L'élément peut avoir disparu après le clic.
  })
}

export async function naturalFill(page: Page, locator: Locator, value: string): Promise<void> {
  await highlightTarget(page, locator)
  await locator.click()

  await pause(page, 200)
  await locator.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await locator.press('Backspace')
  await locator.pressSequentially(value, { delay: FAST ? 0 : 60 })

  await pause(page, 400)
  await removeHighlight(locator)
}
