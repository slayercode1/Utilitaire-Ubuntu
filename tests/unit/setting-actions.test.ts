/**
 * Tests de l'exécution des actions de paramètres système.
 *
 * Le point central est la stratégie de repli : les commandes déclarées visent
 * GNOME, avec des variantes XFCE et KDE. Vérifier qu'elles sont réellement
 * tentées demandait auparavant de disposer d'un autre environnement de bureau.
 */

import { describe, it, expect, vi } from 'vitest'

import type {
  SettingActionDefinition,
  SettingDefinition
} from '../../src/main/services/setting-actions.js'
import {
  findAction,
  collectCommandCandidates,
  executeSettingAction
} from '../../src/main/services/setting-actions.js'

/** Découpe naïve, suffisante pour les commandes de test. */
const parseArguments = (command: string): string[] => command.split(/\s+/).filter(Boolean)

describe('findAction', () => {
  const setting = { actions: [{ id: 'toggle' }, { id: 'settings' }] }

  it('retrouve une action par son identifiant', () => {
    expect(findAction(setting, 'settings')).toEqual({ id: 'settings' })
  })

  it('retourne null pour un identifiant inconnu', () => {
    expect(findAction(setting, 'absent')).toBeNull()
  })

  it('tolère un paramètre absent ou malformé', () => {
    expect(findAction(null, 'toggle')).toBeNull()
    expect(findAction({}, 'toggle')).toBeNull()
    // Entrée volontairement malformée : la fonction doit la tolérer
    expect(findAction({ actions: 'pas un tableau' } as unknown as SettingDefinition, 'toggle')).toBeNull()
  })
})

describe('collectCommandCandidates', () => {
  it('ordonne la commande principale avant ses replis', () => {
    const action: SettingActionDefinition = {
      id: 'settings',
      command: 'gnome-control-center wifi',
      commandAlt: 'xfce4-settings-manager',
      commandAlt2: 'systemsettings5'
    }

    expect(collectCommandCandidates(action)).toEqual([
      'gnome-control-center wifi',
      'xfce4-settings-manager',
      'systemsettings5'
    ])
  })

  it('ignore les replis absents', () => {
    expect(collectCommandCandidates({ id: 'x', command: 'seule' })).toEqual(['seule'])
  })

  it('écarte une commande sous forme de fonction', () => {
    expect(collectCommandCandidates({ id: 'x', command: async () => undefined })).toEqual([])
  })

  it('supprime les espaces de bordure', () => {
    expect(collectCommandCandidates({ id: 'x', command: '  gedit  ' })).toEqual(['gedit'])
  })
})

describe('executeSettingAction — commandes shell', () => {
  const setting = {
    actions: [{
      id: 'settings',
      command: 'gnome-control-center wifi',
      commandAlt: 'xfce4-settings-manager',
      commandAlt2: 'systemsettings5'
    }]
  }

  it('lance la commande principale quand elle aboutit', async () => {
    const launch = vi.fn().mockReturnValue(true)

    const r = await executeSettingAction(setting, 'settings', { parseArguments, launch })

    expect(r.ok).toBe(true)
    expect(launch).toHaveBeenCalledTimes(1)
    expect(launch.mock.calls[0]![0]).toEqual(['gnome-control-center', 'wifi'])
  })

  it('bascule sur le repli quand la principale échoue', async () => {
    // Régression : la version précédente ignorait le retour de launch et
    // considérait la première commande comme réussie, si bien que les
    // environnements XFCE et KDE n'étaient jamais atteints.
    const launch = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)

    const r = await executeSettingAction(setting, 'settings', { parseArguments, launch })

    expect(r.ok).toBe(true)
    expect(launch).toHaveBeenCalledTimes(2)
    expect(launch.mock.calls[1]![0]).toEqual(['xfce4-settings-manager'])
  })

  it('tente toutes les alternatives avant d\'abandonner', async () => {
    const launch = vi.fn().mockReturnValue(false)

    const r = await executeSettingAction(setting, 'settings', { parseArguments, launch })

    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toBe('all-commands-failed')
    expect(launch).toHaveBeenCalledTimes(3)
  })

  it('poursuit malgré une exception du lanceur', async () => {
    const launch = vi.fn()
      .mockImplementationOnce(() => { throw new Error('binaire absent') })
      .mockReturnValueOnce(true)

    const r = await executeSettingAction(setting, 'settings', { parseArguments, launch })

    expect(r.ok).toBe(true)
    expect(launch).toHaveBeenCalledTimes(2)
  })
})

describe('executeSettingAction — actions programmées', () => {
  it('exécute la fonction et retourne son résultat', async () => {
    const setting = {
      actions: [{ id: 'toggle', command: async () => 'WiFi désactivé' }]
    }
    const launch = vi.fn()

    const r = await executeSettingAction(setting, 'toggle', { parseArguments, launch })

    expect(r).toEqual({ ok: true, result: 'WiFi désactivé' })
    expect(launch).not.toHaveBeenCalled()
  })

  it('signale un échec sans laisser remonter l\'exception', async () => {
    const setting = {
      actions: [{
        id: 'toggle',
        command: async () => { throw new Error('nmcli indisponible') }
      }]
    }

    const r = await executeSettingAction(setting, 'toggle', {
      parseArguments,
      launch: vi.fn()
    })

    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toBe('action-failed')
    expect(r.ok === false && r.result).toBe('nmcli indisponible')
  })
})

describe('executeSettingAction — cas limites', () => {
  it('signale une action inconnue', async () => {
    const r = await executeSettingAction({ actions: [] }, 'absent', {
      parseArguments,
      launch: vi.fn()
    })

    expect(r).toEqual({ ok: false, reason: 'action-not-found' })
  })

  it('signale une action sans commande exploitable', async () => {
    const r = await executeSettingAction({ actions: [{ id: 'vide' }] }, 'vide', {
      parseArguments,
      launch: vi.fn()
    })

    expect(r).toEqual({ ok: false, reason: 'no-command' })
  })
})
