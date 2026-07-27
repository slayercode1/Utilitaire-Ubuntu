/** Protocole interne restreint remplaçant le chargement privilégié file://. */

import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'

import { APP_RENDERER_URL, APP_SCHEME } from '../shared/app-protocol.js'
import { RENDERER_ROOT } from './config.js'
import { scanApplications } from './scanners/app-scanner.js'
import { scanFiles } from './scanners/file-scanner.js'
import {
  getMediaCandidate,
  isIndexedMediaPath,
  isSupportedMediaPath,
  resolveRendererAsset
} from './services/protocol-security.js'
import { getCachedScan, SCAN_KEYS } from './services/scan-cache.js'
import { validateAndSanitizePath } from './services/validation.js'

/** Doit être appelé une seule fois, avant l'événement ready d'Electron. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        bypassCSP: false,
        allowServiceWorkers: false,
        supportFetchAPI: false,
        corsEnabled: false,
        stream: false,
        codeCache: true
      }
    }
  ])
}

/** Retourne un chemin média réel et indexé, ou null en cas de refus. */
function resolveTrustedMedia(requestUrl: string): string | null {
  const candidate = getMediaCandidate(requestUrl)
  if (!candidate) return null

  const applications = getCachedScan(SCAN_KEYS.applications, scanApplications)
  const files = getCachedScan(SCAN_KEYS.files, scanFiles)
  if (!isIndexedMediaPath(candidate, applications, files)) return null

  // Revalide la cible réelle au dernier moment : un lien symbolique a pu être
  // remplacé depuis le scan initial.
  const realPath = validateAndSanitizePath(candidate)
  return realPath && isSupportedMediaPath(realPath) ? realPath : null
}

/** Enregistre le handler dans la session par défaut, après ready. */
export async function registerAppProtocol(): Promise<void> {
  if (protocol.isProtocolHandled(APP_SCHEME)) {
    throw new Error(`Le protocole ${APP_SCHEME} est déjà enregistré`)
  }

  await protocol.handle(APP_SCHEME, (request) => {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'GET' }
      })
    }

    const staticPath = resolveRendererAsset(request.url, RENDERER_ROOT)
    const mediaPath = staticPath ? null : resolveTrustedMedia(request.url)
    const target = staticPath ?? mediaPath

    if (!target) return new Response('Not Found', { status: 404 })

    return net.fetch(pathToFileURL(target).href)
  })

  console.log(`Protocole interne enregistré : ${APP_RENDERER_URL}`)
}
