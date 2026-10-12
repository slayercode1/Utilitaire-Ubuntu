import { describe, expect, it } from 'vitest'

import {
  isAutostartEntryDisabled,
  quoteDesktopExecArgument
} from '../../src/main/services/desktop-entry.js'

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

describe('isAutostartEntryDisabled', () => {
  const entry = (extra: string) =>
    ['[Desktop Entry]', 'Type=Application', 'Name=Finder', 'Exec="/opt/Finder/finder"', extra].join(
      '\n'
    )

  it('considère active une entrée sans désactivation', () => {
    expect(isAutostartEntryDisabled(entry('X-GNOME-Autostart-enabled=true'))).toBe(false)
  })

  it('reconnaît la bascule GNOME', () => {
    expect(isAutostartEntryDisabled(entry('X-GNOME-Autostart-enabled=false'))).toBe(true)
  })

  it('reconnaît Hidden=true de la spécification XDG, quelle que soit la casse', () => {
    expect(isAutostartEntryDisabled(entry('Hidden=True'))).toBe(true)
  })

  it('ignore les clés hors du groupe [Desktop Entry] et les commentaires', () => {
    const content = [entry(''), '[Desktop Action Other]', 'Hidden=true', '# Hidden=true'].join('\n')
    expect(isAutostartEntryDisabled(content)).toBe(false)
  })

  it('tolère les fins de ligne Windows', () => {
    expect(isAutostartEntryDisabled(entry('Hidden=true').replace(/\n/g, '\r\n'))).toBe(true)
  })
})
