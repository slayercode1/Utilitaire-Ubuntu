/**
 * Audit accessibilité : sémantique ARIA, parcours clavier exclusif.
 * Les invariants indispensables sont des assertions ; les manques non
 * bloquants sont collectés dans test-results/qa/a11y.json pour le rapport.
 */

import fs from 'node:fs'
import path from 'node:path'
import { naturalFill } from '../helpers/interactions'
import { expect, test } from './fixtures/electron.fixture'

const QA_DIR = path.resolve('test-results/qa')

test('sémantique de base et parcours clavier', async ({ mainWindow, pageErrors }) => {
  fs.mkdirSync(QA_DIR, { recursive: true })
  const findings: {
    element: string
    problem: string
    severity: 'moyenne' | 'mineure'
    recommendation: string
  }[] = []

  await test.step('invariants indispensables', async () => {
    const semantics = await mainWindow.evaluate(() => ({
      lang: document.documentElement.lang,
      inputLabel: document.getElementById('searchInput')?.getAttribute('aria-label'),
      inputAutocomplete: document.getElementById('searchInput')?.getAttribute('aria-autocomplete'),
      listboxRole: document.getElementById('resultsContainer')?.getAttribute('role'),
      calcLive: document.getElementById('calculationResult')?.getAttribute('aria-live'),
      counterLive: document.getElementById('indexCounter')?.getAttribute('aria-live')
    }))

    expect(semantics.lang).toBe('fr')
    expect(semantics.inputLabel).toBeTruthy()
    expect(semantics.listboxRole).toBe('listbox')
    expect(semantics.calcLive).toBe('polite')
    expect(semantics.counterLive).toBe('polite')
  })

  await test.step('relevé des manques non bloquants', async () => {
    await naturalFill(mainWindow, mainWindow.locator('#searchInput'), 'wifi')

    const audit = await mainWindow.evaluate(() => {
      const items = [...document.querySelectorAll('.result-item')]
      const input = document.getElementById('searchInput')
      const toggles = [...document.querySelectorAll('.toggle-checkbox')]
      return {
        itemsWithoutRole: items.filter((item) => !item.getAttribute('role')).length,
        itemsTotal: items.length,
        activeDescendant: input?.getAttribute('aria-activedescendant') ?? null,
        expanded: input?.getAttribute('aria-expanded') ?? null,
        unlabelledToggles: toggles.filter(
          (toggle) =>
            !toggle.getAttribute('aria-label') && !toggle.closest('label')?.textContent?.trim()
        ).length
      }
    })

    if (audit.itemsWithoutRole > 0) {
      findings.push({
        element: '.result-item',
        problem: `${audit.itemsWithoutRole}/${audit.itemsTotal} résultats sans role="option" dans le listbox`,
        severity: 'moyenne',
        recommendation: 'Ajouter role="option" et aria-selected sur chaque résultat'
      })
    }
    if (!audit.activeDescendant) {
      findings.push({
        element: '#searchInput',
        problem:
          "aria-activedescendant absent : la sélection aux flèches est invisible pour un lecteur d'écran",
        severity: 'moyenne',
        recommendation: "Refléter l'élément sélectionné via aria-activedescendant"
      })
    }
    if (audit.unlabelledToggles > 0) {
      findings.push({
        element: '.toggle-checkbox',
        problem: 'Interrupteur sans nom accessible (title sur le label uniquement)',
        severity: 'moyenne',
        recommendation: 'Ajouter aria-label="Activer/Désactiver le WiFi" sur la checkbox'
      })
    }
  })

  await test.step('parcours 100 % clavier', async () => {
    const input = mainWindow.locator('#searchInput')

    // Recherche, sélection, effacement : uniquement au clavier.
    await input.press('Control+A')
    await input.press('Backspace')
    await input.pressSequentially('2+2')
    await expect(mainWindow.locator('#calculationResult')).toHaveText('= 4')

    await input.press('Control+A')
    await input.press('Backspace')
    await input.pressSequentially('a')

    const results = mainWindow.locator('.result-item')
    if ((await results.count()) >= 2) {
      await input.press('ArrowDown')
      await expect(results.nth(1)).toHaveClass(/selected/)
    }

    await input.press('Escape')
    await expect(input).toHaveValue('')

    // Le bouton de suppression d'historique n'est atteignable qu'à la
    // souris : c'est un manque connu, consigné dans les findings.
    findings.push({
      element: '.delete-history-btn',
      problem: "La suppression d'une entrée d'historique n'est pas accessible au clavier",
      severity: 'mineure',
      recommendation: "Gérer une touche (Suppr) sur l'entrée sélectionnée de l'historique"
    })
  })

  fs.writeFileSync(path.join(QA_DIR, 'a11y.json'), JSON.stringify(findings, null, 2))

  expect(pageErrors).toEqual([])
})
