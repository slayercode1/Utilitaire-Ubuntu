/**
 * Tests de caractérisation des conversions et du calcul.
 *
 * Ces fonctions vivaient au milieu du renderer, mêlées au rendu DOM : elles
 * n'étaient pas atteignables sans navigateur. Les valeurs attendues ci-dessous
 * décrivent le comportement existant, pour que l'extraction le préserve.
 */

import { describe, expect, it } from 'vitest'

import { tryConversion } from '../../src/renderer/features/conversion/convert-units.js'
import {
  evaluateMath,
  isMathExpression
} from '../../src/renderer/features/conversion/evaluate-math.js'

describe('tryConversion — longueurs', () => {
  it('convertit les centimètres en mètres', () => {
    expect(tryConversion('100 cm to m')?.result).toBe('1 M')
  })

  it('convertit les kilomètres en mètres', () => {
    expect(tryConversion('2 km to m')?.result).toBe('2000 M')
  })

  it('produit une égalité complète en description', () => {
    expect(tryConversion('100 cm to m')?.description).toBe('100 CM = 1 M')
  })
})

describe('tryConversion — températures', () => {
  it('applique la formule Celsius vers Fahrenheit', () => {
    // Formule et non facteur : 0 °C ne vaut pas 0 °F
    expect(tryConversion('0 c to f')?.result).toBe('32 F')
    expect(tryConversion('100 c to f')?.result).toBe('212 F')
  })

  it('convertit Fahrenheit vers Celsius', () => {
    expect(tryConversion('32 f to c')?.result).toBe('0 C')
  })

  it('convertit Celsius vers Kelvin', () => {
    expect(tryConversion('0 c to k')?.result).toBe('273.15 K')
  })
})

describe('tryConversion — autres unités', () => {
  it('convertit des volumes', () => {
    expect(tryConversion('100 ml to cl')?.result).toBe('10 CL')
  })

  it('convertit des unités de données en base décimale', () => {
    // La table applique le facteur 1000, non 1024 : 1 Go = 1000 Mo
    expect(tryConversion('1000 mb to gb')?.result).toBe('1 GB')
  })

  it('accepte la virgule comme séparateur décimal', () => {
    expect(tryConversion('1,5 m to cm')?.result).toBe('150 CM')
  })
})

describe('tryConversion — requêtes non convertibles', () => {
  it('retourne null si la forme ne correspond pas', () => {
    expect(tryConversion('bonjour')).toBeNull()
    expect(tryConversion('100 cm')).toBeNull()
    expect(tryConversion('to m')).toBeNull()
  })

  it('retourne null pour une unité inconnue', () => {
    expect(tryConversion('100 xyz to abc')).toBeNull()
  })
})

describe('isMathExpression', () => {
  it('reconnaît les opérations élémentaires', () => {
    expect(isMathExpression('2+2')).toBe(true)
    expect(isMathExpression('10 * 5')).toBe(true)
    expect(isMathExpression('(3+4)/2')).toBe(true)
  })

  it('écarte le texte ordinaire', () => {
    expect(isMathExpression('firefox')).toBe(false)
    expect(isMathExpression('')).toBe(false)
  })
})

describe('evaluateMath', () => {
  it('respecte la priorité des opérateurs', () => {
    expect(evaluateMath('2+3*4')).toBe(14)
  })

  it('respecte les parenthèses', () => {
    expect(evaluateMath('(2+3)*4')).toBe(20)
  })

  it('gère les puissances', () => {
    expect(evaluateMath('2^10')).toBe(1024)
  })

  it('gère le modulo', () => {
    expect(evaluateMath('10%3')).toBe(1)
  })

  it('gère les nombres décimaux', () => {
    expect(evaluateMath('0.1+0.2')).toBeCloseTo(0.3, 10)
  })

  it('gère les nombres négatifs', () => {
    expect(evaluateMath('-5+10')).toBe(5)
  })

  it("n'utilise pas eval : une expression invalide ne s'exécute pas", () => {
    // Une chaîne de code arbitraire ne doit produire aucun effet
    const resultat = evaluateMath('process.exit(1)')
    expect(resultat === null || Number.isNaN(resultat)).toBe(true)
  })
})
