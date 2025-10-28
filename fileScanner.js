/**
 * Finder - File Scanner
 *
 * Ce module scanne le répertoire HOME de l'utilisateur pour indexer
 * les fichiers et dossiers. Il utilise des filtres pour ignorer les
 * fichiers temporaires et les dossiers système.
 *
 * PERFORMANCE :
 * - Profondeur maximale de 4 niveaux pour limiter le temps de scan
 * - Ignore les dossiers courants (node_modules, .git, etc.)
 * - Ignore les fichiers temporaires et de cache
 */

const fs = require('fs')
const path = require('path')

// === CONFIGURATION ===

/**
 * Extensions de fichiers à ignorer lors du scan
 * Principalement des fichiers temporaires et de cache
 */
const IGNORED_EXTENSIONS = [
  '.tmp',    // Fichiers temporaires
  '.cache',  // Fichiers de cache
  '.log',    // Fichiers de log
  '.swp',    // Fichiers swap de vim
  '.bak',    // Fichiers de backup
  '.pyc',    // Python compiled
  '.o'       // Fichiers objets C/C++
]

/**
 * Dossiers à ignorer complètement lors du scan
 * Utilise un Set pour des recherches O(1)
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

  // Contrôle de version
  '.git',

  // Caches et données d'applications
  '.mozilla',
  '.thunderbird',
  '.wine',
  'snap',
  '.local/share/Trash',
  '.cache',
  'Cache',
  'cache',

  // Configuration d'IDEs
  '.config',
  '.vscode',
  '.idea',

  // Caches Python
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache'
])

/**
 * Profondeur maximale de scan dans l'arborescence
 * 4 niveaux = bon compromis entre couverture et performance
 */
const MAX_SCAN_DEPTH = 4

// === FONCTIONS DE SCAN ===

/**
 * Vérifie si un chemin contient un dossier ignoré
 * @param {string} relativePath - Chemin relatif depuis HOME
 * @returns {boolean} true si le chemin doit être ignoré
 */
function shouldIgnorePath(relativePath) {
  for (const ignoredDir of IGNORED_DIRS) {
    if (relativePath.includes(ignoredDir)) {
      return true
    }
  }
  return false
}

/**
 * Scanne récursivement un répertoire et retourne tous les fichiers/dossiers
 * @param {string} dir - Répertoire à scanner
 * @param {number} maxDepth - Profondeur maximale de récursion
 * @param {number} currentDepth - Profondeur actuelle (pour la récursion)
 * @returns {Array} Liste des fichiers et dossiers trouvés
 */
function scanDirectoryRecursive(dir, maxDepth = MAX_SCAN_DEPTH, currentDepth = 0) {
  const results = []

  // Arrêter si on a atteint la profondeur maximale
  if (currentDepth > maxDepth) {
    return results
  }

  try {
    // Vérifier que le répertoire existe et est bien un dossier
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return results
    }

    // Lire toutes les entrées du répertoire
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      // Ignorer les fichiers/dossiers cachés (sauf à la racine HOME)
      if (entry.name.startsWith('.') && currentDepth > 0) {
        continue
      }

      // Ignorer les dossiers dans la liste d'exclusion
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
        continue
      }

      // Ignorer si le chemin contient un dossier exclu
      const relativePath = path.relative(process.env.HOME, fullPath)
      if (shouldIgnorePath(relativePath)) {
        continue
      }

      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()

        // Ignorer les extensions non désirées
        if (!IGNORED_EXTENSIONS.includes(ext)) {
          results.push({
            path: fullPath,
            name: entry.name,
            type: 'file'
          })
        }
      } else if (entry.isDirectory()) {
        // Ajouter le dossier aux résultats
        results.push({
          path: fullPath,
          name: entry.name,
          type: 'folder'
        })

        // Scanner récursivement le sous-dossier
        const subFiles = scanDirectoryRecursive(
          fullPath,
          maxDepth,
          currentDepth + 1
        )
        results.push(...subFiles)
      }
    }
  } catch (error) {
    // Ignorer silencieusement les erreurs (permissions, etc.)
    // C'est normal de ne pas avoir accès à certains dossiers
  }

  return results
}

/**
 * Point d'entrée principal : scanne tous les fichiers du répertoire HOME
 * @returns {Array} Liste complète des fichiers et dossiers indexés
 */
function scanFiles() {
  console.log('📁 Starting file scan from HOME directory...')

  const homeDir = process.env.HOME

  if (!homeDir) {
    console.error('❌ HOME directory not found')
    return []
  }

  const allFiles = scanDirectoryRecursive(homeDir, MAX_SCAN_DEPTH, 0)

  console.log(`✅ File scan complete: ${allFiles.length} items indexed`)

  return allFiles
}

// === EXPORTS ===

module.exports = { scanFiles }
