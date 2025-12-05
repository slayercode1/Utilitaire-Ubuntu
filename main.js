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
const fs = require('fs')
const { scanApplications } = require('./appScanner')
const { scanFiles } = require('./fileScanner')
const { searchSettings, getSettingById, getSettingState } = require('./settingsScanner')

// === SÉCURITÉ : FONCTIONS DE VALIDATION ===

/**
 * Valide et nettoie un chemin de fichier pour prévenir les attaques Path Traversal
 * @param {string} filePath - Chemin à valider
 * @returns {string|null} Chemin sécurisé ou null si invalide
 */
function validateAndSanitizePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    console.error('Invalid file path: not a string')
    return null
  }

  try {
    // Résoudre le chemin absolu et normaliser
    const resolvedPath = path.resolve(filePath)

    // Vérifier que le fichier existe
    if (!fs.existsSync(resolvedPath)) {
      console.error('File does not exist')
      return null
    }

    // Obtenir le répertoire HOME de l'utilisateur
    const homeDir = process.env.HOME || process.env.USERPROFILE

    // Autoriser uniquement les fichiers dans HOME ou des répertoires système sûrs
    const allowedPaths = [
      homeDir,
      '/usr/share',
      '/opt',
      '/var/lib/flatpak',
      '/var/lib/snapd'
    ]

    const isAllowed = allowedPaths.some(allowedPath =>
      resolvedPath.startsWith(allowedPath)
    )

    if (!isAllowed) {
      console.error('Access denied: path outside allowed directories')
      return null
    }

    // Interdire les fichiers sensibles
    const forbiddenPatterns = [
      '/etc/passwd',
      '/etc/shadow',
      '/etc/sudoers',
      '/.ssh/',
      '/id_rsa',
      '/id_ed25519'
    ]

    const isForbidden = forbiddenPatterns.some(pattern =>
      resolvedPath.includes(pattern)
    )

    if (isForbidden) {
      console.error('Access denied: forbidden file pattern')
      return null
    }

    return resolvedPath
  } catch (error) {
    console.error('Path validation error')
    return null
  }
}

/**
 * Valide une commande d'exécution d'application
 * @param {string} execCommand - Commande à valider
 * @returns {string|null} Commande sécurisée ou null si invalide
 */
function validateExecCommand(execCommand) {
  if (!execCommand || typeof execCommand !== 'string') {
    return null
  }

  // Nettoyer la commande (enlever les %u, %f, etc. de .desktop files)
  const cleanExec = execCommand.replace(/%[uUfFdDnNickvm]/g, '').trim()

  if (!cleanExec) {
    return null
  }

  // SÉCURITÉ : Limite de longueur pour éviter DoS
  if (cleanExec.length > 1000) {
    console.error('Command length exceeds limit')
    return null
  }

  // Vérifier qu'il n'y a pas de caractères dangereux pour l'injection
  const dangerousPatterns = [
    /[;&|`$(){}]/,  // Métacaractères shell dangereux
    /\$\(/,          // Command substitution
    /`/,             // Backticks
    /\|\|/,          // OR operator
    /&&/,            // AND operator
    />\s*\/dev/,     // Redirection vers /dev
    /rm\s+-rf/i,     // Commandes destructives
    /:\(\)\{/        // Fork bomb
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(cleanExec)) {
      console.error('Dangerous pattern detected in command')
      return null
    }
  }

  return cleanExec
}

/**
 * Parse une ligne de commande en arguments (gère les guillemets)
 * @param {string} commandLine - Ligne de commande à parser
 * @returns {string[]} Tableau d'arguments
 */
function parseCommandArguments(commandLine) {
  const args = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i]
    const nextChar = commandLine[i + 1]

    if ((char === '"' || char === "'") && !inQuotes) {
      // Début de citation
      inQuotes = true
      quoteChar = char
    } else if (char === quoteChar && inQuotes) {
      // Fin de citation
      inQuotes = false
      quoteChar = ''
    } else if (char === ' ' && !inQuotes) {
      // Séparateur d'argument
      if (current) {
        args.push(current)
        current = ''
      }
    } else if (char === '\\' && inQuotes && (nextChar === '"' || nextChar === "'")) {
      // Échappement de guillemet
      current += nextChar
      i++ // Skip next char
    } else {
      current += char
    }
  }

  if (current) {
    args.push(current)
  }

  return args
}

/**
 * Valide une commande shell utilisateur
 * @param {string} command - Commande à valider
 * @returns {string|null} Commande sécurisée ou null si invalide
 */
function validateUserCommand(command) {
  if (!command || typeof command !== 'string') {
    return null
  }

  const trimmed = command.trim()

  if (trimmed.length === 0 || trimmed.length > 1000) {
    console.error('Command length invalid')
    return null
  }

  // Interdire les commandes extrêmement dangereuses
  const blockedCommands = [
    /^\s*rm\s+-rf\s+\//i,           // rm -rf /
    /:\(\)\{.*:\|:&\};:/,            // Fork bomb
    /dd\s+if=.*of=\/dev\/sd/i,      // Overwrite disk
    /mkfs/i,                         // Format filesystem
    />\s*\/dev\/sd/,                 // Write to disk
    /wget.*\|\s*sh/i,                // Download and execute
    /curl.*\|\s*sh/i,                // Download and execute
    /nc\s+-l/i,                      // Netcat listener
    /\/dev\/tcp/,                    // TCP connections
  ]

  for (const blocked of blockedCommands) {
    if (blocked.test(trimmed)) {
      console.error('Blocked dangerous command')
      return null
    }
  }

  return trimmed
}

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
      nodeIntegration: false,   // Sécurité : pas d'accès direct à Node.js
      sandbox: true,            // SÉCURITÉ : Activer le sandboxing
      enableRemoteModule: false // SÉCURITÉ : Désactiver le module remote
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
 * Lance un processus de manière détachée SÉCURISÉE
 * @param {string[]} args - Arguments de la commande (pas de shell string!)
 * @param {string} description - Description pour les logs
 * @returns {boolean} - true si lancé avec succès, false sinon
 */
function launchDetachedProcess(args, description) {
  try {
    if (!Array.isArray(args) || args.length === 0) {
      console.error('Invalid arguments for launching process')
      return false
    }

    // Utiliser spawn avec des arguments séparés (PAS de shell -c)
    // pour éviter l'injection de commandes
    const child = spawn(args[0], args.slice(1), {
      detached: true,
      stdio: 'ignore',
      shell: false  // CRITIQUE : désactiver le shell
    })

    child.unref()
    console.log(`${description} launched successfully`)
    return true
  } catch (error) {
    console.error(`Error launching ${description}:`, error.message)
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

    // SÉCURITÉ : Valider la commande
    const cleanExec = validateExecCommand(execCommand)
    if (!cleanExec) {
      console.error('Invalid or dangerous command blocked')
      return
    }

    console.log('Launching app with validated command')

    // SÉCURITÉ : Parser correctement les arguments (gère les guillemets)
    const args = parseCommandArguments(cleanExec)

    if (args.length === 0) {
      console.error('No arguments parsed from command')
      return
    }

    // Lancer de manière sécurisée
    launchDetachedProcess(args, 'Application')

    // Cacher la fenêtre après le lancement
    if (win) {
      win.hide()
    }
  })

  // Ouvrir un fichier ou dossier avec l'application par défaut
  ipcMain.on('open-file', (event, filePath) => {
    if (!filePath) return

    // SÉCURITÉ : Valider le chemin du fichier
    const validPath = validateAndSanitizePath(filePath)
    if (!validPath) {
      console.error('Invalid or forbidden file path blocked')
      return
    }

    console.log('Opening validated file')

    // Utiliser xdg-open avec des arguments séparés (pas de shell)
    launchDetachedProcess(['xdg-open', validPath], 'File')

    // Cacher la fenêtre après l'ouverture
    if (win) {
      win.hide()
    }
  })

  // Ouvrir l'emplacement du fichier/dossier dans le gestionnaire de fichiers
  ipcMain.on('open-location', (_event, filePath) => {
    if (!filePath) return

    // SÉCURITÉ : Valider le chemin du fichier
    const validPath = validateAndSanitizePath(filePath)
    if (!validPath) {
      console.error('Invalid or forbidden file path blocked')
      return
    }

    console.log('Opening validated location')

    // Utiliser xdg-open sur le dossier parent pour les fichiers
    // ou directement sur le dossier lui-même
    let targetPath = validPath

    try {
      const stats = fs.statSync(validPath)
      if (!stats.isDirectory()) {
        // Si c'est un fichier, ouvrir le dossier parent
        targetPath = path.dirname(validPath)
      }
    } catch (error) {
      console.error('Error checking file type:', error.message)
      targetPath = path.dirname(validPath)
    }

    // Lancer de manière sécurisée
    launchDetachedProcess(['xdg-open', targetPath], 'Location')

    // Cacher la fenêtre après l'ouverture
    if (win) {
      win.hide()
    }
  })

  // Exécuter une commande dans un terminal
  ipcMain.on('execute-command', (_event, command) => {
    if (!command) return

    // SÉCURITÉ : Valider la commande utilisateur
    const validCommand = validateUserCommand(command)
    if (!validCommand) {
      console.error('Invalid or dangerous command blocked')
      return
    }

    console.log('Executing validated command in terminal')

    // SÉCURITÉ : Créer un fichier script temporaire au lieu d'interpolation
    // Cela empêche toute injection même avec des caractères Unicode ou échappements
    const crypto = require('crypto')
    const scriptId = crypto.randomBytes(8).toString('hex')
    const scriptPath = path.join(require('os').tmpdir(), `finder-cmd-${scriptId}.sh`)

    try {
      // Écrire le script dans un fichier temporaire
      const scriptContent = `#!/bin/bash
${validCommand}
echo
echo "Appuyez sur Entrée pour fermer..."
read
`
      fs.writeFileSync(scriptPath, scriptContent, { mode: 0o700 })

      // Lancer le terminal avec le script
      launchDetachedProcess(['x-terminal-emulator', '-e', scriptPath], 'Command in terminal')

      // Nettoyer le script après 60 secondes (backup si l'auto-suppression échoue)
      setTimeout(() => {
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath)
          }
        } catch (err) {
          // Ignore cleanup errors
        }
      }, 60000)

    } catch (error) {
      console.error('Error creating command script:', error.message)
      return
    }

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
            // SÉCURITÉ : Parser correctement les arguments (gère les guillemets)
            const args = parseCommandArguments(cmd.trim())
            if (args.length > 0) {
              launchDetachedProcess(args, 'Setting action')
              success = true
              break
            }
          } catch (error) {
            console.log('Command failed, trying next alternative')
          }
        }

        if (!success) {
          console.error('All command alternatives failed')
        }
      }
    } catch (error) {
      console.error('Error executing action:', error.message)
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
