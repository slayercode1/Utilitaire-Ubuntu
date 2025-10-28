const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron/main')
const path = require('node:path')
const { spawn } = require('child_process')
const { scanApplications } = require('./appScanner')
const { scanFiles } = require('./fileScanner')

let win = null

const createWindow = () => {
  const options = {
    width: 600,
    height: 500,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  }

  // Sur Linux, utiliser le type 'notification' pour éviter la taskbar
  if (process.platform === 'linux') {
    options.type = 'notification'
  }

  win = new BrowserWindow(options)

  // Définir le type de fenêtre après création pour éviter l'erreur
  win.setSkipTaskbar(true)

  // Sur Linux, forcer le comportement sans taskbar
  if (process.platform === 'linux') {
    win.once('ready-to-show', () => {
      win.setSkipTaskbar(true)
    })
  }

  win.loadFile('index.html')

  // Positionner la fenêtre en haut de l'écran
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const x = Math.floor((width - 600) / 2)
  const y = Math.floor(height * 0.15)

  win.setPosition(x, y)

  // Cacher la fenêtre au démarrage
  win.hide()

  // Cacher la fenêtre quand elle perd le focus
  win.on('blur', () => {
    win.hide()
  })
}

const toggleWindow = () => {
  if (!win) return

  if (win.isVisible()) {
    win.hide()
  } else {
    // Repositionner la fenêtre avant de l'afficher
    const { screen } = require('electron')
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize

    const x = Math.floor((width - 600) / 2)
    const y = Math.floor(height * 0.15)

    win.setPosition(x, y)
    // Forcer skipTaskbar avant d'afficher
    win.setSkipTaskbar(true)
    win.show()
    win.focus()
  }
}

app.whenReady().then(() => {
  createWindow()

  // Écouter l'événement de fermeture depuis le renderer
  ipcMain.on('hide-window', () => {
    if (win) {
      win.hide()
    }
  })

  // Gérer la récupération des applications
  ipcMain.handle('get-applications', async () => {
    return scanApplications()
  })

  // Gérer la récupération des fichiers
  ipcMain.handle('get-files', async () => {
    return scanFiles()
  })

  // Gérer le lancement d'application
  ipcMain.on('launch-app', (event, execCommand) => {
    if (execCommand) {
      // Nettoyer la commande exec (enlever les %u, %f, etc.)
      const cleanExec = execCommand.replace(/%[uUfF]/g, '').trim()

      console.log('Launching app with command:', cleanExec)

      // Wrapper la commande avec nohup pour un détachement complet
      const wrappedCommand = `nohup ${cleanExec} > /dev/null 2>&1 &`

      // Lancer l'application via le shell de manière complètement détachée
      try {
        const child = spawn('sh', ['-c', wrappedCommand], {
          detached: true,
          stdio: 'ignore'
        })

        // Détacher complètement le processus enfant
        child.unref()

        console.log('App launched successfully')
      } catch (error) {
        console.error('Error launching app:', error)
      }

      // Cacher la fenêtre après le lancement
      if (win) {
        win.hide()
      }
    }
  })

  // Gérer l'ouverture de fichiers/dossiers
  ipcMain.on('open-file', (event, filePath) => {
    if (filePath) {
      console.log('Opening file:', filePath)

      const wrappedCommand = `nohup xdg-open "${filePath}" > /dev/null 2>&1 &`

      try {
        const child = spawn('sh', ['-c', wrappedCommand], {
          detached: true,
          stdio: 'ignore'
        })

        child.unref()

        console.log('File opened successfully')
      } catch (error) {
        console.error('Error opening file:', error)
      }

      // Cacher la fenêtre après l'ouverture
      if (win) {
        win.hide()
      }
    }
  })

  // Enregistrer le raccourci global Alt+Space
  const ret = globalShortcut.register('Alt+Space', () => {
    toggleWindow()
  })

  if (!ret) {
    console.log('Échec de l\'enregistrement du raccourci')
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('will-quit', () => {
  // Libérer tous les raccourcis
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Ne pas quitter l'application quand toutes les fenêtres sont fermées
  // L'app reste en arrière-plan pour le raccourci Ctrl+Space
})