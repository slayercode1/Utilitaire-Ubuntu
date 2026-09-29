/**
 * Finder - Mémorisation des scans
 *
 * Les scanners sont invoqués à chaque requête du renderer. Sans cache, ouvrir
 * la fenêtre relançait un parcours complet du disque alors que le résultat
 * venait d'être calculé.
 *
 * Les scans sont asynchrones : un parcours synchrone de 50 000 entrées
 * bloquait le processus principal — raccourci global, fenêtre et protocole
 * applicatif compris — pendant toute sa durée. Deux demandes simultanées
 * partagent le même scan, et une version numérote chaque changement réel de
 * contenu, pour que le renderer ne recharge l'index que s'il a changé.
 */

import type { RuntimeValue } from '../../shared/types.js'
import { SCAN_CACHE_TTL } from '../config.js'

/** Clés des scans mémorisés, partagées entre IPC et protocole applicatif. */
export const SCAN_KEYS = {
  applications: 'applications',
  files: 'files'
} as const

/** Fonction de scan, synchrone ou non. */
export type ScanFunction<T> = () => T | Promise<T>

/** Entrée mémorisée, avec sa date d'expiration. */
interface CacheEntry {
  value: RuntimeValue
  expiresAt: number
}

/** Résultats mémorisés, indexés par nom de scan. */
const scanCache = new Map<string, CacheEntry>()

/** Scans en cours, partagés entre demandeurs simultanés. */
const inFlight = new Map<string, Promise<RuntimeValue>>()

/** Version du contenu de chaque scan, incrémentée à chaque changement réel. */
const versions = new Map<string, number>()

/**
 * Incrémenté par `invalidateScanCache` : un scan démarré avant l'invalidation
 * ne doit pas réinstaller un résultat qui vient d'être déclaré périmé.
 */
let epoch = 0

/** Compare deux entrées d'index champ par champ, sans sérialisation. */
function sameRecord(a: RuntimeValue, b: RuntimeValue): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

  const recordA = a as Record<string, RuntimeValue>
  const recordB = b as Record<string, RuntimeValue>
  const keys = Object.keys(recordA)
  if (keys.length !== Object.keys(recordB).length) return false

  return keys.every((key) => recordA[key] === recordB[key])
}

/** Vrai si deux résultats de scan décrivent le même index. */
export function sameScanResult(previous: RuntimeValue, next: RuntimeValue): boolean {
  if (!Array.isArray(previous) || !Array.isArray(next)) return sameRecord(previous, next)
  if (previous.length !== next.length) return false

  for (let i = 0; i < next.length; i++) {
    if (!sameRecord(previous[i], next[i])) return false
  }

  return true
}

/** Lance un scan, ou rejoint celui qui est déjà en cours pour cette clé. */
function runScan<T extends RuntimeValue>(key: string, scanFn: ScanFunction<T>): Promise<T> {
  const running = inFlight.get(key)
  if (running) return running as Promise<T>

  const startedEpoch = epoch
  const previous = scanCache.get(key)

  const scan = Promise.resolve()
    .then(scanFn)
    .then((value) => {
      if (startedEpoch === epoch) {
        scanCache.set(key, { value, expiresAt: Date.now() + SCAN_CACHE_TTL })

        if (!previous || !sameScanResult(previous.value, value)) {
          versions.set(key, (versions.get(key) ?? 0) + 1)
        }
      }
      return value
    })
    .finally(() => {
      if (inFlight.get(key) === scan) inFlight.delete(key)
    })

  inFlight.set(key, scan)
  return scan
}

/**
 * Retourne un scan mémorisé, sans jamais faire attendre pour un simple
 * rafraîchissement : une valeur expirée est servie telle quelle pendant que
 * le scan suivant tourne en arrière-plan. Seul un cache froid est attendu.
 *
 * Adapté aux vérifications d'appartenance (lancement, protocole média), pour
 * lesquelles l'index de la minute précédente suffit.
 */
export function getCachedScan<T extends RuntimeValue>(
  key: string,
  scanFn: ScanFunction<T>
): Promise<T> {
  const cached = scanCache.get(key)

  if (!cached) return runScan(key, scanFn)

  if (cached.expiresAt <= Date.now()) {
    runScan(key, scanFn).catch(() => {
      console.error(`Rafraîchissement du scan ${key} impossible`)
    })
  }

  return Promise.resolve(cached.value as T)
}

/**
 * Retourne un scan à jour : attend un nouveau scan si le cache est froid ou
 * expiré. Destiné au renderer, qui affiche l'index à l'utilisateur.
 */
export function getFreshScan<T extends RuntimeValue>(
  key: string,
  scanFn: ScanFunction<T>
): Promise<T> {
  const cached = scanCache.get(key)

  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value as T)
  }

  return runScan(key, scanFn)
}

/** Version courante du contenu d'un scan (0 tant qu'aucun scan n'a abouti). */
export function getScanVersion(key: string): number {
  return versions.get(key) ?? 0
}

/**
 * Vide les scans mémorisés, par exemple après l'installation d'une application.
 */
export function invalidateScanCache(): void {
  epoch++
  scanCache.clear()
  inFlight.clear()
}
