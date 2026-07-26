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
 *
 * PERFORMANCE :
 * - Le parsing s'arrête dès la fin de la section [Desktop Entry]
 * - Les entrées invalides sont écartées avant la résolution de l'icône,
 *   qui est l'opération la plus coûteuse
 */

import fs from 'node:fs'
import path from 'node:path'
import { findIcon } from './icon-finder.js'
import { DESKTOP_DIRS } from '../../shared/paths.js'
import type { AppEntry } from '../../shared/types.js'

// === CONFIGURATION ===

/**
 * Langue de l'utilisateur, pour retenir les libellés localisés (Name[fr]).
 */
const USER_LANGUAGE: string = (
  process.env['LC_ALL'] ||
  process.env['LC_MESSAGES'] ||
  process.env['LANG'] ||
  ''
)
  .split('.')[0]! // fr_FR.UTF-8 -> fr_FR
  .split('@')[0]!

/**
 * Variante courte de la langue : fr_FR -> fr
 */
const USER_LANGUAGE_SHORT: string = USER_LANGUAGE.split('_')[0]!

// === FONCTIONS DE PARSING ===

/**
 * Extrait la clé et la localisation d'une ligne de fichier .desktop
 * @param {string} line - Ligne à analyser (déjà nettoyée)
 * @returns {{key: string, locale: string, value: string}|null}
 */
function parseEntryLine(
  line: string
): { key: string; locale: string; value: string } | null {
  const separator = line.indexOf('=')
  if (separator === -1) return null

  const rawKey = line.slice(0, separator).trim()
  const value = line.slice(separator + 1).trim()

  const localeMatch = rawKey.match(/^([A-Za-z-]+)\[([^\]]+)\]$/)

  if (localeMatch) {
    return { key: localeMatch[1]!, locale: localeMatch[2]!, value }
  }

  return { key: rawKey, locale: '', value }
}

/**
 * Détermine si une valeur localisée doit remplacer celle déjà retenue.
 *
 * Une correspondance exacte (fr_FR) prime sur une correspondance de langue
 * (fr), qui prime elle-même sur la valeur non localisée.
 *
 * @param {string} locale - Locale de la ligne courante
 * @returns {number} Score de priorité (0 = à ignorer)
 */
function localeScore(locale: string): number {
  if (!locale) return 1
  if (locale === USER_LANGUAGE) return 3
  if (USER_LANGUAGE_SHORT && locale === USER_LANGUAGE_SHORT) return 2
  return 0
}

/**
 * Parse un fichier .desktop et extrait les métadonnées de l'application
 * @param {string} filePath - Chemin vers le fichier .desktop
 * @returns {Object|null} Objet application ou null si parsing échoue
 */
function parseDesktopFile(filePath: string): AppEntry | null {
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    return null
  }

  const app: AppEntry = {
    name: '',
    description: '',
    icon: '',
    iconPath: '',
    exec: '',
    path: filePath,
    hidden: false
  }

  // Meilleure priorité de locale retenue pour chaque champ traduisible
  const scores = { name: 0, description: 0 }

  let inDesktopEntry = false

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) continue

    if (trimmed.startsWith('[')) {
      if (trimmed === '[Desktop Entry]') {
        inDesktopEntry = true
        continue
      }

      // Les sections suivantes ([Desktop Action ...]) ne nous intéressent pas :
      // inutile de parcourir le reste du fichier.
      if (inDesktopEntry) break

      inDesktopEntry = false
      continue
    }

    if (!inDesktopEntry) continue

    const entry = parseEntryLine(trimmed)
    if (!entry) continue

    const score = localeScore(entry.locale)
    if (score === 0) continue

    switch (entry.key) {
      case 'Name':
        if (score > scores.name) {
          app.name = entry.value
          scores.name = score
        }
        break

      case 'Comment':
      case 'GenericName':
        // Comment est plus informatif que GenericName : à score égal, il gagne
        if (score > scores.description ||
            (score === scores.description && entry.key === 'Comment' && !app.description)) {
          app.description = entry.value
          scores.description = score
        }
        break

      case 'Icon':
        if (!entry.locale) app.icon = entry.value
        break

      case 'Exec':
        if (!entry.locale) app.exec = entry.value
        break

      case 'NoDisplay':
      case 'Hidden':
        if (entry.value.toLowerCase() === 'true') app.hidden = true
        break

      case 'Type':
        // Seules les entrées de type Application sont lançables
        if (entry.value && entry.value !== 'Application') app.hidden = true
        break
    }
  }

  return app
}

/**
 * Vérifie si une application est valide et devrait être affichée
 * @param {Object} app - Objet application
 * @returns {boolean} true si l'application est valide
 */
function isValidApp(app: AppEntry | null): app is AppEntry {
  return Boolean(app && app.name && app.exec && !app.hidden)
}

/**
 * Liste les fichiers .desktop d'un répertoire.
 *
 * Les snaps ne sont pas cherchés sous ~/snap : snapd exporte leurs entrées
 * dans /var/lib/snapd/desktop/applications, déjà présent dans DESKTOP_DIRS.
 *
 * @param {string} dir - Répertoire à lister
 * @returns {string[]} Chemins complets des fichiers .desktop
 */
function listDesktopFiles(dir: string): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    // Répertoire absent ou illisible : cas normal selon l'installation
    return []
  }

  const files: string[] = []

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.desktop')) {
      files.push(path.join(dir, entry.name))
    }
  }

  return files
}

// === FONCTION PRINCIPALE ===

/**
 * Scanne tous les répertoires d'applications et retourne la liste unique des apps
 * @returns {object[]} Applications triées et dédupliquées
 */
function scanApplications(): AppEntry[] {
  console.log('🔍 Scanning for installed applications...')

  const startedAt = Date.now()

  const uniqueApps: AppEntry[] = []
  const seenNames = new Set<string>()
  const seenFiles = new Set<string>()

  let parsed = 0

  for (const dir of DESKTOP_DIRS) {
    for (const filePath of listDesktopFiles(dir)) {
      // Un même fichier .desktop peut être exposé par plusieurs chemins
      const fileName = path.basename(filePath)
      if (seenFiles.has(fileName)) continue
      seenFiles.add(fileName)

      const app = parseDesktopFile(filePath)
      parsed++

      if (!isValidApp(app)) continue

      // Déduplication par nom avant la résolution d'icône, qui est coûteuse
      const nameKey = app.name.toLowerCase()
      if (seenNames.has(nameKey)) continue
      seenNames.add(nameKey)

      if (app.icon) {
        app.iconPath = findIcon(app.icon) || ''
      }

      uniqueApps.push(app)
    }
  }

  const elapsed = Date.now() - startedAt
  console.log(`✅ ${uniqueApps.length} applications (${parsed} fichiers .desktop lus) in ${elapsed}ms`)

  return uniqueApps.sort((a, b) => a.name.localeCompare(b.name))
}

// === EXPORTS ===

export {
  scanApplications
}
