/**
 * Finder - Preload Script
 *
 * Ce fichier s'exécute dans un contexte isolé avant le chargement de la page.
 * Il expose une API sécurisée pour permettre au renderer d'interagir avec
 * le processus principal, tout en maintenant la sécurité de l'application.
 *
 * SÉCURITÉ :
 * - contextBridge permet d'exposer des fonctions de manière sécurisée
 * - Le renderer ne peut accéder qu'aux fonctions explicitement exposées
 * - Pas d'accès direct à Node.js ou au processus principal
 */

const { contextBridge, ipcRenderer } = require('electron')

/**
 * API exposée au renderer (frontend)
 * Toutes ces fonctions sont accessibles via window.electronAPI dans le renderer
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Masque la fenêtre de l'application
   * Utilisé pour fermer l'application avec la touche Escape
   */
  hideWindow: () => ipcRenderer.send('hide-window'),

  /**
   * Récupère la liste de toutes les applications installées
   * @returns {Promise<Array>} Liste des applications avec leurs métadonnées
   */
  getApplications: () => ipcRenderer.invoke('get-applications'),

  /**
   * Récupère la liste de tous les fichiers indexés
   * @returns {Promise<Array>} Liste des fichiers avec leurs chemins
   */
  getFiles: () => ipcRenderer.invoke('get-files'),

  /**
   * Lance une application
   * @param {string} execCommand - Commande pour lancer l'application
   */
  launchApp: (execCommand) => ipcRenderer.send('launch-app', execCommand),

  /**
   * Ouvre un fichier ou dossier avec l'application par défaut
   * @param {string} filePath - Chemin absolu du fichier ou dossier
   */
  openFile: (filePath) => ipcRenderer.send('open-file', filePath),

  /**
   * Ouvre un script shell (.sh) dans un terminal
   * @param {string} filePath - Chemin absolu du script shell
   */
  openInTerminal: (filePath) => ipcRenderer.send('open-in-terminal', filePath),

  /**
   * Exécute une commande shell dans un terminal
   * @param {string} command - Commande à exécuter
   */
  executeCommand: (command) => ipcRenderer.send('execute-command', command)
})
