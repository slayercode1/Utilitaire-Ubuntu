/** Validation de la frontière de confiance IPC. */

import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'

import { APP_RENDERER_URL } from '../../shared/app-protocol.js'

type MainIpcEvent = IpcMainEvent | IpcMainInvokeEvent

/**
 * Autorise uniquement le document principal de la fenêtre attendue.
 * Une simple vérification de l'URL ne suffit pas : une frame enfant locale
 * pourrait autrement invoquer les mêmes opérations privilégiées.
 */
export function isTrustedIpcSender(event: MainIpcEvent, trustedContents: WebContents): boolean {
  const frame = event.senderFrame

  return (
    event.sender === trustedContents &&
    frame !== null &&
    frame === trustedContents.mainFrame &&
    frame.url === APP_RENDERER_URL
  )
}
