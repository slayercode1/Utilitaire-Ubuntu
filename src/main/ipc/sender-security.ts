/** Validation de la frontière de confiance IPC. */

import { pathToFileURL } from 'node:url'
import type {
  IpcMainEvent,
  IpcMainInvokeEvent,
  WebContents
} from 'electron'

import { INDEX_HTML_PATH } from '../config.js'

export type MainIpcEvent = IpcMainEvent | IpcMainInvokeEvent

export const TRUSTED_RENDERER_URL = pathToFileURL(INDEX_HTML_PATH).href

/**
 * Autorise uniquement le document principal de la fenêtre attendue.
 * Une simple vérification de l'URL ne suffit pas : une frame enfant locale
 * pourrait autrement invoquer les mêmes opérations privilégiées.
 */
export function isTrustedIpcSender(
  event: MainIpcEvent,
  trustedContents: WebContents
): boolean {
  const frame = event.senderFrame

  return (
    event.sender === trustedContents &&
    frame !== null &&
    frame === trustedContents.mainFrame &&
    frame.url === TRUSTED_RENDERER_URL
  )
}
