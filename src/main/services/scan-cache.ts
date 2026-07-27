/**
 * Finder - Mémorisation des scans
 *
 * Les scanners sont invoqués à chaque requête du renderer. Sans cache, ouvrir
 * la fenêtre relançait un parcours complet du disque alors que le résultat
 * venait d'être calculé.
 */

import type { RuntimeValue } from '../../shared/types.js'
import { SCAN_CACHE_TTL } from '../config.js'

/** Clés des scans mémorisés, partagées entre IPC et protocole applicatif. */
export const SCAN_KEYS = {
  applications: 'applications',
  files: 'files'
} as const

/** Entrée mémorisée, avec sa date d'expiration. */
interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/** Résultats mémorisés, indexés par nom de scan. */
const scanCache = new Map<string, CacheEntry<RuntimeValue>>()

/**
 * Retourne un scan mémorisé, en le recalculant s'il a expiré.
 *
 * @param key - Identifiant du scan
 * @param scanFn - Fonction appelée lorsque le cache est froid ou périmé
 */
export function getCachedScan<T extends RuntimeValue>(key: string, scanFn: () => T): T {
  const cached = scanCache.get(key)
  const now = Date.now()

  if (cached && cached.expiresAt > now) {
    return cached.value as T
  }

  const value = scanFn()
  scanCache.set(key, { value, expiresAt: now + SCAN_CACHE_TTL })

  return value
}

/**
 * Vide les scans mémorisés, par exemple après l'installation d'une application.
 */
export function invalidateScanCache(): void {
  scanCache.clear()
}
