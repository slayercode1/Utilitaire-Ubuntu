import { describe, expect, it } from 'vitest'

import { foldForSearch } from '../../src/renderer/features/search/fold.js'

describe('foldForSearch', () => {
  it('ignore les accents et la casse', () => {
    expect(foldForSearch('Paramètres')).toBe(foldForSearch('parametres'))
    expect(foldForSearch('ÉCRAN')).toBe('ecran')
  })

  it('replie aussi les cédilles et les ligatures décomposables', () => {
    expect(foldForSearch('Français')).toBe('francais')
  })

  it('conserve les caractères sans équivalent non accentué', () => {
    expect(foldForSearch('Œuvre ß 🔥 مرحبا')).toBe('œuvre ß 🔥 مرحبا')
  })

  it('renvoie la même forme pour une chaîne déjà repliée (cache)', () => {
    expect(foldForSearch('firefox')).toBe('firefox')
    expect(foldForSearch('firefox')).toBe('firefox')
  })
})
