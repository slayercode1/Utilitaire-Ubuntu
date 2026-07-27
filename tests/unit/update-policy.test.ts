import { describe, expect, it } from 'vitest'

import {
  canUseAutomaticUpdates,
  FIRST_UPDATE_CHECK_DELAY_MS,
  UPDATE_CHECK_INTERVAL_MS
} from '../../src/main/services/update-policy.js'

const linuxPackage = {
  isPackaged: true,
  platform: 'linux' as const,
  environment: {},
  updateConfigExists: true
}

describe('politique de mise à jour', () => {
  it('active les paquets Linux produits pour GitHub Releases', () => {
    expect(canUseAutomaticUpdates(linuxPackage)).toBe(true)
  })

  it('reste inactive en développement ou sans métadonnées', () => {
    expect(canUseAutomaticUpdates({ ...linuxPackage, isPackaged: false })).toBe(false)
    expect(
      canUseAutomaticUpdates({
        ...linuxPackage,
        updateConfigExists: false
      })
    ).toBe(false)
  })

  it('laisse Snap et Flatpak utiliser leur gestionnaire natif', () => {
    expect(
      canUseAutomaticUpdates({
        ...linuxPackage,
        environment: { SNAP: '/snap/finder/current' }
      })
    ).toBe(false)
    expect(
      canUseAutomaticUpdates({
        ...linuxPackage,
        environment: { FLATPAK_ID: 'io.github.slayercode1.finder' }
      })
    ).toBe(false)
  })

  it('refuse les plateformes qui ne sont pas publiées par ce workflow', () => {
    expect(
      canUseAutomaticUpdates({
        ...linuxPackage,
        platform: 'win32'
      })
    ).toBe(false)
  })

  it('contrôle après le démarrage puis au moins toutes les six heures', () => {
    expect(FIRST_UPDATE_CHECK_DELAY_MS).toBeGreaterThan(0)
    expect(UPDATE_CHECK_INTERVAL_MS).toBeLessThanOrEqual(6 * 60 * 60 * 1000)
  })
})
