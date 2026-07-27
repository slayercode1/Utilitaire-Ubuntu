import { describe, expect, it } from 'vitest'

import { quoteDesktopExecArgument } from '../../src/main/services/desktop-entry.js'

describe('quoteDesktopExecArgument', () => {
  it('entoure le chemin de guillemets', () => {
    expect(quoteDesktopExecArgument('/opt/Finder App/finder')).toBe('"/opt/Finder App/finder"')
  })

  it('échappe les caractères spéciaux et les codes de champ', () => {
    expect(quoteDesktopExecArgument('/opt/$app/100%/`finder`')).toBe(
      '"/opt/\\$app/100%%/\\`finder\\`"'
    )
  })

  it('refuse les caractères de contrôle', () => {
    expect(() => quoteDesktopExecArgument('/opt/finder\ncommande')).toThrow('Control character')
  })
})
