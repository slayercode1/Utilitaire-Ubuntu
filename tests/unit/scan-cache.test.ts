/**
 * Mémorisation des scans : TTL, recalcul et invalidation.
 *
 * Le module lit SCAN_CACHE_TTL depuis config.ts, qui importe `electron` pour
 * résoudre le chemin de l'icône : l'API `app` est donc simulée, aucune autre
 * partie d'Electron n'étant nécessaire ici.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/tmp'
  }
}))

import { SCAN_CACHE_TTL } from '../../src/main/config.js'
import {
  getCachedScan,
  invalidateScanCache,
  SCAN_KEYS
} from '../../src/main/services/scan-cache.js'

describe('getCachedScan', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    invalidateScanCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('appelle la fonction de scan quand le cache est froid', () => {
    const scan = vi.fn(() => ['a'])

    expect(getCachedScan('films', scan)).toEqual(['a'])
    expect(scan).toHaveBeenCalledTimes(1)
  })

  it('retourne la valeur mémorisée sans rappeler le scan', () => {
    const scan = vi.fn(() => ['a'])

    getCachedScan('films', scan)
    const second = getCachedScan('films', scan)

    expect(second).toEqual(['a'])
    expect(scan).toHaveBeenCalledTimes(1)
  })

  it('recalcule une fois le TTL expiré', () => {
    const scan = vi.fn(() => ['a'])

    getCachedScan('films', scan)
    vi.advanceTimersByTime(SCAN_CACHE_TTL + 1)
    getCachedScan('films', scan)

    expect(scan).toHaveBeenCalledTimes(2)
  })

  it('ne mélange pas deux clés distinctes', () => {
    const scanA = vi.fn(() => 'A')
    const scanB = vi.fn(() => 'B')

    expect(getCachedScan(SCAN_KEYS.applications, scanA)).toBe('A')
    expect(getCachedScan(SCAN_KEYS.files, scanB)).toBe('B')
    expect(scanA).toHaveBeenCalledTimes(1)
    expect(scanB).toHaveBeenCalledTimes(1)
  })

  it('invalidateScanCache force le recalcul immédiat', () => {
    const scan = vi.fn(() => ['a'])

    getCachedScan('films', scan)
    invalidateScanCache()
    getCachedScan('films', scan)

    expect(scan).toHaveBeenCalledTimes(2)
  })
})
