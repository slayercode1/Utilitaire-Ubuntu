/**
 * Finder - Configuration de l'application
 *
 * Regroupe les valeurs qui étaient dispersées dans le processus principal, et
 * résout les chemins des ressources.
 */

import path from 'node:path'
import { app } from 'electron'

/** Largeur de la fenêtre de recherche, en pixels. */
export const WINDOW_WIDTH = 600

/** Hauteur de la fenêtre de recherche, en pixels. */
export const WINDOW_HEIGHT = 500

/** Position verticale, en proportion de la hauteur de l'écran actif. */
export const WINDOW_TOP_POSITION = 0.15

/** Raccourci global d'ouverture et de fermeture. */
export const GLOBAL_SHORTCUT = 'Alt+Space'

/**
 * Durée de validité d'un scan, en millisecondes.
 *
 * Assez longue pour que l'ouverture de la fenêtre soit instantanée, assez
 * courte pour qu'une application fraîchement installée apparaisse sans
 * redémarrage.
 */
export const SCAN_CACHE_TTL = 60_000

/**
 * Racine des fichiers compilés.
 *
 * Ce module est émis dans `dist/main/`, alors que le preload et l'interface
 * vivent dans `dist/preload/` et `dist/renderer/`. Les chemins sont donc
 * résolus depuis le parent, et non depuis le répertoire courant, qui varie
 * selon la façon dont l'application est lancée et diffère à l'intérieur de
 * l'archive asar.
 */
const DIST_ROOT = path.join(__dirname, '..')

/** Racine des seules ressources que le protocole applicatif peut servir. */
export const RENDERER_ROOT = path.join(DIST_ROOT, 'renderer')

/** Chemin du script de preload. */
export const PRELOAD_PATH = path.join(DIST_ROOT, 'preload', 'index.js')

/**
 * Chemin de l'icône de l'application.
 *
 * Une fois empaquetée, l'icône est livrée comme ressource externe et non dans
 * l'archive asar : la résoudre depuis `__dirname` désignerait un fichier
 * inexistant. En développement, elle se trouve à la racine du dépôt.
 */
export const APP_ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'logo.png')
  : path.join(DIST_ROOT, '..', 'logo.png')
