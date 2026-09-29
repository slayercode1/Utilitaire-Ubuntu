/**
 * Mémorisation des scans : TTL, recalcul, invalidation, scans partagés et
 * versions de contenu.
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
  getFreshScan,
  getScanVersion,
  invalidateScanCache,
  SCAN_KEYS,
  sameScanResult
} from '../../src/main/services/scan-cache.js'

beforeEach(() => {
  vi.useFakeTimers()
  invalidateScanCache()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getCachedScan', () => {
  it('appelle la fonction de scan quand le cache est froid', async () => {
    const scan = vi.fn(() => ['a'])

    await expect(getCachedScan('films', scan)).resolves.toEqual(['a'])
    expect(scan).toHaveBeenCalledTimes(1)
  })

  it('retourne la valeur mémorisée sans rappeler le scan', async () => {
    const scan = vi.fn(() => ['a'])

    await getCachedScan('films', scan)
    await expect(getCachedScan('films', scan)).resolves.toEqual(['a'])
    expect(scan).toHaveBeenCalledTimes(1)
  })

  it('partage un scan en cours entre demandeurs simultanés', async () => {
    const scan = vi.fn(async () => ['a'])

    const [first, second] = await Promise.all([
      getCachedScan('films', scan),
      getCachedScan('films', scan)
    ])

    expect(first).toEqual(['a'])
    expect(second).toEqual(['a'])
    expect(scan).toHaveBeenCalledTimes(1)
  })

  it('sert la valeur expirée sans attendre, et rafraîchit en arrière-plan', async () => {
    let contenu = ['ancien']
    const scan = vi.fn(async () => contenu)

    await getCachedScan('films', scan)
    const base = getScanVersion('films')
    vi.advanceTimersByTime(SCAN_CACHE_TTL + 1)
    contenu = ['nouveau']

    await expect(getCachedScan('films', scan)).resolves.toEqual(['ancien'])
    expect(scan).toHaveBeenCalledTimes(2)

    await vi.waitFor(() => expect(getScanVersion('films')).toBe(base + 1))
    await expect(getCachedScan('films', scan)).resolves.toEqual(['nouveau'])
  })

  it('ne mélange pas deux clés distinctes', async () => {
    const scanA = vi.fn(() => 'A')
    const scanB = vi.fn(() => 'B')

    await expect(getCachedScan(SCAN_KEYS.applications, scanA)).resolves.toBe('A')
    await expect(getCachedScan(SCAN_KEYS.files, scanB)).resolves.toBe('B')
    expect(scanA).toHaveBeenCalledTimes(1)
    expect(scanB).toHaveBeenCalledTimes(1)
  })

  it('propage l’échec d’un scan à froid', async () => {
    await expect(getCachedScan('films', () => Promise.reject(new Error('disque')))).rejects.toThrow(
      'disque'
    )
  })
})

describe('getFreshScan', () => {
  it('attend un nouveau scan une fois le TTL expiré', async () => {
    let contenu = ['ancien']
    const scan = vi.fn(async () => contenu)

    await getFreshScan('films', scan)
    vi.advanceTimersByTime(SCAN_CACHE_TTL + 1)
    contenu = ['nouveau']

    await expect(getFreshScan('films', scan)).resolves.toEqual(['nouveau'])
    expect(scan).toHaveBeenCalledTimes(2)
  })
})

describe('invalidateScanCache', () => {
  it('force le recalcul immédiat', async () => {
    const scan = vi.fn(() => ['a'])

    await getCachedScan('films', scan)
    invalidateScanCache()
    await getCachedScan('films', scan)

    expect(scan).toHaveBeenCalledTimes(2)
  })

  it('écarte le résultat d’un scan démarré avant l’invalidation', async () => {
    let terminer: (value: string[]) => void = () => {}
    const lent = new Promise<string[]>((resolve) => {
      terminer = resolve
    })

    const ancien = getCachedScan('films', () => lent)
    invalidateScanCache()
    terminer(['périmé'])
    await ancien

    await expect(getCachedScan('films', () => ['frais'])).resolves.toEqual(['frais'])
  })
})

describe('versions de contenu', () => {
  it('n’incrémente la version que si le contenu change réellement', async () => {
    let contenu = [{ path: '/a', type: 'file' }]
    const scan = async () => contenu.map((entry) => ({ ...entry }))

    await getFreshScan('films', scan)
    const base = getScanVersion('films')

    vi.advanceTimersByTime(SCAN_CACHE_TTL + 1)
    await getFreshScan('films', scan)
    expect(getScanVersion('films')).toBe(base)

    contenu = [{ path: '/b', type: 'file' }]
    vi.advanceTimersByTime(SCAN_CACHE_TTL + 1)
    await getFreshScan('films', scan)
    expect(getScanVersion('films')).toBe(base + 1)
  })

  it('sameScanResult compare les entrées champ par champ', () => {
    expect(sameScanResult([{ a: 1 }], [{ a: 1 }])).toBe(true)
    expect(sameScanResult([{ a: 1 }], [{ a: 2 }])).toBe(false)
    expect(sameScanResult([{ a: 1 }], [{ a: 1, b: 2 }])).toBe(false)
    expect(sameScanResult([{ a: 1 }], [{ a: 1 }, { a: 1 }])).toBe(false)
    expect(sameScanResult('x', 'x')).toBe(true)
  })
})
