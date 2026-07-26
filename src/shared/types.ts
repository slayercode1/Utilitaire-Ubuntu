/**
 * Finder - Types partagés
 *
 * Décrit les données échangées entre les processus. Ce fichier n'est lu qu'à la
 * vérification de types : il ne produit aucun code et n'est pas embarqué dans
 * l'application.
 */

/** Une application installée, issue d'un fichier .desktop. */
export interface AppEntry {
  /** Libellé affiché, localisé lorsque le fichier .desktop le fournit. */
  name: string
  /** Description courte (Comment ou GenericName). */
  description: string
  /** Valeur brute du champ Icon=. */
  icon: string
  /** Chemin résolu de l'icône, chaîne vide si introuvable. */
  iconPath: string
  /** Valeur brute du champ Exec=, codes de champ compris. */
  exec: string
  /** Chemin du fichier .desktop d'origine. */
  path: string
  /** Vrai si NoDisplay/Hidden est positionné, ou si Type n'est pas Application. */
  hidden: boolean
}

/** Un fichier ou dossier indexé sous HOME. */
export interface FileEntry {
  path: string
  name: string
  type: 'file' | 'folder'
}

/** Action rapide attachée à un paramètre système. */
export interface SettingAction {
  id: string
  name: string
  icon: string
}

/** Paramètre système, tel qu'envoyé au renderer (sans les fonctions). */
export interface SerializedSetting {
  id: string
  name: string
  keywords: string[]
  icon: string
  resultType: 'setting'
  actions: SettingAction[]
  /** Score de pertinence pour la requête courante. */
  score: number
}

/**
 * Résultat de l'effacement des données locales.
 *
 * Permet à l'utilisateur de constater ce qui a effectivement été supprimé,
 * comme l'exige le devoir de transparence (article 12 du RGPD).
 */
export interface EraseResult {
  /** Emplacements effacés, sous forme de noms lisibles. */
  emplacements: string[]
  /** Vrai si l'historique de recherche a été retiré. */
  historiqueEfface: boolean
}

/** Résultat d'un rafraîchissement complet de l'index. */
export interface RefreshIndexResult {
  applications: AppEntry[]
  files: FileEntry[]
}

/**
 * Contrat des canaux `invoke` : paramètres attendus et valeur retournée.
 * La clé est le nom du canal tel que défini dans ipcContracts.js.
 */
export interface IpcRequestMap {
  'get-applications': {
    request: []
    response: AppEntry[]
  }
  'get-files': {
    request: []
    response: FileEntry[]
  }
  'refresh-index': {
    request: []
    response: RefreshIndexResult
  }
  'search-settings': {
    request: [query: string]
    response: SerializedSetting[]
  }
  'get-setting-state': {
    request: [settingId: string]
    response: boolean
  }
  'erase-local-data': {
    request: []
    response: string[] | null
  }
}

/**
 * Contrat des canaux `send` : aucune réponse n'est attendue.
 */
export interface IpcCommandMap {
  'hide-window': []
  'launch-app': [desktopFilePath: string]
  'open-file': [filePath: string]
  'open-location': [filePath: string]
  'open-web-search': [query: string]
  'execute-command': [command: string]
  'execute-setting-action': [settingId: string, actionId: string]
}

/**
 * API exposée au renderer par le preload via contextBridge.
 *
 * Le renderer ne connaît que ces méthodes : il n'a accès ni à ipcRenderer,
 * ni aux noms de canaux.
 */
export interface ElectronApi {
  hideWindow(): void
  getApplications(): Promise<AppEntry[]>
  getFiles(): Promise<FileEntry[]>
  refreshIndex(): Promise<RefreshIndexResult>
  launchApp(desktopFilePath: string): void
  openFile(filePath: string): void
  openLocation(filePath: string): void
  searchWeb(query: string): void
  executeCommand(command: string): void
  searchSettings(query: string): Promise<SerializedSetting[]>
  getSettingState(settingId: string): Promise<boolean>
  /**
   * Efface toutes les données conservées localement : historique de recherche,
   * caches de Chromium et artefacts sans finalité.
   */
  eraseLocalData(): Promise<string[] | null>
  executeSettingAction(settingId: string, actionId: string): void
}
