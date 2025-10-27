const { contextBridge, ipcRenderer } = require('electron')

// Exposer une API sécurisée pour communiquer avec le processus principal
contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  getApplications: () => ipcRenderer.invoke('get-applications'),
  launchApp: (appPath) => ipcRenderer.send('launch-app', appPath)
})