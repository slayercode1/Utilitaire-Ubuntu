/** Téléchargement et installation des releases Linux publiées sur GitHub. */

import fs from 'node:fs'
import path from 'node:path'

import { app, dialog, net } from 'electron'
// `autoUpdater` doit être importé en export nommé : le paquet CommonJS marque
// `__esModule` sans fournir d'export `default`, si bien qu'un import par défaut
// vaut `undefined` à l'exécution dans les builds empaquetées — et uniquement
// là, puisque `setupAutoUpdates` sort avant d'y toucher hors paquet.
import { type AppUpdater, autoUpdater, type UpdateInfo } from 'electron-updater'

import { verify as verifySigstoreBundle } from 'sigstore'

import {
  canUseAutomaticUpdates,
  FIRST_UPDATE_CHECK_DELAY_MS,
  UPDATE_CHECK_INTERVAL_MS
} from './update-policy.js'
import {
  MAX_METADATA_BYTES,
  RELEASE_CERTIFICATE_IDENTITY,
  RELEASE_CERTIFICATE_ISSUER,
  releaseAssetUrl,
  sha256File,
  verifyDownloadedUpdate
} from './update-verification.js'

let firstCheckTimer: NodeJS.Timeout | null = null
let periodicCheckTimer: NodeJS.Timeout | null = null
let updaterConfigured = false
let installRequested = false

function updateConfigExists(): boolean {
  return fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))
}

async function checkForUpdates(updater: AppUpdater): Promise<void> {
  try {
    await updater.checkForUpdates()
  } catch {
    console.error('Vérification de mise à jour impossible')
  }
}

/** Télécharge un petit fichier de la release, en refusant les réponses démesurées. */
async function fetchReleaseAsset(tag: string, name: string): Promise<Buffer> {
  const response = await net.fetch(releaseAssetUrl(tag, name), {
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const body = Buffer.from(await response.arrayBuffer())
  if (body.length > MAX_METADATA_BYTES) throw new Error('Réponse trop volumineuse')

  return body
}

/** Vérifie la signature Sigstore, avec une racine de confiance mise en cache. */
async function verifyBundle(bundle: string, payload: Buffer): Promise<void> {
  await verifySigstoreBundle(JSON.parse(bundle), payload, {
    certificateIssuer: RELEASE_CERTIFICATE_ISSUER,
    certificateIdentityURI: RELEASE_CERTIFICATE_IDENTITY,
    tufCachePath: path.join(app.getPath('userData'), 'sigstore-tuf')
  })
}

/**
 * Autorise l'installation d'une mise à jour téléchargée seulement après
 * vérification de sa provenance.
 *
 * `update-downloaded` est émis juste avant qu'electron-updater n'enregistre
 * son installation à la fermeture, et cet enregistrement n'a lieu que si
 * `autoInstallOnAppQuit` vaut encore `true`. Le drapeau est donc abaissé en
 * microtâche, une fois l'enregistrement fait : l'installation à la fermeture
 * relit le drapeau au moment de quitter, et un paquet non vérifié n'est
 * jamais installé.
 */
async function verifyThenOfferRestart(updater: AppUpdater, info: UpdateInfo): Promise<void> {
  queueMicrotask(() => {
    updater.autoInstallOnAppQuit = false
  })

  const downloadedFile = (info as UpdateInfo & { downloadedFile?: string }).downloadedFile
  if (!downloadedFile) {
    console.error('Mise à jour ignorée : fichier téléchargé inconnu')
    return
  }

  const outcome = await verifyDownloadedUpdate(info.version, downloadedFile, {
    fetchReleaseAsset,
    verifyBundle,
    hashFile: sha256File
  })

  if (!outcome.ok) {
    console.error(
      `Mise à jour ${info.version} refusée : provenance non vérifiée (${outcome.reason})`
    )
    return
  }

  console.log(`Mise à jour ${info.version} : signature Sigstore vérifiée`)
  updater.autoInstallOnAppQuit = true
  await offerRestart(updater, info)
}

async function offerRestart(updater: AppUpdater, info: UpdateInfo): Promise<void> {
  if (installRequested) return

  try {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour prête',
      message: `Finder ${info.version} a été téléchargé.`,
      detail: 'Redémarrez maintenant pour utiliser la nouvelle version.',
      buttons: ['Redémarrer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    })

    if (response === 0) {
      installRequested = true
      updater.quitAndInstall(false, true)
    }
  } catch {
    console.error('Affichage de la mise à jour impossible')
  }
}

/** Active le contrôle différé puis périodique des nouvelles releases. */
export function setupAutoUpdates(): void {
  if (updaterConfigured) return

  const supported = canUseAutomaticUpdates({
    isPackaged: app.isPackaged,
    platform: process.platform,
    environment: process.env,
    updateConfigExists: updateConfigExists()
  })

  if (!supported) {
    console.log('Mise à jour intégrée ignorée pour ce format de paquet')
    return
  }

  const updater = autoUpdater
  updaterConfigured = true
  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true
  updater.autoRunAppAfterInstall = true
  updater.allowDowngrade = false
  updater.allowPrerelease = false
  updater.logger = console

  updater.on('update-available', (info: UpdateInfo) => {
    console.log(`Mise à jour ${info.version} disponible, téléchargement lancé`)
  })
  updater.on('update-downloaded', (info: UpdateInfo) => {
    verifyThenOfferRestart(updater, info).catch(() => {
      console.error('Vérification de la mise à jour impossible')
    })
  })
  updater.on('error', (error: Error) => {
    console.error('Erreur du service de mise à jour :', error.message)
  })

  firstCheckTimer = setTimeout(() => {
    void checkForUpdates(updater)
  }, FIRST_UPDATE_CHECK_DELAY_MS)
  firstCheckTimer.unref()

  periodicCheckTimer = setInterval(() => {
    void checkForUpdates(updater)
  }, UPDATE_CHECK_INTERVAL_MS)
  periodicCheckTimer.unref()
}

/** Libère les minuteurs pendant l’arrêt normal de l’application. */
export function stopAutoUpdates(): void {
  if (firstCheckTimer) clearTimeout(firstCheckTimer)
  if (periodicCheckTimer) clearInterval(periodicCheckTimer)
  firstCheckTimer = null
  periodicCheckTimer = null
}
