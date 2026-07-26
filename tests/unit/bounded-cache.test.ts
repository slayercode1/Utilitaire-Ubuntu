/**
 * Tests du cache borné.
 *
 * Ce cache remplace des Map sans limite qui retenaient l'index des thèmes
 * d'icônes — plusieurs dizaines de milliers d'entrées — pendant toute la durée
 * de vie de l'application, qui reste résidente en arrière-plan.
 */

import { describe, it, expect } from 'vitest'

import { BoundedCache } from '../../src/main/services/bounded-cache.js'

describe('BoundedCache — comportement de base', () => {
  it('restitue une valeur mémorisée', () => {
    const cache = new BoundedCache<string, number>(3)
    cache.set('a', 1)

    expect(cache.get('a')).toBe(1)
  })

  it('retourne undefined pour une clé absente', () => {
    const cache = new BoundedCache<string, number>(3)

    expect(cache.get('absent')).toBeUndefined()
  })

  it('distingue une valeur nulle d\'une absence', () => {
    // findIcon mémorise null pour les icônes introuvables : cette distinction
    // évite de relancer une recherche coûteuse à chaque appel.
    const cache = new BoundedCache<string, string | null>(3)
    cache.set('introuvable', null)

    expect(cache.has('introuvable')).toBe(true)
    expect(cache.get('introuvable')).toBeNull()
  })

  it('remplace une valeur existante sans augmenter la taille', () => {
    const cache = new BoundedCache<string, number>(3)
    cache.set('a', 1)
    cache.set('a', 2)

    expect(cache.get('a')).toBe(2)
    expect(cache.size).toBe(1)
  })

  it('refuse une borne nulle ou négative', () => {
    expect(() => new BoundedCache(0)).toThrow(RangeError)
    expect(() => new BoundedCache(-1)).toThrow(RangeError)
  })
})

describe('BoundedCache — éviction', () => {
  it('ne dépasse jamais la borne', () => {
    const cache = new BoundedCache<number, number>(3)

    for (let i = 0; i < 100; i++) {
      cache.set(i, i)
    }

    expect(cache.size).toBe(3)
  })

  it('évince l\'entrée la moins récemment utilisée', () => {
    const cache = new BoundedCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    cache.set('d', 4)

    expect(cache.has('a')).toBe(false)
    expect(cache.has('d')).toBe(true)
  })

  it('une lecture protège une entrée de l\'éviction', () => {
    const cache = new BoundedCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    // 'a' redevient la plus récemment utilisée
    cache.get('a')
    cache.set('d', 4)

    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
  })

  it('has ne modifie pas l\'ancienneté', () => {
    const cache = new BoundedCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)

    // Contrairement à get, has ne doit pas rajeunir 'a'
    cache.has('a')
    cache.set('c', 3)

    expect(cache.has('a')).toBe(false)
  })
})

describe('BoundedCache — libération', () => {
  it('vide entièrement le cache', () => {
    const cache = new BoundedCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()

    expect(cache.size).toBe(0)
    expect(cache.get('a')).toBeUndefined()
  })

  it('reste utilisable après vidage', () => {
    const cache = new BoundedCache<string, number>(2)
    cache.set('a', 1)
    cache.clear()
    cache.set('b', 2)

    expect(cache.get('b')).toBe(2)
  })
})
