/**
 * Finder - Point d'entrée du processus principal
 *
 * Assemble les modules et branche les événements du cycle de vie. Toute la
 * logique vit dans les modules voisins ; ce fichier se limite à l'ordonner.
 */

import { app, BrowserWindow, globalShortcut } from 'electron'

import { GLOBAL_SHORTCUT } from './config.js'
import { registerIpcHandlers, warmUpScans } from './ipc/register-handlers.js'
import { acquireSingleInstanceLock, setupAutoLaunch } from './lifecycle.js'
import {
  stopCursorDaemon,
  warmUpCursorDaemon
} from './scanners/cursor-position.js'
import { clearIconCache } from './scanners/icon-finder.js'
import { purgeUnusedArtifacts } from './services/privacy.js'
import { invalidateScanCache } from './services/scan-cache.js'
import { createWindow, revealWindow, toggleWindow } from './window.js'

// Le verrou doit être posé avant toute autre initialisation : une seconde
// instance doit quitter sans avoir créé de fenêtre ni réservé de raccourci.
if (!acquireSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// === RÉSILIENCE ===
//
// L'application reste résidente en arrière-plan : une erreur non rattrapée la
// terminerait sans laisser de trace, et l'utilisateur constaterait seulement
// que son raccourci ne répond plus. On journalise donc sans masquer l'erreur.

process.on('uncaughtException', (error: Error) => {
  console.error('Exception non rattrapée :', error.message, error.stack)
})

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Promesse rejetée sans gestionnaire :', reason)
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
  console.error(
    `Processus ${details.type} interrompu :`,
    details.reason,
    details.exitCode
  )
})

void app.whenReady().then(async () => {
  createWindow()

  // Une seconde tentative de lancement réveille l'instance existante plutôt
  // que de démarrer un nouveau processus.
  app.on('second-instance', () => {
    void revealWindow()
  })

  registerIpcHandlers()

  await setupAutoLaunch()

  if (globalShortcut.register(GLOBAL_SHORTCUT, () => void toggleWindow())) {
    console.log(`Raccourci ${GLOBAL_SHORTCUT} enregistré avec succès`)
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
  globalShortcut.unregisterAll()

  // Libère les ressources qui survivraient au processus principal :
  // l'interpréteur d'interrogation du curseur, et les index en mémoire.
  stopCursorDaemon()
  clearIconCache()
  invalidateScanCache()

})

// La purge doit venir après l'arrêt de Chromium : sur `will-quit`, le moteur
// est encore actif et recrée aussitôt les fichiers supprimés.
app.on('quit', () => {
  const retires = purgeUnusedArtifacts()
  if (retires > 0) {
    console.log(`Confidentialité : ${retires} artefacts inutilisés retirés`)
  }
})

// L'application survit à la fermeture de sa fenêtre : elle doit rester
// disponible pour le raccourci global.
app.on('window-all-closed', () => {
  // Volontairement vide
})
