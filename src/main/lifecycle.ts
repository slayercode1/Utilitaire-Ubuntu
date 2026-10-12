/** Cycle de vie et intégration de session Linux. */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

import { isAutostartEntryDisabled, quoteDesktopExecArgument } from './services/desktop-entry.js'

export function acquireSingleInstanceLock(): boolean {
  return app.requestSingleInstanceLock()
}

/**
 * Commande à inscrire dans l'entrée d'autostart.
 *
 * - AppImage : l'exécutable rapporté est le point de montage éphémère
 *   (/tmp/.mount_…) ; seul $APPIMAGE survit au redémarrage.
 * - Snap : l'exécutable vit sous /snap/<nom>/<révision>/, chemin qui disparaît
 *   au rafraîchissement suivant ; /snap/bin/<nom> désigne toujours la
 *   révision courante et prépare l'environnement du snap.
 */
export function resolveAutostartCommand(
  environment: NodeJS.ProcessEnv,
  executablePath: string
): string {
  const snapName = environment['SNAP_INSTANCE_NAME'] || environment['SNAP_NAME']
  if (environment['SNAP'] && snapName && /^[a-z0-9][a-z0-9_-]*$/.test(snapName)) {
    return `/snap/bin/${snapName}`
  }

  const appImagePath = environment['APPIMAGE']
  if (appImagePath && path.isAbsolute(appImagePath)) return appImagePath

  return executablePath
}

/**
 * Crée atomiquement l'entrée XDG d'autostart dans le profil courant, ou la
 * met à jour (chemin de l'exécutable) tant qu'elle reste active. Une entrée
 * que l'utilisateur a désactivée n'est jamais réécrite : son choix prime.
 * Aucun script d'installation root ne touche au HOME de l'utilisateur.
 */
export async function setupAutoLaunch(): Promise<void> {
  if (!app.isPackaged || process.platform !== 'linux') {
    console.log('Auto-launch ignoré hors paquet Linux')
    return
  }

  try {
    const executablePath = resolveAutostartCommand(process.env, app.getPath('exe'))

    const configuredRoot = process.env['XDG_CONFIG_HOME']
    const configRoot =
      configuredRoot && path.isAbsolute(configuredRoot)
        ? configuredRoot
        : path.join(app.getPath('home'), '.config')
    const autostartDir = path.join(configRoot, 'autostart')
    const target = path.join(autostartDir, 'finder.desktop')
    const temporary = path.join(
      autostartDir,
      `.finder.desktop.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`
    )
    const content = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=Finder',
      'Comment=Application de recherche type Spotlight pour Linux',
      `Exec=${quoteDesktopExecArgument(executablePath)}`,
      'Terminal=false',
      'Categories=Utility;',
      'StartupNotify=false',
      'X-GNOME-Autostart-enabled=true',
      ''
    ].join('\n')

    // Désactivé depuis les réglages du bureau : on ne réactive pas en douce
    const existing = await fs.readFile(target, 'utf8').catch(() => null)
    if (existing !== null && isAutostartEntryDisabled(existing)) {
      console.log("Auto-launch désactivé par l'utilisateur : entrée conservée")
      return
    }

    await fs.mkdir(autostartDir, { recursive: true, mode: 0o700 })

    try {
      await fs.writeFile(temporary, content, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx'
      })
      await fs.rename(temporary, target)
    } finally {
      await fs.rm(temporary, { force: true })
    }

    console.log('Auto-launch configuré avec succès')
  } catch {
    console.error("Erreur lors de la configuration de l'auto-launch")
  }
}
