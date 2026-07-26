/**
 * Finder - Icon Finder
 *
 * Résout le nom d'icône d'un fichier .desktop en chemin de fichier réel.
 *
 * PERFORMANCE :
 * Les thèmes d'icônes suivent la spécification freedesktop : les fichiers
 * vivent dans <theme>/<taille>/<catégorie>/<nom>.<ext>. On construit donc les
 * chemins candidats et on teste leur existence, au lieu de parcourir
 * récursivement les dizaines de milliers d'entrées de /usr/share/icons.
 */

import fs from 'node:fs'
import path from 'node:path'
import { ICON_THEME_DIRS, FLAT_ICON_DIRS } from '../../shared/paths.js'
import { BoundedCache } from '../services/bounded-cache.js'

/**
 * Bornes des caches.
 *
 * L'application reste résidente : sans limite, l'indexation des thèmes système
 * — plusieurs dizaines de milliers de fichiers — restait en mémoire jusqu'à la
 * fermeture. Ces valeurs couvrent largement un poste ordinaire tout en plafonnant
 * l'empreinte.
 */
const MAX_CACHED_ICONS = 512
const MAX_CACHED_DIRS = 512
const MAX_CACHED_THEMES = 8

/** Chemin résolu par nom d'icône (null si introuvable). */
const iconCache = new BoundedCache<string, string | null>(MAX_CACHED_ICONS)

/** Contenu des répertoires déjà lus, pour ne lire chaque dossier qu'une fois. */
const dirEntriesCache = new BoundedCache<string, string[]>(MAX_CACHED_DIRS)

/**
 * Extensions d'icônes reconnues, par ordre de préférence.
 * Le SVG passe en premier : une seule taille suffit à tous les usages.
 */
const ICON_EXTENSIONS = ['.svg', '.png', '.xpm']

/**
 * Tailles standard, de la plus grande à la plus petite : l'interface affiche
 * les icônes en grand, un downscale est plus propre qu'un upscale.
 */
const ICON_SIZES = [
  'scalable', '512x512', '256x256', '192x192', '128x128', '96x96',
  '72x72', '64x64', '48x48', '36x36', '32x32', '24x24', '22x22', '16x16',
  // "symbolic" est un pseudo-dossier de taille utilisé par Adwaita et hicolor
  'symbolic',
  // Certains thèmes (LoginIcons) notent la taille sans le suffixe "xN"
  '512', '256', '128', '96', '64', '48', '32', '24', '22', '16'
]

/**
 * Catégories où chercher. "apps" couvre la quasi-totalité des applications,
 * les autres servent aux icônes génériques référencées par certains .desktop.
 */
const ICON_CATEGORIES = [
  'apps', 'devices', 'places', 'mimetypes',
  'status', 'actions', 'categories', 'emblems', 'legacy'
]

/**
 * Thèmes prioritaires : hicolor est le fallback imposé par la spécification,
 * Yaru et Adwaita sont les thèmes par défaut d'Ubuntu et GNOME.
 */
const PREFERRED_THEMES = ['hicolor', 'Yaru', 'Adwaita', 'gnome', 'Humanity']

/**
 * Liste le contenu d'un répertoire, avec mise en cache.
 * @param {string} dir - Répertoire à lister
 * @returns {string[]} Noms des entrées (vide si inaccessible)
 */
function listDir(dir: string): string[] {
  const cached = dirEntriesCache.get(dir)
  if (cached !== undefined) {
    return cached
  }

  let entries: string[] = []
  try {
    entries = fs.readdirSync(dir)
  } catch (error) {
    // Répertoire absent ou illisible : on retient le résultat vide
  }

  dirEntriesCache.set(dir, entries)
  return entries
}

/**
 * Cherche une icône dont le nom de base correspond, quelle que soit l'extension.
 * @param {string} dir - Répertoire à inspecter
 * @param {string} iconName - Nom de l'icône sans extension
 * @returns {string|null} Chemin trouvé ou null
 */
function findInDir(dir: string, iconName: string): string | null {
  const entries = listDir(dir)
  if (entries.length === 0) return null

  for (const ext of ICON_EXTENSIONS) {
    const candidate = iconName + ext
    if (entries.includes(candidate)) {
      return path.join(dir, candidate)
    }
  }

  // Certains paquets livrent l'icône sans extension connue
  if (entries.includes(iconName)) {
    return path.join(dir, iconName)
  }

  return null
}

/**
 * Liste les thèmes d'un répertoire de base, en plaçant les thèmes usuels
 * en tête pour trouver l'icône au plus vite.
 * @param {string} baseDir - Répertoire de base (ex. /usr/share/icons)
 * @returns {string[]} Noms de thèmes ordonnés
 */
function listThemes(baseDir: string): string[] {
  const entries = listDir(baseDir)

  const preferred = PREFERRED_THEMES.filter(t => entries.includes(t))
  const others = entries.filter((e: string) => !PREFERRED_THEMES.includes(e) && !e.includes('.'))

  return [...preferred, ...others]
}

/**
 * Résout un chemin d'icône absolu, avec repli sur les autres versions d'un snap.
 * @param {string} iconName - Chemin absolu déclaré dans le .desktop
 * @returns {string|null} Chemin existant ou null
 */
function resolveAbsoluteIcon(iconName: string): string | null {
  if (fs.existsSync(iconName)) {
    return iconName
  }

  // Les snaps référencent souvent une révision précise qui a été mise à jour
  const snapMatch = iconName.match(/\/snap\/([^/]+)\/(\d+|current)\/(.+)/)
  if (!snapMatch) return null

  const [, snapName, , relativePath] = snapMatch
  if (snapName === undefined || relativePath === undefined) return null
  const snapBaseDir = `/snap/${snapName}`

  const versions = listDir(snapBaseDir)
    .filter((v: string) => /^\d+$/.test(v))
    .sort((a: string, b: string) => parseInt(b, 10) - parseInt(a, 10))

  for (const version of versions) {
    const iconPath = path.join(snapBaseDir, version, relativePath)
    if (fs.existsSync(iconPath)) {
      return iconPath
    }
  }

  return null
}

/**
 * Index d'un thème : nom d'icône sans extension -> chemin complet
 * @type {Map<string, Map<string, string>>}
 */
const themeIndexCache = new BoundedCache<string, Map<string, string>>(
  MAX_CACHED_THEMES
)

/**
 * Construit (ou récupère) l'index d'un thème d'icônes.
 *
 * Un thème contient des dizaines de combinaisons taille/catégorie. Tester
 * chaque combinaison pour chaque icône recherchée multiplie les lectures de
 * dossier ; on liste donc le thème une seule fois et on interroge ensuite
 * une table de correspondance.
 *
 * Les dossiers sont indexés dans l'ordre de préférence, et la première
 * occurrence d'un nom l'emporte : l'index reflète le meilleur candidat.
 *
 * @param {string} themeDir - Répertoire du thème
 * @returns {Map<string, string>} Index nom -> chemin
 */
function buildThemeIndex(themeDir: string): Map<string, string> {
  const cachedIndex = themeIndexCache.get(themeDir)
  if (cachedIndex !== undefined) {
    return cachedIndex
  }

  const index = new Map<string, string>()
  const themeEntries = listDir(themeDir)

  if (themeEntries.length === 0) {
    themeIndexCache.set(themeDir, index)
    return index
  }

  // Un thème s'organise soit en <taille>/<catégorie>, soit en <catégorie>/<taille>
  const orderedDirs: string[] = []

  for (const size of ICON_SIZES) {
    if (!themeEntries.includes(size)) continue
    for (const category of ICON_CATEGORIES) {
      orderedDirs.push(path.join(themeDir, size, category))
    }
  }

  for (const category of ICON_CATEGORIES) {
    if (!themeEntries.includes(category)) continue
    for (const size of ICON_SIZES) {
      orderedDirs.push(path.join(themeDir, category, size))
    }
  }

  for (const dir of orderedDirs) {
    for (const fileName of listDir(dir)) {
      const ext = path.extname(fileName)
      const base = ext ? fileName.slice(0, -ext.length) : fileName

      if (!index.has(base)) {
        index.set(base, path.join(dir, fileName))
      }
    }
  }

  themeIndexCache.set(themeDir, index)
  return index
}

/**
 * Cherche une icône dans l'index d'un thème
 * @param {string} themeDir - Répertoire du thème
 * @param {string} iconName - Nom de l'icône sans extension
 * @returns {string|null} Chemin trouvé ou null
 */
function lookupInThemeIndex(themeDir: string, iconName: string): string | null {
  return buildThemeIndex(themeDir).get(iconName) || null
}

/**
 * Trouve le chemin d'une icône à partir de son nom
 * @param {string} iconName - Nom ou chemin de l'icône (champ Icon= du .desktop)
 * @returns {string|null} Chemin complet ou null si introuvable
 */
function findIcon(iconName: string | null | undefined): string | null {
  if (!iconName) return null

  const cachedIcon = iconCache.get(iconName)
  if (cachedIcon !== undefined) {
    return cachedIcon
  }

  let result: string | null = null

  if (iconName.startsWith('/')) {
    result = resolveAbsoluteIcon(iconName)
    iconCache.set(iconName, result)
    return result
  }

  // Un champ Icon= peut inclure une extension : la spécification demande de
  // l'ignorer, mais certains fichiers .desktop la conservent.
  const bareName = iconName.replace(/\.(svg|png|xpm)$/i, '')

  // Les répertoires plats coûtent une seule lecture : les tester en premier
  // évite d'explorer les thèmes pour des icônes comme celle de VS Code.
  for (const flatDir of FLAT_ICON_DIRS) {
    result = findInDir(flatDir, bareName)
    if (result) break
  }

  // Ensuite les thèmes, via un index construit une fois pour toutes
  if (!result) {
    for (const baseDir of ICON_THEME_DIRS) {
      if (listDir(baseDir).length === 0) continue

      // Certains thèmes posent des icônes à leur racine
      result = findInDir(baseDir, bareName)
      if (result) break

      for (const theme of listThemes(baseDir)) {
        result = lookupInThemeIndex(path.join(baseDir, theme), bareName)
        if (result) break
      }

      if (result) break
    }
  }

  iconCache.set(iconName, result)
  return result
}

/**
 * Vide les caches (utile si des applications sont installées en cours de session)
 */
function clearIconCache(): void {
  iconCache.clear()
  dirEntriesCache.clear()
  themeIndexCache.clear()
}

export {
  findIcon,
  clearIconCache
}
