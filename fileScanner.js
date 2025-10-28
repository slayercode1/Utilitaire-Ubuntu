const fs = require('fs')
const path = require('path')

// Extensions de fichiers à ignorer
const ignoredExtensions = [
  '.tmp', '.cache', '.log', '.swp', '.bak', '.pyc', '.o'
]

// Dossiers à ignorer complètement
const ignoredDirs = new Set([
  'node_modules',
  '.git',
  '.npm',
  '.cargo',
  '.rustup',
  '.mozilla',
  '.thunderbird',
  '.wine',
  'snap',
  '.local/share/Trash',
  '.cache',
  'Cache',
  'cache',
  '.config',
  '.vscode',
  '.idea',
  '.gradle',
  '.m2',
  '.ivy2',
  '.sbt',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache'
])

// Fonction récursive pour scanner les fichiers
function scanDirectoryRecursive(dir, maxDepth = 4, currentDepth = 0) {
  const files = []

  if (currentDepth > maxDepth) {
    return files
  }

  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return files
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      // Ignorer les fichiers/dossiers cachés (sauf si on est à la racine HOME)
      if (entry.name.startsWith('.') && currentDepth > 0) {
        continue
      }

      // Ignorer les dossiers spécifiques
      if (entry.isDirectory() && ignoredDirs.has(entry.name)) {
        continue
      }

      // Ignorer les chemins relatifs contenant des dossiers ignorés
      const relativePath = path.relative(process.env.HOME, fullPath)
      let shouldIgnore = false
      for (const ignoredDir of ignoredDirs) {
        if (relativePath.includes(ignoredDir)) {
          shouldIgnore = true
          break
        }
      }
      if (shouldIgnore) continue

      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()

        // Ignorer les extensions non désirées
        if (!ignoredExtensions.includes(ext)) {
          files.push({
            path: fullPath,
            name: entry.name,
            type: 'file'
          })
        }
      } else if (entry.isDirectory()) {
        // Ajouter le dossier
        files.push({
          path: fullPath,
          name: entry.name,
          type: 'folder'
        })

        // Scanner récursivement
        const subFiles = scanDirectoryRecursive(
          fullPath,
          maxDepth,
          currentDepth + 1
        )
        files.push(...subFiles)
      }
    }
  } catch (error) {
    // Ignorer les erreurs de permission
  }

  return files
}

// Scanner tous les fichiers du répertoire HOME
function scanFiles() {
  console.log('Starting file scan from HOME directory...')
  console.log('No file limit - scanning all accessible files...')

  const homeDir = process.env.HOME
  const allFiles = scanDirectoryRecursive(homeDir, 4, 0)

  console.log(`Total files scanned: ${allFiles.length}`)

  return allFiles
}

module.exports = { scanFiles }
