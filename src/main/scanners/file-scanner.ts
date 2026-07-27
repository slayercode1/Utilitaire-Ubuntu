/**
 * Finder - File Scanner
 *
 * Indexe les fichiers et dossiers du répertoire HOME de l'utilisateur.
 *
 * PERFORMANCE :
 * - Profondeur maximale de 4 niveaux pour limiter le temps de scan
 * - Parcours itératif : pas de recopie de tableau à chaque niveau
 * - Ignore les dossiers courants (node_modules, .git, etc.) dès leur entrée,
 *   ce qui évite de descendre dans des arborescences entières
 * - Les liens symboliques ne sont résolus que pour les entrées effectivement
 *   retenues, et les dossiers déjà visités ne sont jamais re-parcourus
 */

import fs from 'node:fs'
import path from 'node:path'
import { HOME, SYSTEM_DATA_ROOTS } from '../../shared/paths.js'
import type { FileEntry, RuntimeValue } from '../../shared/types.js'
import { isPathInside } from '../services/path-security.js'

/**
 * Caractères interdits dans un chemin indexable.
 * Défini une seule fois : recompiler la regex à chaque appel est coûteux
 * sur des dizaines de milliers d'entrées.
 */
const UNSAFE_PATH_CHARS = /[<>"|?*\x00-\x1f]/

/** Longueur maximale d'un chemin (prévention DoS). */
const MAX_PATH_LENGTH = 4096

function isSecurePath(filePath: RuntimeValue): filePath is string {
  if (typeof filePath !== 'string') return false
  if (filePath.length > MAX_PATH_LENGTH) return false

  return !UNSAFE_PATH_CHARS.test(filePath)
}

/**
 * Extensions à ignorer lors du scan.
 * Set plutôt que tableau : la vérification est faite pour chaque fichier.
 */
const IGNORED_EXTENSIONS = new Set(['.tmp', '.cache', '.log', '.swp', '.bak', '.pyc', '.o'])

/**
 * Noms de dossiers à ne jamais parcourir.
 *
 * La comparaison se fait sur le nom exact du dossier, pas sur une sous-chaîne
 * du chemin : sinon un dossier légitime nommé « cachette » ou « mon-snapshot »
 * serait exclu de l'index.
 */
const IGNORED_DIRS = new Set([
  // Dépendances et builds
  'node_modules',
  '.npm',
  '.cargo',
  '.rustup',
  '.gradle',
  '.m2',
  '.ivy2',
  '.sbt',
  'vendor',
  'target',
  'dist',
  'build',

  // Contrôle de version
  '.git',
  '.svn',
  '.hg',

  // Caches et données d'applications
  '.mozilla',
  '.thunderbird',
  '.wine',
  'snap',
  '.snap',
  '.cache',
  'Cache',
  'cache',
  '.local',
  '.var',
  '.steam',
  '.nvm',
  '.docker',
  '.pub-cache',
  '.dart-tool',
  '.pnpm-store',
  '.yarn',
  '.bun',
  '.deno',
  '.go',
  '.conda',
  '.julia',

  // Configuration d'IDEs
  '.config',
  '.vscode',
  '.vscode-server',
  '.idea',

  // Caches Python et JS
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.venv',
  'venv',
  '.next',
  '.nuxt'
])

/**
 * Profondeur maximale de scan : bon compromis entre couverture et performance.
 */
const MAX_SCAN_DEPTH = 4

/**
 * Nombre maximal d'entrées indexées.
 *
 * Un HOME très fourni peut contenir des centaines de milliers de fichiers ;
 * au-delà de cette limite, la mémoire et le temps de filtrage côté interface
 * deviennent le vrai goulot d'étranglement.
 */
const MAX_INDEXED_ENTRIES = 50000

/**
 * Vérifie qu'un lien symbolique pointe vers HOME ou un emplacement système
 * partagé : un lien pointant ailleurs est ignoré, pour éviter d'indexer des
 * zones hors du périmètre de l'utilisateur.
 */
function resolveSafeSymlink(fullPath: string, homeDir: string): string | null {
  try {
    const realPath = fs.realpathSync(fullPath)

    const allowed =
      isPathInside(realPath, homeDir) ||
      SYSTEM_DATA_ROOTS.some((root) => isPathInside(realPath, root))

    if (!allowed || !isSecurePath(realPath)) {
      return null
    }

    return realPath
  } catch {
    // Lien cassé ou inaccessible
    return null
  }
}

/**
 * Scanne un répertoire et ses sous-répertoires.
 *
 * Le parcours est itératif (file d'attente) plutôt que récursif : la version
 * récursive concaténait les résultats de chaque sous-dossier dans le tableau
 * parent, recopiant les mêmes entrées une fois par niveau de profondeur.
 */
function scanDirectoryIterative(rootDir: string, maxDepth: number = MAX_SCAN_DEPTH): FileEntry[] {
  const results: FileEntry[] = []

  // Dossiers déjà parcourus, pour ne pas boucler sur un lien symbolique
  const visited = new Set<string>()

  // File d'attente parcourue via un curseur : Array.shift() recopie tout le
  // tableau à chaque retrait, ce qui devient coûteux sur des milliers de dossiers.
  const queue: { dir: string; depth: number }[] = [{ dir: rootDir, depth: 0 }]
  let cursor = 0

  while (cursor < queue.length) {
    const current = queue[cursor++]
    if (!current) break

    const { dir, depth } = current

    if (depth > maxDepth) continue
    if (results.length >= MAX_INDEXED_ENTRIES) break

    let realDir: string
    try {
      realDir = fs.realpathSync(dir)
    } catch {
      continue
    }

    if (visited.has(realDir)) continue
    visited.add(realDir)

    let entries: fs.Dirent[]
    try {
      // withFileTypes évite un stat() par entrée : le type est déjà connu
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      // Permissions insuffisantes : c'est normal sur certains dossiers
      continue
    }

    for (const entry of entries) {
      if (results.length >= MAX_INDEXED_ENTRIES) break

      const name = entry.name

      // Les données cachées à la racine de HOME contiennent fréquemment des
      // clés, tokens et configurations. Elles ne doivent jamais traverser IPC.
      if (name.startsWith('.')) continue

      // Écarter les dossiers exclus avant tout appel système
      if (IGNORED_DIRS.has(name)) continue

      const fullPath = path.join(dir, name)

      if (!isSecurePath(fullPath)) continue

      // Le type d'un lien symbolique doit être résolu explicitement
      let isDirectory = entry.isDirectory()
      let isFile = entry.isFile()

      if (entry.isSymbolicLink()) {
        const realPath = resolveSafeSymlink(fullPath, rootDir)
        if (!realPath) continue

        try {
          const stats = fs.statSync(realPath)
          isDirectory = stats.isDirectory()
          isFile = stats.isFile()
        } catch {
          continue
        }
      }

      if (isFile) {
        const ext = path.extname(name).toLowerCase()
        if (IGNORED_EXTENSIONS.has(ext)) continue

        results.push({ path: fullPath, name, type: 'file' })
      } else if (isDirectory) {
        results.push({ path: fullPath, name, type: 'folder' })

        if (depth < maxDepth) {
          queue.push({ dir: fullPath, depth: depth + 1 })
        }
      }
    }
  }

  return results
}

/** Scanne tous les fichiers et dossiers du répertoire HOME. */
export function scanFiles(): FileEntry[] {
  console.log('📁 Starting file scan from HOME directory...')

  if (!HOME) {
    console.error('❌ HOME directory not found')
    return []
  }

  const startedAt = Date.now()
  const allFiles = scanDirectoryIterative(HOME, MAX_SCAN_DEPTH)
  const elapsed = Date.now() - startedAt

  if (allFiles.length >= MAX_INDEXED_ENTRIES) {
    console.warn(`⚠️  Limite de ${MAX_INDEXED_ENTRIES} entrées atteinte, index tronqué`)
  }

  console.log(`✅ File scan complete: ${allFiles.length} items indexed in ${elapsed}ms`)

  return allFiles
}
