/**
 * Finder - Contrats IPC
 *
 * Source unique des noms de canaux échangés entre le processus principal et le
 * renderer. Auparavant chaque nom était écrit deux fois — une fois dans le
 * preload, une fois dans le processus principal — sans rien pour garantir
 * qu'ils correspondent : une faute de frappe échouait silencieusement à
 * l'exécution.
 *
 * Les formes de données associées sont décrites dans types.ts.
 */

/**
 * Canaux `invoke` : le renderer attend une réponse.
 */
export const REQUEST_CHANNELS = Object.freeze({
  GET_APPLICATIONS: 'get-applications',
  GET_FILES: 'get-files',
  REFRESH_INDEX: 'refresh-index',
  SEARCH_SETTINGS: 'search-settings',
  GET_SETTING_STATE: 'get-setting-state',
  // Droit à l'effacement : supprime toute donnée conservée localement
  ERASE_LOCAL_DATA: 'erase-local-data'
} as const)

/**
 * Canaux `send` : le renderer déclenche une action sans attendre de retour.
 */
export const COMMAND_CHANNELS = Object.freeze({
  HIDE_WINDOW: 'hide-window',
  LAUNCH_APP: 'launch-app',
  OPEN_FILE: 'open-file',
  OPEN_LOCATION: 'open-location',
  OPEN_WEB_SEARCH: 'open-web-search',
  EXECUTE_COMMAND: 'execute-command',
  EXECUTE_SETTING_ACTION: 'execute-setting-action'
} as const)

/**
 * Ensemble des canaux, pour les vérifications de couverture.
 */
export const IPC_CHANNELS = Object.freeze({
  ...REQUEST_CHANNELS,
  ...COMMAND_CHANNELS
} as const)

/** Nom d'un canal de requête. */
export type RequestChannel =
  (typeof REQUEST_CHANNELS)[keyof typeof REQUEST_CHANNELS]

/** Nom d'un canal de commande. */
export type CommandChannel =
  (typeof COMMAND_CHANNELS)[keyof typeof COMMAND_CHANNELS]

/** Nom de canal, toutes catégories confondues. */
export type IpcChannel = RequestChannel | CommandChannel
