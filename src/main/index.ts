/**
 * Finder - Point d'entrée du processus principal
 *
 * Assemble les modules et branche les événements du cycle de vie. Toute la
 * logique vit dans les modules voisins ; ce fichier se limite à l'ordonner.
 */

import { app, BrowserWindow, globalShortcut } from 'electron'
import { registerAppProtocol, registerAppScheme } from './app-protocol.js'
import { GLOBAL_SHORTCUT } from './config.js'
import { registerIpcHandlers, warmUpScans } from './ipc/register-handlers.js'
import { acquireSingleInstanceLock, setupAutoLaunch } from './lifecycle.js'
import { stopCursorDaemon, warmUpCursorDaemon } from './scanners/cursor-position.js'
import { clearIconCache } from './scanners/icon-finder.js'
import { setupAutoUpdates, stopAutoUpdates } from './services/auto-update.js'
import { purgeUnusedArtifacts } from './services/privacy.js'
import { invalidateScanCache } from './services/scan-cache.js'
import { createWindow, revealWindow, toggleWindow } from './window.js'

// Electron exige que les privilèges d'un schéma soient déclarés avant ready.
registerAppScheme()

// Le verrou doit être posé avant toute autre initialisation : une seconde
// instance doit quitter sans avoir créé de fenêtre ni réservé de raccourci.
if (!acquireSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

/** Vrai dès que l'arrêt est engagé ; voir `exitAfterFatalError`. */
let isShuttingDown = false

// === RACCOURCI GLOBAL SOUS WAYLAND ===
//
// Wayland réserve le clavier au compositeur : une application ne peut pas
// capter un raccourci global par elle-même. `globalShortcut.register()` renvoie
// pourtant `true` sous Ozone/Wayland, si bien que l'enregistrement paraît
// réussir alors que la touche n'est jamais délivrée.
//
// La voie propre est le portail XDG `GlobalShortcuts`, absent avant GNOME 47 ;
// Ubuntu 24.04 LTS livre GNOME 46. On demande donc le backend X11, où le grab
// clavier fonctionne, quitte à passer par XWayland.
//
// À retirer lorsque le socle minimal disposera du portail : le rendu Wayland
// natif gère mieux le HiDPI par écran et le défilement fractionnaire.
if (process.platform === 'linux' && process.env['XDG_SESSION_TYPE'] === 'wayland') {
  app.commandLine.appendSwitch('ozone-platform', 'x11')
}

// === CONFIDENTIALITÉ ===
//
// La purge a lieu au démarrage, avant `whenReady()` : à cet instant Chromium
// n'a pas encore ouvert ses artefacts de la session à venir, et ceux de la
// session précédente sont fermés. La faire à l'arrêt revenait à supprimer le
// répertoire Crashpad sous les pieds du moteur qui se démonte, ce qui rompait
// son propre arrêt (CHECK « Failed to shutdown », SIGTRAP).
//
// Les artefacts vivent donc le temps d'une session au lieu de disparaître à sa
// fermeture ; ils ne sont jamais transmis, faute de serveur de collecte.
const retires = purgeUnusedArtifacts()
if (retires > 0) {
  console.log(`Confidentialité : ${retires} artefacts inutilisés retirés`)
}

// === RÉSILIENCE ===
//
// L'application reste résidente en arrière-plan : une erreur non rattrapée la
// terminerait sans laisser de trace, et l'utilisateur constaterait seulement
// que son raccourci ne répond plus.
//
// Une exception non rattrapée laisse le processus principal, et les droits IPC
// qu'il arbitre, dans un état inconnu : on sort. Un rejet de promesse est bien
// plus souvent bénin (un scan qui échoue, une icône introuvable) et ne justifie
// pas de rendre le raccourci global inopérant : on journalise seulement.

let fatalExitRequested = false

function exitAfterFatalError(label: string, details: Error): void {
  console.error(label, details)

  // `app.exit()` pendant l'arrêt de Chromium déclenche un CHECK interne
  // (« Failed to shutdown »). Une fois la sortie engagée, on laisse faire.
  if (fatalExitRequested || isShuttingDown) return
  fatalExitRequested = true
  app.exit(1)
}

process.on('uncaughtException', (error: Error) => {
  exitAfterFatalError('Exception non rattrapée :', error)
})

process.on('unhandledRejection', () => {
  console.error('Promesse rejetée sans gestionnaire')
})

app.on('render-process-gone', (_event, _webContents, details) => {
  console.error('Processus de rendu interrompu :', details.reason)

  // Le renderer ne reviendra pas seul : on le recrée pour que le raccourci
  // global continue d'ouvrir une fenêtre utilisable.
  if (details.reason !== 'clean-exit' && BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('child-process-gone', (_event, details) => {
  console.error(`Processus ${details.type} interrompu :`, details.reason, details.exitCode)
})

void app.whenReady().then(async () => {
  await registerAppProtocol()
  createWindow()

  // Une seconde tentative de lancement réveille l'instance existante plutôt
  // que de démarrer un nouveau processus.
  app.on('second-instance', () => {
    void revealWindow()
  })

  registerIpcHandlers()

  await setupAutoLaunch()
  setupAutoUpdates()

  if (globalShortcut.register(GLOBAL_SHORTCUT, () => void toggleWindow())) {
    // `register()` renvoie `true` sans garantir que le compositeur délivrera la
    // touche : sous Wayland sans portail, l'enregistrement est un leurre. On
    // évite donc d'annoncer un succès que l'utilisateur ne constatera pas.
    console.log(
      `Raccourci ${GLOBAL_SHORTCUT} enregistré (backend ${app.commandLine.getSwitchValue('ozone-platform') || 'par défaut'})`
    )
  } else {
    console.error(`Échec de l'enregistrement du raccourci ${GLOBAL_SHORTCUT}`)
  }

  // Sur macOS, recréer la fenêtre si l'icône du dock est cliquée
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // L'application reste en arrière-plan : autant payer maintenant le coût des
  // scans et du démarrage de l'interrogation du curseur, plutôt qu'à la
  // première ouverture de la fenêtre.
  setImmediate(() => {
    warmUpCursorDaemon()
    warmUpScans()
  })
})

app.on('will-quit', () => {
  isShuttingDown = true

  globalShortcut.unregisterAll()

  // Libère les ressources qui survivraient au processus principal :
  // l'interpréteur d'interrogation du curseur, et les index en mémoire.
  stopCursorDaemon()
  clearIconCache()
  invalidateScanCache()
  stopAutoUpdates()
})

// L'application survit à la fermeture de sa fenêtre : elle doit rester
// disponible pour le raccourci global.
app.on('window-all-closed', () => {
  // Volontairement vide
})
