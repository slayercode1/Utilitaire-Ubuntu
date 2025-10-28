const { contextBridge, ipcRenderer } = require('electron')

// Exposer une API sécurisée pour communiquer avec le processus principal
contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  getApplications: () => ipcRenderer.invoke('get-applications'),
  getFiles: () => ipcRenderer.invoke('get-files'),
  launchApp: (appPath) => ipcRenderer.send('launch-app', appPath),
  openFile: (filePath) => ipcRenderer.send('open-file', filePath)
})