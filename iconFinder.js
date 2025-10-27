const fs = require('fs')
const path = require('path')

// Cache des icônes trouvées pour améliorer les performances
const iconCache = new Map()

// Fonction récursive pour chercher une icône dans un répertoire
function searchIconRecursive(dir, iconName, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth) return null

  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    // D'abord chercher les fichiers correspondants dans le répertoire actuel
    for (const entry of entries) {
      if (entry.isFile()) {
        const fileName = entry.name
        const baseName = path.basename(fileName, path.extname(fileName))

        // Vérifier si le nom correspond
        if (baseName === iconName || fileName === iconName) {
          return path.join(dir, fileName)
        }
      }
    }

    // Ensuite chercher récursivement dans les sous-répertoires
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const result = searchIconRecursive(
          path.join(dir, entry.name),
          iconName,
          maxDepth,
          currentDepth + 1
        )
        if (result) return result
      }
    }
  } catch (error) {
    // Ignorer les erreurs de permission
    return null
  }

  return null
}

// Trouver une icône de manière exhaustive
function findIcon(iconName) {
  if (!iconName) return null

  // Vérifier le cache
  if (iconCache.has(iconName)) {
    return iconCache.get(iconName)
  }

  // Si c'est un chemin absolu, le retourner directement
  if (iconName.startsWith('/')) {
    if (fs.existsSync(iconName)) {
      iconCache.set(iconName, iconName)
      return iconName
    }

    // Pour les snaps avec version spécifique, essayer de trouver d'autres versions
    const snapMatch = iconName.match(/\/snap\/([^/]+)\/(\d+|current)\/(.+)/)
    if (snapMatch) {
      const [, snapName, , relativePath] = snapMatch
      const snapBaseDir = `/snap/${snapName}`

      try {
        if (fs.existsSync(snapBaseDir)) {
          const versions = fs.readdirSync(snapBaseDir)
            .filter(v => v !== 'current' && /^\d+$/.test(v))
            .sort((a, b) => parseInt(b) - parseInt(a)) // Trier par version décroissante

          for (const version of versions) {
            const iconPath = path.join(snapBaseDir, version, relativePath)
            if (fs.existsSync(iconPath)) {
              iconCache.set(iconName, iconPath)
              return iconPath
            }
          }
        }
      } catch (e) {
        // Ignorer les erreurs
      }
    }

    return null
  }

  // Répertoires principaux à chercher (ordre de priorité)
  const searchDirs = [
    '/usr/share/pixmaps',
    '/usr/share/icons',
    '/var/lib/snapd/desktop/icons',
    '/var/lib/flatpak/exports/share/icons',
    path.join(process.env.HOME || '', '.local/share/icons'),
    path.join(process.env.HOME || '', '.icons')
  ]

  // Chercher dans chaque répertoire
  for (const dir of searchDirs) {
    const result = searchIconRecursive(dir, iconName, 4)
    if (result) {
      iconCache.set(iconName, result)
      return result
    }
  }

  iconCache.set(iconName, null)
  return null
}

module.exports = { findIcon }
