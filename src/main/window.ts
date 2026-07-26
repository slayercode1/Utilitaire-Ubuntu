/**
 * Finder - Fenêtre principale
 *
 * Création, positionnement multi-écrans et bascule d'affichage. La fenêtre est
 * unique et conservée pendant toute la durée de vie de l'application : elle est
 * masquée plutôt que détruite, ce qui rend l'ouverture instantanée.
 */

import { app, BrowserWindow, screen } from 'electron'
import type { BrowserWindowConstructorOptions, Display } from 'electron'
import { pathToFileURL } from 'node:url'

import {
  APP_ICON_PATH,
  INDEX_HTML_PATH,
  PRELOAD_PATH,
  WINDOW_HEIGHT,
  WINDOW_TOP_POSITION,
  WINDOW_WIDTH
} from './config.js'
import { getCursorPosition } from './scanners/cursor-position.js'

/** Fenêtre principale, créée une seule fois au démarrage. */
let win: BrowserWindow | null = null

/**
 * Retourne la fenêtre principale, ou `null` si elle n'a pas encore été créée.
 */
export function getMainWindow(): BrowserWindow | null {
  return win
}

/**
 * Détermine l'écran qui contient le curseur.
 *
 * La position vient de `getCursorPosition` et non de
 * `screen.getCursorScreenPoint` : sous X11, cette dernière reste figée sur la
 * dernière position connue tant que l'application ne reçoit pas d'événement de
 * souris, ce qui est précisément le cas lorsque Finder est ouvert au clavier.
 *
 * `getDisplayNearestPoint` retourne l'écran le plus proche, y compris quand le
 * point tombe en dehors de tous les écrans. On cherche donc d'abord une
 * correspondance exacte, comme le fait Spotlight sur macOS.
 */
export async function getDisplayUnderCursor(): Promise<Display> {
  const cursor = await getCursorPosition(screen)

  const containing = screen.getAllDisplays().find((display) => {
    const { x, y, width, height } = display.bounds
    return (
      cursor.x >= x &&
      cursor.x < x + width &&
      cursor.y >= y &&
      cursor.y < y + height
    )
  })

  return containing ?? screen.getDisplayNearestPoint(cursor)
}

/**
 * Positionne la fenêtre au centre en haut de l'écran actif.
 *
 * Les coordonnées de `workArea` sont globales sur un bureau multi-écrans : il
 * faut ajouter l'origine de l'écran, sinon la fenêtre atterrit toujours sur
 * l'écran principal.
 */
export async function positionWindow(window: BrowserWindow): Promise<void> {
  try {
    const { x: screenX, y: screenY, width, height } = (
      await getDisplayUnderCursor()
    ).workArea

    // Sur un écran plus étroit que la fenêtre, le centrage donnerait un
    // décalage négatif qui la ferait déborder sur l'écran voisin.
    const offsetX = Math.max(0, Math.floor((width - WINDOW_WIDTH) / 2))
    const offsetY = Math.max(
      0,
      Math.min(Math.floor(height * WINDOW_TOP_POSITION), height - WINDOW_HEIGHT)
    )

    window.setPosition(screenX + offsetX, screenY + offsetY)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Erreur lors du positionnement de la fenêtre:', message)
    window.center()
  }
}

/**
 * Crée la fenêtre principale : sans bordure, transparente, toujours au premier
 * plan et absente de la barre des tâches.
 */
export function createWindow(): BrowserWindow {
  const options: BrowserWindowConstructorOptions = {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: !app.isPackaged
    }
  }

  if (process.platform === 'linux') {
    // Le type "notification" évite l'apparition dans la barre des tâches ;
    // l'icône n'y a alors plus d'effet et provoquerait l'inverse.
    options.type = 'notification'
    delete options.icon
  }

  win = new BrowserWindow(options)
  win.setSkipTaskbar(true)

  const trustedUrl = pathToFileURL(INDEX_HTML_PATH).href

  // Aucune navigation n'est fonctionnelle dans Finder. Les liens externes
  // passent par un canal IPC qui construit lui-même une URL HTTPS allowlistée.
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== trustedUrl) event.preventDefault()
  })
  win.webContents.on('will-redirect', (event, targetUrl) => {
    if (targetUrl !== trustedUrl) event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())

  // L'application locale n'utilise caméra, micro, géolocalisation, MIDI,
  // notifications ni presse-papiers privilégiés.
  win.webContents.session.setPermissionCheckHandler(() => false)
  win.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )

  if (process.platform === 'linux') {
    win.once('ready-to-show', () => {
      win?.setSkipTaskbar(true)
    })
  }

  void win.loadFile(INDEX_HTML_PATH)

  // La fenêtre est masquée : sa position sera recalculée à la première
  // ouverture, inutile d'attendre ici.
  void positionWindow(win)
  win.hide()

  // Comportement de type Spotlight : la fenêtre disparaît dès qu'elle perd le
  // focus, sans quoi elle resterait au premier plan au-dessus de l'application
  // que l'utilisateur vient d'activer.
  win.on('blur', () => {
    win?.hide()
  })

  return win
}

/**
 * Affiche la fenêtre sur l'écran actif, ou la masque si elle est déjà visible.
 */
export async function toggleWindow(): Promise<void> {
  if (!win) return

  if (win.isVisible()) {
    win.hide()
    return
  }

  await positionWindow(win)

  // La fenêtre a pu être détruite pendant l'attente de la position
  if (!win) return

  win.setSkipTaskbar(true)
  win.show()
  win.focus()
}

/**
 * Ramène la fenêtre au premier plan, en la repositionnant au passage.
 */
export async function revealWindow(): Promise<void> {
  if (!win) return

  await positionWindow(win)

  if (!win) return

  win.show()
  win.focus()
}

/** Masque la fenêtre si elle est affichée. */
export function hideWindow(): void {
  win?.hide()
}
