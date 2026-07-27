/** Politique pure déterminant si Finder peut gérer sa propre mise à jour. */

/** Contexte minimal nécessaire pour décider du gestionnaire de mise à jour. */
export interface UpdateRuntime {
  isPackaged: boolean
  platform: NodeJS.Platform
  environment: NodeJS.ProcessEnv
  updateConfigExists: boolean
}

/** Délai avant le premier contrôle, pour ne pas ralentir le démarrage. */
export const FIRST_UPDATE_CHECK_DELAY_MS = 15_000

/** Finder reste résident : il revérifie périodiquement la release publiée. */
export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/**
 * Autorise le client intégré uniquement dans les paquets Linux produits par
 * electron-builder. Snap et Flatpak possèdent leur propre canal transactionnel.
 */
export function canUseAutomaticUpdates(runtime: UpdateRuntime): boolean {
  if (!runtime.isPackaged || runtime.platform !== 'linux') return false
  if (!runtime.updateConfigExists) return false

  const { environment } = runtime
  if (environment['SNAP'] || environment['SNAP_NAME']) return false
  if (environment['FLATPAK_ID']) return false

  return true
}
