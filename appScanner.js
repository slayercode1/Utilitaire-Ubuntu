/**
 * Finder - Application Scanner
 *
 * Ce module scanne les applications installées sur le système Linux
 * en lisant les fichiers .desktop dans les emplacements standard.
 *
 * STANDARDS LINUX :
 * - Les applications sont décrites dans des fichiers .desktop
 * - Ces fichiers suivent la spécification freedesktop.org
 * - Ils contiennent le nom, la description, l'icône et la commande de l'app
 */

const fs = require('fs')
const path = require('path')
const { findIcon } = require('./iconFinder')

// === CONFIGURATION ===

/**
 * Chemins standard pour les fichiers .desktop sur Linux
 * Ordre de priorité : système → local utilisateur → snap → flatpak
 */
const DESKTOP_DIRS = [
  '/usr/share/applications',                                    // Applications système
  '/usr/local/share/applications',                              // Applications installées localement
  '/var/lib/snapd/desktop/applications',                        // Applications Snap
  '/var/lib/flatpak/exports/share/applications',               // Applications Flatpak
  path.join(process.env.HOME, '.local/share/applications'),    // Applications utilisateur
  path.join(process.env.HOME, 'snap')                          // Snap utilisateur
]

// === FONCTIONS DE PARSING ===

/**
 * Parse un fichier .desktop et extrait les métadonnées de l'application
 * @param {string} filePath - Chemin vers le fichier .desktop
 * @returns {Object|null} Objet application ou null si parsing échoue
 */
function parseDesktopFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    // Structure de l'application
    const app = {
      name: '',         // Nom de l'application
      description: '',  // Description ou nom générique
      icon: '',         // Nom de l'icône
      iconPath: '',     // Chemin complet vers l'icône
      exec: '',         // Commande pour lancer l'application
      path: filePath,   // Chemin du fichier .desktop
      hidden: false     // Application cachée ?
    }

    let inDesktopEntry = false

    // Parser ligne par ligne
    for (const line of lines) {
      const trimmed = line.trim()

      // Détecter la section [Desktop Entry]
      if (trimmed === '[Desktop Entry]') {
        inDesktopEntry = true
        continue
      }

      // Si on entre dans une autre section, arrêter
      if (trimmed.startsWith('[') && trimmed !== '[Desktop Entry]') {
        inDesktopEntry = false
        continue
      }

      // Ne traiter que les lignes dans [Desktop Entry]
      if (!inDesktopEntry) continue

      // Extraire les champs importants
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
    // Retourner null si le fichier ne peut pas être lu
    return null
  }
}

/**
 * Vérifie si une application est valide et devrait être affichée
 * @param {Object} app - Objet application
 * @returns {boolean} true si l'application est valide
 */
function isValidApp(app) {
  return app && app.name && app.exec && !app.hidden
}

// === FONCTION PRINCIPALE ===

/**
 * Scanne tous les répertoires d'applications et retourne la liste unique des apps
 * @returns {Array} Liste triée et dédupliquée des applications
 */
function scanApplications() {
  console.log('🔍 Scanning for installed applications...')

  const apps = []

  // Scanner chaque répertoire d'applications
  for (const dir of DESKTOP_DIRS) {
    try {
      // Vérifier que le répertoire existe
      if (!fs.existsSync(dir)) continue

      // Lire tous les fichiers du répertoire
      const files = fs.readdirSync(dir)

      for (const file of files) {
        // Ne traiter que les fichiers .desktop
        if (!file.endsWith('.desktop')) continue

        const filePath = path.join(dir, file)
        const app = parseDesktopFile(filePath)

        // Ajouter l'application si elle est valide
        if (isValidApp(app)) {
          apps.push(app)
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${dir}:`, error.message)
    }
  }

  console.log(`📦 Found ${apps.length} applications before deduplication`)

  // Dédupliquer les applications (garder la première occurrence)
  const uniqueApps = []
  const seenNames = new Set()

  for (const app of apps) {
    if (!seenNames.has(app.name)) {
      seenNames.add(app.name)
      uniqueApps.push(app)
    }
  }

  console.log(`✅ Returning ${uniqueApps.length} unique applications`)

  // Trier par ordre alphabétique
  return uniqueApps.sort((a, b) => a.name.localeCompare(b.name))
}

// === EXPORTS ===

module.exports = { scanApplications }
