/** Validation pure des URLs du protocole applicatif. */

import path from 'node:path'

import { APP_HOST, APP_SCHEME } from '../../shared/app-protocol.js'
import type { AppEntry, FileEntry } from '../../shared/types.js'

/** Seuls ces fichiers compilés peuvent être servis comme code d'interface. */
const RENDERER_ASSETS = new Set([
  '/index.html',
  '/styles.css',
  '/main.js',
  '/features/conversion/convert-units.js',
  '/features/conversion/evaluate-math.js'
])

const MEDIA_EXTENSIONS = new Set([
  '.bmp',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
  '.xpm'
])

export function isSupportedMediaPath(candidate: string): boolean {
  return MEDIA_EXTENSIONS.has(path.extname(candidate).toLowerCase())
}

function parseAppUrl(requestUrl: string): URL | null {
  try {
    const parsed = new URL(requestUrl)
    if (parsed.protocol !== `${APP_SCHEME}:` || parsed.host !== APP_HOST) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** Résout une ressource statique explicitement livrée avec le renderer. */
export function resolveRendererAsset(requestUrl: string, rendererRoot: string): string | null {
  const parsed = parseAppUrl(requestUrl)
  if (!parsed || parsed.search || parsed.hash || !RENDERER_ASSETS.has(parsed.pathname)) {
    return null
  }

  return path.join(rendererRoot, ...parsed.pathname.split('/').filter(Boolean))
}

/** Extrait le chemin demandé par la route média, sans encore lui faire confiance. */
export function getMediaCandidate(requestUrl: string): string | null {
  const parsed = parseAppUrl(requestUrl)
  if (parsed?.pathname !== '/media' || parsed.hash) return null

  const keys = [...parsed.searchParams.keys()]
  if (keys.length !== 1 || keys[0] !== 'path') return null

  const candidate = parsed.searchParams.get('path')
  if (!candidate || !path.isAbsolute(candidate) || candidate.length > 4096) {
    return null
  }

  return candidate
}

/**
 * Vérifie l'appartenance exacte aux index détenus par le main. Le realpath et
 * les racines autorisées sont contrôlés séparément juste avant la lecture.
 */
export function isIndexedMediaPath(
  candidate: string,
  applications: readonly AppEntry[],
  files: readonly FileEntry[]
): boolean {
  if (!isSupportedMediaPath(candidate)) return false

  return (
    applications.some((entry) => entry.iconPath === candidate) ||
    files.some((entry) => entry.type === 'file' && entry.path === candidate)
  )
}
