/**
 * Expressions mal formées : la calculatrice doit se taire plutôt qu'afficher
 * un résultat tronqué présenté comme exact.
 */

import { describe, expect, it } from 'vitest'

import {
  evaluateMath,
  isMathExpression
} from '../../src/renderer/features/conversion/evaluate-math.js'

describe('evaluateMath — expressions mal formées', () => {
  it.each([
    ['2)+3', 'parenthèse fermante orpheline'],
    ['(2+3', 'parenthèse non fermée'],
    ['(2+3*4', 'parenthèse non fermée en fin'],
    ['1..2+1', 'nombre à deux points'],
    ['1.2.3+1', 'nombre à plusieurs points'],
    ['2+', 'opérande manquant'],
    ['*3', 'opérateur initial'],
    ['()', 'parenthèses vides'],
    ['.+1', 'point isolé']
  ])('%s → null (%s)', (expression) => {
    expect(evaluateMath(expression)).toBeNull()
  })

  it.each([
    ['.5+1', 1.5],
    ['5.+1', 6],
    ['((1+2))*3', 9],
    ['2^-1', 0.5],
    ['3--2', 5],
    ['10 / 4', 2.5]
  ])('%s → %d reste accepté', (expression, expected) => {
    expect(evaluateMath(expression)).toBe(expected)
  })
})

describe('isMathExpression — dates saisies comme recherche', () => {
  it.each(['2024-01-15', '15/01/2024', '15.01.2024', '2024/1/5'])(
    '%s est une recherche, pas un calcul',
    (query) => {
      expect(isMathExpression(query)).toBe(false)
    }
  )

  it.each(['2024-15', '10/2', '12-3-4+1', '1.5*2'])('%s reste un calcul', (query) => {
    expect(isMathExpression(query)).toBe(true)
  })
})

describe('evaluateMath — grands résultats', () => {
  it('ne transforme pas un grand résultat fini en Infinity', () => {
    const result = evaluateMath('2^1000')
    expect(result).not.toBeNull()
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeCloseTo(2 ** 1000, -290)
  })

  it('arrondit toujours les petits résultats', () => {
    expect(evaluateMath('0.1+0.2')).toBe(0.3)
  })
})

describe('evaluateMath — écritures courantes', () => {
  it.each([
    ['3 x 4', 12],
    ['3 X 4', 12],
    ['3×4', 12],
    ['12÷4', 3],
    ['2**3', 8],
    ['= 2+2', 4],
    ['(1+2) x 3', 9]
  ])('%s vaut %s', (expression, expected) => {
    expect(isMathExpression(expression)).toBe(true)
    expect(evaluateMath(expression)).toBe(expected)
  })

  it('laisse une résolution d’image chercher ses fichiers', () => {
    expect(isMathExpression('1920x1080')).toBe(false)
    expect(isMathExpression('wallpaper 1920x1080')).toBe(false)
  })

  it('ne prend pas un mot contenant x pour une multiplication', () => {
    expect(isMathExpression('xterm')).toBe(false)
    expect(isMathExpression('3 xterm')).toBe(false)
  })
})
