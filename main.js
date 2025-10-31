/**
 * Finder - Application de recherche type Spotlight pour Linux
 *
 * Ce fichier gère le processus principal de l'application Electron.
 * Il crée la fenêtre de l'application, gère les raccourcis globaux,
 * et coordonne la communication avec le processus de rendu (renderer).
 */

const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron/main')
const path = require('node:path')
const { spawn } = require('child_process')
const { scanApplications } = require('./appScanner')
const { scanFiles } = require('./fileScanner')
const { searchSettings, getSettingById, getSettingState } = require('./settingsScanner')

// Import auto-launch avec gestion d'erreur si non installé
let AutoLaunch
try {
  AutoLaunch = require('auto-launch')
} catch (error) {
  console.warn('auto-launch package not installed, auto-start will not be available')
  AutoLaunch = null
}

// === CONFIGURATION ===

// Dimensions de la fenêtre de recherche
const WINDOW_WIDTH = 600
const WINDOW_HEIGHT = 500

// Position verticale de la fenêtre (pourcentage de la hauteur de l'écran)
const WINDOW_TOP_POSITION = 0.15

// Raccourci clavier global pour ouvrir/fermer l'application
const GLOBAL_SHORTCUT = 'Alt+Space'

// === ÉTAT DE L'APPLICATION ===

/**
 * Instance de la fenêtre principale
 * @type {BrowserWindow|null}
 */
let win = null

/**
 * Configuration de l'auto-lancement au démarrage du système
 */
let autoLauncher = null
if (AutoLaunch) {
  autoLauncher = new AutoLaunch({
    name: 'Finder',
    path: app.getPath('exe'),
  })
}

// === FONCTIONS DE CRÉATION ET GESTION DE LA FENÊTRE ===

/**
 * Crée la fenêtre principale de l'application
 * Configure une fenêtre sans bordure, transparente, toujours au premier plan
 */
function createWindow() {
  // Options de la fenêtre
  const options = {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,          // Fenêtre sans bordures ni barre de titre
    transparent: true,     // Fond transparent pour un design moderne
    resizable: false,      // Taille fixe
    alwaysOnTop: true,     // Toujours au premier plan
    skipTaskbar: true,     // Ne pas afficher dans la barre des tâches
    show: false,           // Ne pas afficher au démarrage
    icon: path.join(__dirname, 'logo.png'),  // Icône de l'application
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // Sécurité : isolation du contexte
      nodeIntegration: false    // Sécurité : pas d'accès direct à Node.js
    }
  }

  // Sur Linux, utiliser le type 'notification' pour éviter l'apparition dans la taskbar
  if (process.platform === 'linux') {
    options.type = 'notification'
    // Ne pas définir d'icône sur Linux pour éviter l'apparition dans la taskbar
    delete options.icon
  }

  // Créer la fenêtre
  win = new BrowserWindow(options)

  // S'assurer que la fenêtre n'apparaît pas dans la taskbar
  win.setSkipTaskbar(true)

  // Sur Linux, forcer le comportement une fois la fenêtre prête
  if (process.platform === 'linux') {
    win.once('ready-to-show', () => {
      win.setSkipTaskbar(true)
    })
  }

  // Charger le fichier HTML de l'interface
  win.loadFile('index.html')

  // Positionner la fenêtre au centre en haut de l'écran principal
  positionWindow(win)

  // Cacher la fenêtre au démarrage
  win.hide()

  // Cacher la fenêtre quand elle perd le focus (comportement type Spotlight)
  win.on('blur', () => {
    win.hide()
  })
}

/**
 * Positionne la fenêtre au centre en haut de l'écran principal
 * @param {BrowserWindow} window - La fenêtre à positionner
 */
function positionWindow(window) {
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const x = Math.floor((width - WINDOW_WIDTH) / 2)
  const y = Math.floor(height * WINDOW_TOP_POSITION)

  window.setPosition(x, y)
}

/**
 * Affiche ou masque la fenêtre principale (toggle)
 * La fenêtre est repositionnée sur l'écran où se trouve le curseur
 */
function toggleWindow() {
  if (!win) return

  if (win.isVisible()) {
    // Si la fenêtre est visible, la cacher
    win.hide()
  } else {
    // Si la fenêtre est cachée, la montrer

    // Repositionner sur l'écran où se trouve le curseur (support multi-écrans)
    const { screen } = require('electron')
    const cursorPoint = screen.getCursorScreenPoint()
    const activeDisplay = screen.getDisplayNearestPoint(cursorPoint)
    const { x: screenX, y: screenY, width, height } = activeDisplay.workArea

    const x = screenX + Math.floor((width - WINDOW_WIDTH) / 2)
    const y = screenY + Math.floor(height * WINDOW_TOP_POSITION)

    win.setPosition(x, y)

    // Forcer skipTaskbar avant d'afficher
    win.setSkipTaskbar(true)

    // Afficher et donner le focus
    win.show()
    win.focus()
  }
}

// === GESTION DES PROCESSUS EXTERNES ===

/**
 * Lance un processus de manière détachée
 * @param {string} command - La commande à exécuter
 * @param {string} description - Description pour les logs
 * @returns {boolean} - true si lancé avec succès, false sinon
 */
function launchDetachedProcess(command, description) {
  try {
    const child = spawn('sh', ['-c', command], {
      detached: true,
      stdio: 'ignore'
    })

    child.unref()
    console.log(`${description} launched successfully`)
    return true
  } catch (error) {
    console.error(`Error launching ${description}:`, error)
    return false
  }
}

// === HANDLERS IPC (COMMUNICATION AVEC LE RENDERER) ===

/**
 * Configure tous les gestionnaires d'événements IPC
 * pour la communication entre le processus principal et le renderer
 */
function setupIpcHandlers() {
  // Masquer la fenêtre sur demande du renderer
  ipcMain.on('hide-window', () => {
    if (win) {
      win.hide()
    }
  })

  // Récupérer la liste des applications installées
  ipcMain.handle('get-applications', async () => {
    return scanApplications()
  })

  // Récupérer la liste des fichiers indexés
  ipcMain.handle('get-files', async () => {
    return scanFiles()
  })

  // Lancer une application
  ipcMain.on('launch-app', (event, execCommand) => {
    if (!execCommand) return

    // Nettoyer la commande exec (enlever les %u, %f, etc. de .desktop files)
    const cleanExec = execCommand.replace(/%[uUfF]/g, '').trim()
    console.log('Launching app with command:', cleanExec)

    // Wrapper avec nohup pour détachement complet
    const wrappedCommand = `nohup ${cleanExec} > /dev/null 2>&1 &`

    launchDetachedProcess(wrappedCommand, 'Application')

    // Cacher la fenêtre après le lancement
    if (win) {
      win.hide()
    }
  })

  // Ouvrir un fichier ou dossier avec l'application par défaut
  ipcMain.on('open-file', (event, filePath) => {
    if (!filePath) return

    console.log('Opening file:', filePath)

    // Utiliser xdg-open pour ouvrir avec l'application par défaut
    const wrappedCommand = `nohup xdg-open "${filePath}" > /dev/null 2>&1 &`

    launchDetachedProcess(wrappedCommand, 'File')

    // Cacher la fenêtre après l'ouverture
    if (win) {
      win.hide()
    }
  })

  // Ouvrir l'emplacement du fichier/dossier dans le gestionnaire de fichiers
  ipcMain.on('open-location', (_event, filePath) => {
    if (!filePath) return

    console.log('Opening location:', filePath)

    // Utiliser xdg-open sur le dossier parent pour les fichiers
    // ou directement sur le dossier lui-même
    const fs = require('fs')
    let targetPath = filePath

    try {
      const stats = fs.statSync(filePath)
      if (!stats.isDirectory()) {
        // Si c'est un fichier, ouvrir le dossier parent
        targetPath = path.dirname(filePath)
      }
    } catch (error) {
      console.error('Error checking file type:', error)
      targetPath = path.dirname(filePath)
    }

    const wrappedCommand = `nohup xdg-open "${targetPath}" > /dev/null 2>&1 &`

    launchDetachedProcess(wrappedCommand, 'Location')

    // Cacher la fenêtre après l'ouverture
    if (win) {
      win.hide()
    }
  })

  // Exécuter une commande dans un terminal
  ipcMain.on('execute-command', (_event, command) => {
    if (!command) return

    console.log('Executing command in terminal:', command)

    // Ouvrir dans x-terminal-emulator avec la commande
    // Le terminal reste ouvert après exécution pour voir les résultats
    const escapedCommand = command.replace(/"/g, '\\"')
    const wrappedCommand = `nohup x-terminal-emulator -e "bash -c '${escapedCommand}; echo; echo Appuyez sur Entrée pour fermer...; read'" > /dev/null 2>&1 &`

    launchDetachedProcess(wrappedCommand, 'Command in terminal')

    // Cacher la fenêtre après l'ouverture
    if (win) {
      win.hide()
    }
  })

  // Rechercher dans les paramètres système
  ipcMain.handle('search-settings', async (_event, query) => {
    return searchSettings(query)
  })

  // Récupérer l'état actuel d'un paramètre (pour le toggle)
  ipcMain.handle('get-setting-state', async (_event, settingId) => {
    return await getSettingState(settingId)
  })

  // Exécuter une action rapide d'un paramètre
  ipcMain.on('execute-setting-action', async (_event, settingId, actionId) => {
    if (!settingId || !actionId) return

    console.log('Executing setting action:', settingId, actionId)

    const setting = getSettingById(settingId)
    if (!setting) {
      console.error('Setting not found:', settingId)
      return
    }

    const action = setting.actions.find(a => a.id === actionId)
    if (!action) {
      console.error('Action not found:', actionId)
      return
    }

    try {
      // Si l'action a une fonction command, l'exécuter
      if (typeof action.command === 'function') {
        const result = await action.command()
        console.log('Action result:', result)
      }
      // Sinon, c'est une commande shell
      else if (typeof action.command === 'string') {
        // Essayer les commandes alternatives si la principale échoue
        const commands = [action.command, action.commandAlt, action.commandAlt2].filter(Boolean)

        let success = false
        for (const cmd of commands) {
          try {
            const wrappedCommand = `nohup ${cmd} > /dev/null 2>&1 &`
            launchDetachedProcess(wrappedCommand, 'Setting action')
            success = true
            break
          } catch (error) {
            console.log(`Command ${cmd} failed, trying next...`)
          }
        }

        if (!success) {
          console.error('All command alternatives failed')
        }
      }
    } catch (error) {
      console.error('Error executing action:', error)
    }

    // Cacher la fenêtre après l'action
    if (win) {
      win.hide()
    }
  })
}

// === GESTION DE L'AUTO-LANCEMENT ===

/**
 * Configure l'auto-lancement de l'application au démarrage du système
 */
async function setupAutoLaunch() {
  if (!autoLauncher) {
    console.warn('Auto-launch not available (package not installed)')
    return
  }

  try {
    // Vérifier si l'auto-lancement est déjà activé
    const isEnabled = await autoLauncher.isEnabled()

    if (!isEnabled) {
      // Activer l'auto-lancement
      await autoLauncher.enable()
      console.log('Auto-launch activé avec succès')
    } else {
      console.log('Auto-launch déjà activé')
    }
  } catch (error) {
    console.error('Erreur lors de la configuration de l\'auto-launch:', error)
  }
}

// === INITIALISATION DE L'APPLICATION ===

/**
 * Point d'entrée principal de l'application
 * Exécuté quand Electron est prêt
 */
app.whenReady().then(async () => {
  // Créer la fenêtre principale
  createWindow()

  // Configurer les handlers IPC
  setupIpcHandlers()

  // Configurer l'auto-lancement
  await setupAutoLaunch()

  // Enregistrer le raccourci global
  const registered = globalShortcut.register(GLOBAL_SHORTCUT, toggleWindow)

  if (!registered) {
    console.error(`Échec de l'enregistrement du raccourci ${GLOBAL_SHORTCUT}`)
  } else {
    console.log(`Raccourci ${GLOBAL_SHORTCUT} enregistré avec succès`)
  }

  // Sur macOS, recréer la fenêtre si l'icône du dock est cliquée
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// === GESTION DU CYCLE DE VIE DE L'APPLICATION ===

/**
 * Nettoyer les ressources avant de quitter
 */
app.on('will-quit', () => {
  // Libérer tous les raccourcis globaux
  globalShortcut.unregisterAll()
})

/**
 * Empêcher l'application de se fermer quand toutes les fenêtres sont fermées
 * L'application reste en arrière-plan pour répondre au raccourci global
 */
app.on('window-all-closed', () => {
  // Ne rien faire - garder l'app active pour le raccourci Alt+Space
})
