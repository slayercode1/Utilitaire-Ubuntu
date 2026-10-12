/** Encode un argument selon la grammaire Exec= de Desktop Entry. */
export function quoteDesktopExecArgument(value: string): string {
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('Control character in executable path')
  }

  const escaped = value.replace(/%/g, '%%').replace(/["\\\x60$]/g, (character) => '\\' + character)

  return '"' + escaped + '"'
}

/**
 * Indique si l'utilisateur a désactivé une entrée d'autostart.
 *
 * Deux conventions coexistent : `Hidden=true` (spécification XDG Autostart,
 * utilisée par KDE et la plupart des bureaux) et
 * `X-GNOME-Autostart-enabled=false` (bascule de GNOME). Seules les clés du
 * groupe [Desktop Entry] comptent ; les valeurs booléennes sont insensibles à
 * la casse, comme le tolèrent les bureaux.
 */
export function isAutostartEntryDisabled(content: string): boolean {
  let inMainGroup = false

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('[')) {
      inMainGroup = line === '[Desktop Entry]'
      continue
    }
    if (!inMainGroup || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line
      .slice(separator + 1)
      .trim()
      .toLowerCase()

    if (key === 'Hidden' && value === 'true') return true
    if (key === 'X-GNOME-Autostart-enabled' && value === 'false') return true
  }

  return false
}
