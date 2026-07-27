/**
 * Finder - Enregistrement des handlers IPC
 *
 * Chaque message franchit une frontière de confiance : l'émetteur, les types
 * et l'appartenance des identifiants à un index détenu par le main sont tous
 * vérifiés avant un effet système.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { dialog, ipcMain, shell } from 'electron'

import { COMMAND_CHANNELS, REQUEST_CHANNELS } from '../../shared/ipc-contracts.js'
import type { RefreshIndexResult, RuntimeValue } from '../../shared/types.js'

import { scanApplications } from '../scanners/app-scanner.js'
import { scanFiles } from '../scanners/file-scanner.js'
import { clearIconCache } from '../scanners/icon-finder.js'
import { getSettingById, getSettingState, searchSettings } from '../scanners/settings-scanner.js'
import { launchDetachedProcess } from '../services/launcher.js'
import { eraseLocalData } from '../services/privacy.js'
import { getCachedScan, invalidateScanCache, SCAN_KEYS } from '../services/scan-cache.js'
import { executeSettingAction } from '../services/setting-actions.js'
import { scheduleCleanup, writeCommandScript } from '../services/terminal-command.js'
import {
  parseCommandArguments,
  stripDesktopFieldCodes,
  validateAndSanitizePath,
  validateExecCommand,
  validateUserCommand
} from '../services/validation.js'
import { getMainWindow, hideWindow } from '../window.js'
import { isTrustedIpcSender } from './sender-security.js'

type IpcEvent = IpcMainEvent | IpcMainInvokeEvent

function hasTrustedSender(event: IpcEvent): boolean {
  const window = getMainWindow()

  return Boolean(window && !window.isDestroyed() && isTrustedIpcSender(event, window.webContents))
}

function assertTrustedSender(event: IpcEvent): void {
  if (!hasTrustedSender(event)) {
    throw new Error('Unauthorized IPC sender')
  }
}

/** Retourne uniquement un chemin présent dans l'index détenu par le main. */
function getTrustedIndexedPath(candidate: RuntimeValue): string | null {
  if (typeof candidate !== 'string') return null

  const indexed = getCachedScan(SCAN_KEYS.files, scanFiles).some(
    (entry) => entry.path === candidate
  )

  return indexed ? validateAndSanitizePath(candidate) : null
}

export function warmUpScans(): void {
  getCachedScan(SCAN_KEYS.applications, scanApplications)
  getCachedScan(SCAN_KEYS.files, scanFiles)
}

export function registerIpcHandlers(): void {
  ipcMain.on(COMMAND_CHANNELS.HIDE_WINDOW, (event) => {
    if (!hasTrustedSender(event)) return
    hideWindow()
  })

  ipcMain.handle(REQUEST_CHANNELS.GET_APPLICATIONS, async (event) => {
    assertTrustedSender(event)
    return getCachedScan(SCAN_KEYS.applications, scanApplications)
  })

  ipcMain.handle(REQUEST_CHANNELS.GET_FILES, async (event) => {
    assertTrustedSender(event)
    return getCachedScan(SCAN_KEYS.files, scanFiles)
  })

  ipcMain.handle(REQUEST_CHANNELS.REFRESH_INDEX, async (event): Promise<RefreshIndexResult> => {
    assertTrustedSender(event)
    invalidateScanCache()
    clearIconCache()

    return {
      applications: getCachedScan(SCAN_KEYS.applications, scanApplications),
      files: getCachedScan(SCAN_KEYS.files, scanFiles)
    }
  })

  ipcMain.on(COMMAND_CHANNELS.LAUNCH_APP, (event, desktopFilePath: RuntimeValue) => {
    if (!hasTrustedSender(event) || typeof desktopFilePath !== 'string') return

    // Le renderer fournit un identifiant, jamais la commande `Exec=`.
    const application = getCachedScan(SCAN_KEYS.applications, scanApplications).find(
      (entry) => entry.path === desktopFilePath
    )
    const cleanExec = validateExecCommand(application?.exec)

    if (!cleanExec) {
      console.error('Invalid application identifier or command blocked')
      return
    }

    const args = stripDesktopFieldCodes(parseCommandArguments(cleanExec))
    if (args.length === 0) return

    launchDetachedProcess(args, 'Application')
    hideWindow()
  })

  ipcMain.on(COMMAND_CHANNELS.OPEN_FILE, (event, filePath: RuntimeValue) => {
    if (!hasTrustedSender(event)) return
    const validPath = getTrustedIndexedPath(filePath)

    if (!validPath) {
      console.error('Invalid or non-indexed file path blocked')
      return
    }

    launchDetachedProcess(['xdg-open', validPath], 'File')
    hideWindow()
  })

  ipcMain.on(COMMAND_CHANNELS.OPEN_LOCATION, (event, filePath: RuntimeValue) => {
    if (!hasTrustedSender(event)) return
    const validPath = getTrustedIndexedPath(filePath)

    if (!validPath) {
      console.error('Invalid or non-indexed file path blocked')
      return
    }

    let targetPath = validPath
    try {
      if (!fs.statSync(validPath).isDirectory()) targetPath = path.dirname(validPath)
    } catch {
      targetPath = path.dirname(validPath)
    }

    launchDetachedProcess(['xdg-open', targetPath], 'Location')
    hideWindow()
  })

  ipcMain.on(COMMAND_CHANNELS.OPEN_WEB_SEARCH, (event, query: RuntimeValue) => {
    if (!hasTrustedSender(event) || typeof query !== 'string') return

    const cleanQuery = query.trim().slice(0, 1000)
    if (!cleanQuery) return

    const searchUrl = new URL('https://www.google.com/search')
    searchUrl.searchParams.set('q', cleanQuery)

    void shell.openExternal(searchUrl.href).catch(() => {
      console.error('Web search failed')
    })
    hideWindow()
  })

  ipcMain.on(COMMAND_CHANNELS.EXECUTE_COMMAND, (event, command: RuntimeValue) => {
    if (!hasTrustedSender(event)) return
    const validCommand = validateUserCommand(command)
    const window = getMainWindow()

    if (!validCommand || !window) {
      console.error('Invalid or dangerous command blocked')
      return
    }

    // Cette confirmation native reste hors de portée d'un renderer compromis.
    void dialog
      .showMessageBox(window, {
        type: 'warning',
        title: 'Confirmer la commande',
        message: 'Exécuter cette commande dans un terminal ?',
        detail: validCommand,
        buttons: ['Annuler', 'Exécuter'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      })
      .then(({ response }) => {
        if (response !== 1) return

        try {
          const scriptPath = writeCommandScript(validCommand)
          launchDetachedProcess(['x-terminal-emulator', '-e', scriptPath], 'Command in terminal')
          scheduleCleanup(scriptPath)
          hideWindow()
        } catch {
          console.error('Error creating command script')
        }
      })
      .catch(() => {
        console.error('Command confirmation failed')
      })
  })

  ipcMain.handle(REQUEST_CHANNELS.SEARCH_SETTINGS, async (event, query: RuntimeValue) => {
    assertTrustedSender(event)
    return searchSettings(typeof query === 'string' ? query : '')
  })

  ipcMain.handle(REQUEST_CHANNELS.ERASE_LOCAL_DATA, async (event) => {
    assertTrustedSender(event)
    const window = getMainWindow()
    if (!window) return null

    const { response } = await dialog.showMessageBox(window, {
      type: 'warning',
      title: 'Effacer les données locales',
      message: 'Effacer l’historique et les caches de Finder ?',
      detail: 'Cette action est irréversible. Vos fichiers personnels ne sont pas touchés.',
      buttons: ['Annuler', 'Effacer'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (response !== 1) return null

    invalidateScanCache()
    clearIconCache()
    return eraseLocalData()
  })

  ipcMain.handle(REQUEST_CHANNELS.GET_SETTING_STATE, async (event, settingId: RuntimeValue) => {
    assertTrustedSender(event)
    if (typeof settingId !== 'string') return false
    return getSettingState(settingId)
  })

  ipcMain.on(
    COMMAND_CHANNELS.EXECUTE_SETTING_ACTION,
    async (event, settingId: RuntimeValue, actionId: RuntimeValue) => {
      if (!hasTrustedSender(event)) return
      if (typeof settingId !== 'string' || typeof actionId !== 'string') return

      const setting = getSettingById(settingId)
      if (!setting) return

      const outcome = await executeSettingAction(setting, actionId, {
        parseArguments: parseCommandArguments,
        launch: launchDetachedProcess
      })

      if (!outcome.ok) {
        console.error('Setting action failed:', settingId, actionId, outcome.reason)
      }

      hideWindow()
    }
  )
}
