/**
 * Tests du lancement de processus externes, avec de vrais processus.
 *
 * Un faux lanceur ne suffit pas : `spawn` signale un programme introuvable par
 * un événement asynchrone, et non par une exception. Les tests des replis de
 * paramètres passaient avec un faux lanceur renvoyant `false`, alors que le
 * vrai renvoyait `true` puis faisait tomber l'application.
 */

import { describe, expect, it } from 'vitest'

import { launchDetachedProcess } from '../../src/main/services/launcher.js'
import { executeSettingAction } from '../../src/main/services/setting-actions.js'
import { parseCommandArguments } from '../../src/main/services/validation.js'

const MISSING_PROGRAM = 'finder-programme-inexistant-7f3a'

describe('launchDetachedProcess', () => {
  it('signale le démarrage effectif d’un programme présent', async () => {
    await expect(launchDetachedProcess(['true'], 'test')).resolves.toBe(true)
  })

  it('signale un programme introuvable sans exception non rattrapée', async () => {
    // Avant correction : retour `true`, puis ENOENT non rattrapé qui faisait
    // échouer la suite (et quitter Finder via le gestionnaire global).
    await expect(launchDetachedProcess([MISSING_PROGRAM], 'test')).resolves.toBe(false)
  })

  it('refuse une liste d’arguments vide', async () => {
    await expect(launchDetachedProcess([], 'test')).resolves.toBe(false)
  })
})

describe('executeSettingAction avec le vrai lanceur', () => {
  it('bascule sur le repli quand le programme principal est absent', async () => {
    const outcome = await executeSettingAction(
      {
        actions: [{ id: 'settings', command: `${MISSING_PROGRAM} wifi`, commandAlt: 'true' }]
      },
      'settings',
      { parseArguments: parseCommandArguments, launch: launchDetachedProcess }
    )

    expect(outcome).toEqual({ ok: true, result: 'true' })
  })

  it('échoue proprement quand aucune variante n’existe', async () => {
    const outcome = await executeSettingAction(
      { actions: [{ id: 'settings', command: MISSING_PROGRAM, commandAlt: MISSING_PROGRAM }] },
      'settings',
      { parseArguments: parseCommandArguments, launch: launchDetachedProcess }
    )

    expect(outcome).toEqual({ ok: false, reason: 'all-commands-failed' })
  })
})
