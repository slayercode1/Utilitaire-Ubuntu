/**
 * Tests de l'appariement requête/réponse du processus de position du curseur.
 *
 * Une réponse tardive était auparavant livrée à la requête suivante : après
 * un seul dépassement de délai, chaque ouverture recevait la position de la
 * précédente, et la fenêtre s'ouvrait sur le mauvais écran.
 */

import { describe, expect, it } from 'vitest'

import { ResponseQueue } from '../../src/main/scanners/cursor-position.js'

describe('ResponseQueue', () => {
  it('livre chaque ligne à la requête qui l’a demandée, dans l’ordre', () => {
    const queue = new ResponseQueue()
    const received: string[] = []

    queue.expect((line) => received.push(`a:${line}`))
    queue.expect((line) => received.push(`b:${line}`))
    queue.feed('10 20\n30 40\n')

    expect(received).toEqual(['a:10 20', 'b:30 40'])
  })

  it('reconstitue une ligne découpée entre deux paquets', () => {
    const queue = new ResponseQueue()
    const received: string[] = []

    queue.expect((line) => received.push(line))
    queue.feed('1920 ')
    expect(received).toEqual([])
    queue.feed('540\n')

    expect(received).toEqual(['1920 540'])
  })

  it('ne livre pas une réponse tardive à la requête suivante', () => {
    const queue = new ResponseQueue()
    let expiredAnswered = false
    const fresh: string[] = []

    // Première requête expirée : sa réponse arrive après la deuxième requête.
    queue.expect(() => {
      expiredAnswered = true
    })
    queue.expect((line) => fresh.push(line))

    queue.feed('0 0\n') // réponse tardive de la première requête
    queue.feed('2500 300\n') // vraie réponse de la seconde

    expect(expiredAnswered).toBe(true)
    expect(fresh).toEqual(['2500 300'])
  })

  it('ignore une ligne sans requête en attente', () => {
    const queue = new ResponseQueue()
    const received: string[] = []

    queue.feed('5 5\n')
    queue.expect((line) => received.push(line))
    queue.feed('6 6\n')

    expect(received).toEqual(['6 6'])
  })
})
