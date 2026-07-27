/** Téléchargement et installation des releases Linux publiées sur GitHub. */

import fs from 'node:fs'
import path from 'node:path'

import { app, dialog } from 'electron'
import type { AppUpdater, UpdateInfo } from 'electron-updater'
import electronUpdater from 'electron-updater'

import {
  canUseAutomaticUpdates,
  FIRST_UPDATE_CHECK_DELAY_MS,
  UPDATE_CHECK_INTERVAL_MS
} from './update-policy.js'

let firstCheckTimer: NodeJS.Timeout | null = null
let periodicCheckTimer: NodeJS.Timeout | null = null
let updaterConfigured = false
let installRequested = false

function getUpdater(): AppUpdater {
  // Le paquet expose une API CommonJS ; cet accès reste compatible avec la
  // compilation Node16 du processus principal.
  return electronUpdater.autoUpdater
}

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

  const updater = getUpdater()
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
    void offerRestart(updater, info)
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
