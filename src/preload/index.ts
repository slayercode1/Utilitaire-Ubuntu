/**
 * Finder - Script de preload
 *
 * S'exécute dans un contexte isolé avant le chargement de la page et expose au
 * renderer une surface restreinte : une méthode par canal, jamais `ipcRenderer`
 * lui-même.
 *
 * CONTRAINTE : la fenêtre est créée avec `sandbox: true`, ce qui empêche ce
 * script de charger un module du projet — seul `electron` est résolvable, et
 * `require('../shared/ipc-contracts')` échoue avec « module not found ». Les
 * noms de canaux sont donc écrits littéralement ici, alors que le processus
 * principal les lit depuis les contrats partagés.
 *
 * La cohérence entre les deux côtés est vérifiée par
 * `tests/unit/ipc-contracts.test.js`, qui compare ce fichier aux canaux
 * déclarés : un canal ajouté d'un seul côté fait échouer la suite.
 */

import { contextBridge, ipcRenderer } from 'electron'

import type { ElectronApi } from '../shared/types.js'

const electronApi: ElectronApi = {
  /** Masque la fenêtre, sans quitter l'application. */
  hideWindow: () => ipcRenderer.send('hide-window'),

  /** Liste les applications installées. */
  getApplications: () => ipcRenderer.invoke('get-applications'),

  /** Liste les fichiers indexés du répertoire personnel. */
  getFiles: () => ipcRenderer.invoke('get-files'),

  /** Force un nouveau scan, en ignorant le cache. */
  refreshIndex: () => ipcRenderer.invoke('refresh-index'),

  /** Lance l'application identifiée par une entrée `.desktop` indexée. */
  launchApp: (desktopFilePath: string) =>
    ipcRenderer.send('launch-app', desktopFilePath),

  /** Ouvre un fichier avec l'application par défaut. */
  openFile: (filePath: string) => ipcRenderer.send('open-file', filePath),

  /** Ouvre le dossier contenant un fichier. */
  openLocation: (filePath: string) => ipcRenderer.send('open-location', filePath),

  /** Ouvre une recherche HTTPS construite et validée par le processus main. */
  searchWeb: (query: string) => ipcRenderer.send('open-web-search', query),

  /** Exécute une commande dans un terminal. */
  executeCommand: (command: string) => ipcRenderer.send('execute-command', command),

  /** Recherche dans les paramètres système. */
  searchSettings: (query: string) => ipcRenderer.invoke('search-settings', query),

  /** Efface toute donnée conservée localement (droit à l'effacement). */
  eraseLocalData: () => ipcRenderer.invoke('erase-local-data'),

  /** Indique si un paramètre est actuellement actif. */
  getSettingState: (settingId: string) =>
    ipcRenderer.invoke('get-setting-state', settingId),

  /** Déclenche une action rapide d'un paramètre système. */
  executeSettingAction: (settingId: string, actionId: string) =>
    ipcRenderer.send('execute-setting-action', settingId, actionId)
}

contextBridge.exposeInMainWorld('electronAPI', electronApi)
