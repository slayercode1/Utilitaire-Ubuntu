const fs = require('fs')
const path = require('path')
const { findIcon } = require('./iconFinder')

// Chemins standard pour les fichiers .desktop sur Linux
const desktopDirs = [
  '/usr/share/applications',
  '/usr/local/share/applications',
  '/var/lib/snapd/desktop/applications',
  '/var/lib/flatpak/exports/share/applications',
  path.join(process.env.HOME, '.local/share/applications'),
  path.join(process.env.HOME, 'snap')
]

function parseDesktopFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    const app = {
      name: '',
      description: '',
      icon: '',
      iconPath: '',
      exec: '',
      path: filePath,
      hidden: false
    }

    let inDesktopEntry = false

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed === '[Desktop Entry]') {
        inDesktopEntry = true
        continue
      }

      if (trimmed.startsWith('[') && trimmed !== '[Desktop Entry]') {
        inDesktopEntry = false
        continue
      }

      if (!inDesktopEntry) continue

      if (trimmed.startsWith('Name=') && !app.name) {
        app.name = trimmed.substring(5)
      } else if (trimmed.startsWith('Comment=') && !app.description) {
        app.description = trimmed.substring(8)
      } else if (trimmed.startsWith('GenericName=') && !app.description) {
        app.description = trimmed.substring(12)
      } else if (trimmed.startsWith('Icon=')) {
        app.icon = trimmed.substring(5)
      } else if (trimmed.startsWith('Exec=')) {
        app.exec = trimmed.substring(5)
      } else if (trimmed.startsWith('NoDisplay=true') || trimmed.startsWith('Hidden=true')) {
        app.hidden = true
      }
    }

    // Trouver le chemin complet de l'icône
    if (app.icon) {
      const iconPath = findIcon(app.icon)
      if (iconPath) {
        app.iconPath = iconPath
      }
    }

    return app
  } catch (error) {
    return null
  }
}

function scanApplications() {
  const apps = []

  for (const dir of desktopDirs) {
    try {
      if (!fs.existsSync(dir)) continue

      const files = fs.readdirSync(dir)

      for (const file of files) {
        if (!file.endsWith('.desktop')) continue

        const filePath = path.join(dir, file)
        const app = parseDesktopFile(filePath)

        if (app && app.name && app.exec && !app.hidden) {
          apps.push(app)
        }
      }
    } catch (error) {
      console.error(`Error scanning ${dir}:`, error)
    }
  }

  console.log(`Found ${apps.length} applications before deduplication`)

  // Supprimer les doublons (garder le premier trouvé)
  const uniqueApps = []
  const seenNames = new Set()

  for (const app of apps) {
    if (!seenNames.has(app.name)) {
      seenNames.add(app.name)
      uniqueApps.push(app)
    }
  }

  console.log(`Returning ${uniqueApps.length} unique applications`)

  return uniqueApps.sort((a, b) => a.name.localeCompare(b.name))
}

module.exports = { scanApplications }
