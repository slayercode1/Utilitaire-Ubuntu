/**
 * Déclaration de la surface exposée au renderer.
 *
 * Ce fichier n'est jamais compilé vers du JavaScript : il décrit uniquement,
 * pour la vérification de types, ce que le preload rend accessible via
 * contextBridge.
 */

import type { ElectronApi } from '../shared/types.js'

declare global {
  interface Window {
    electronAPI: ElectronApi
  }
}
