/**
 * Finder - Interface de recherche
 *
 * Rendu des résultats, navigation au clavier et historique. Ce module n'a accès
 * ni à Node ni à Electron : tous les échanges passent par `window.electronAPI`,
 * défini par le preload.
 *
 * Les conversions d'unités et l'évaluation arithmétique vivent dans
 * `features/conversion`, où elles sont vérifiables sans navigateur.
 */

import { tryConversion } from './features/conversion/convert-units.js'
import {
  isMathExpression,
  evaluateMath
} from './features/conversion/evaluate-math.js'

// Focus automatiquement sur l'input au chargement
const searchInput = document.getElementById('searchInput') as HTMLInputElement
// Éléments présents dans index.html : leur absence relèverait d'un document
// corrompu, pas d'un cas à gérer à l'exécution.
const resultsContainer = document.getElementById('resultsContainer') as HTMLDivElement
const calculationResultElement = document.getElementById('calculationResult') as HTMLDivElement
const indexCounter = document.getElementById('indexCounter') as HTMLDivElement

/**
 * Résultat affichable, quelle que soit son origine (application, fichier,
 * paramètre, calcul ou recherche web).
 */
interface SearchResult {
  name: string
  description?: string | undefined
  resultType?: string
  path?: string | undefined
  exec?: string | undefined
  icon?: string | undefined
  iconPath?: string | undefined
  type?: string | undefined
  id?: string | undefined
  score?: number | undefined
  keywords?: string[] | undefined
  hidden?: boolean | undefined
  actions?: { id: string; name: string; icon: string }[] | undefined
  query?: string | undefined
  command?: string | undefined
  /** Requête à soumettre au moteur de recherche web. */
  searchQuery?: string | undefined
  /** Résultat d'un calcul ou d'une conversion. */
  value?: string | number | undefined
}

/** Entrée conservée dans l'historique des recherches. */
interface HistoryEntry {
  query: string
  type: string
  name: string
  path?: string
  exec?: string
  iconPath?: string
  timestamp: number
  [key: string]: unknown
}

let allApps: SearchResult[] = []
let allFiles: SearchResult[] = []
let allSettings: SearchResult[] = []
let filteredResults: SearchResult[] = []
let selectedIndex = 0
let calculationResult: number | string | null = null
let searchHistory: HistoryEntry[] = []

// === SÉCURITÉ : FONCTIONS D'ÉCHAPPEMENT ET VALIDATION ===

/**
 * Échappe les caractères HTML.
 *
 * Conservé bien que l'interface construise ses nœuds via textContent : toute
 * insertion future de balisage devra passer par cette fonction.
 */
export function escapeHtml(text: string): string {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Valide les données de l'historique
 * @param {any} data - Données à valider
 * @returns {boolean} true si valide
 */
function validateHistoryData(data: unknown): data is HistoryEntry[] {
  if (!Array.isArray(data)) return false

  // Limiter la taille de l'historique
  if (data.length > 100) return false

  // Valider chaque entrée
  for (const entry of data) {
    if (typeof entry !== 'object' || !entry) return false
    if (typeof entry.query !== 'string' || entry.query.length > 500) return false
    if (typeof entry.timestamp !== 'number') return false
    if (typeof entry.type !== 'string') return false
    if (typeof entry.name !== 'string' || entry.name.length > 500) return false
  }

  return true
}

// Charger l'historique depuis localStorage
function loadHistory(): void {
  try {
    const saved = localStorage.getItem('finderHistory')
    if (saved) {
      const parsed = JSON.parse(saved)

      // SÉCURITÉ : Valider les données avant de les utiliser
      if (validateHistoryData(parsed)) {
        searchHistory = parsed
      } else {
        console.warn('Invalid history data detected, clearing history')
        searchHistory = []
        localStorage.removeItem('finderHistory')
      }
    }
  } catch (error) {
    console.error('Error loading history:', error)
    searchHistory = []
    localStorage.removeItem('finderHistory')
  }
}

// Sauvegarder l'historique dans localStorage
function saveHistory(): void {
  try {
    // SÉCURITÉ : Valider avant de sauvegarder
    if (validateHistoryData(searchHistory)) {
      localStorage.setItem('finderHistory', JSON.stringify(searchHistory))
    } else {
      console.error('Invalid history data, not saving')
    }
  } catch (error) {
    console.error('Error saving history:', error)
  }
}

// Ajouter une entrée à l'historique
function addToHistory(query: string, resultType: string, result: SearchResult): void {
  // Ne pas ajouter les calculs ou recherches vides
  if (!query.trim() || calculationResult !== null) return

  // SÉCURITÉ : Valider et limiter la longueur
  const sanitizedQuery = query.trim().substring(0, 500)
  const sanitizedName = (result.name || query.trim()).substring(0, 500)

  // Créer l'entrée d'historique
  const entry = {
    query: sanitizedQuery,
    timestamp: Date.now(),
    type: resultType,
    name: sanitizedName
  }

  // Supprimer les doublons (même query)
  searchHistory = searchHistory.filter(h => h.query !== entry.query)

  // Ajouter au début
  searchHistory.unshift(entry)

  // Limiter à 5 entrées
  if (searchHistory.length > 5) {
    searchHistory = searchHistory.slice(0, 5)
  }

  saveHistory()
}

// Supprimer une entrée de l'historique
function removeFromHistory(index: number): void {
  searchHistory.splice(index, 1)
  saveHistory()
  displayResults()
  // Redonner le focus à l'input pour garder le contrôle clavier
  searchInput.focus()
}

// Afficher les snippets disponibles
function displaySnippets(): void {
  const snippets = [
    { symbol: '.', name: 'Applications', description: 'Rechercher uniquement les applications' },
    { symbol: '?', name: 'Fichiers', description: 'Rechercher uniquement les fichiers et dossiers' },
    { symbol: '??', name: 'Web', description: 'Rechercher directement sur Google' },
    { symbol: '>', name: 'Commande', description: 'Exécuter une commande shell' },
    { symbol: 'to', name: 'Conversion', description: 'Convertir: devises, longueurs, poids, températures, volumes, surfaces, vitesses, temps, données, pixels, angles, pression, énergie, puissance (ex: 16px to rem, 100ml to cl, 32°c to f)' }
  ]

  snippets.forEach((snippet) => {
    const item = document.createElement('div')
    item.className = 'result-item snippet-item'

    const icon = document.createElement('div')
    icon.className = 'snippet-symbol'
    icon.textContent = snippet.symbol

    const info = document.createElement('div')
    info.className = 'result-info'

    const name = document.createElement('div')
    name.className = 'result-name'
    name.textContent = snippet.name

    const description = document.createElement('div')
    description.className = 'result-description'
    description.textContent = snippet.description

    info.appendChild(name)
    info.appendChild(description)

    item.appendChild(icon)
    item.appendChild(info)

    resultsContainer.appendChild(item)
  })
}

// Afficher l'historique des recherches
function displayHistory(): void {
  if (searchHistory.length === 0) {
    // Si pas d'historique, afficher les snippets
    displaySnippets()
    return
  }

  searchHistory.slice(0, 5).forEach((entry, index) => {
    const item = document.createElement('div')
    item.className = 'result-item history-item' + (index === selectedIndex ? ' selected' : '')

    const icon = document.createElement('img')
    icon.className = 'result-icon'
    icon.src = getHistoryIcon()

    const info = document.createElement('div')
    info.className = 'result-info'

    const name = document.createElement('div')
    name.className = 'result-name'
    name.textContent = entry.name

    const description = document.createElement('div')
    description.className = 'result-description'
    description.textContent = getTimeAgo(entry.timestamp)

    info.appendChild(name)
    info.appendChild(description)

    // Bouton de suppression
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'delete-history-btn'
    deleteBtn.textContent = '×'
    deleteBtn.title = 'Supprimer de l\'historique'
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      removeFromHistory(index)
    })

    item.appendChild(icon)
    item.appendChild(info)
    item.appendChild(deleteBtn)

    // Click pour ouvrir directement
    item.addEventListener('click', () => {
      // Rechercher le résultat correspondant
      const query = entry.query.toLowerCase()

      // Chercher dans les apps
      let result = allApps.find(app =>
        app.name.toLowerCase() === query ||
        app.name.toLowerCase().includes(query)
      )

      if (result) {
        result = { ...result, resultType: 'app' }
      } else {
        // Chercher dans les fichiers
        result = allFiles.find(file =>
          file.name.toLowerCase() === entry.name.toLowerCase() ||
          file.path === entry.query
        )
        if (result) {
          result = { ...result, resultType: 'file' }
        }
      }

      // Si trouvé, ouvrir directement
      if (result) {
        openResult(result)
      } else {
        // Sinon, relancer la recherche
        searchInput.value = entry.query
        filterResults(entry.query)
        displayResults()
        searchInput.focus()
      }
    })

    resultsContainer.appendChild(item)
  })
}

// Icône pour l'historique
function getHistoryIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#666" rx="4"/><path fill="white" d="M24 10c-7.7 0-14 6.3-14 14s6.3 14 14 14 14-6.3 14-14h-4c0 5.5-4.5 10-10 10s-10-4.5-10-10 4.5-10 10-10v4l6-6-6-6v4z"/></svg>')
}

// Formater le temps écoulé
function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'À l\'instant'
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`
  if (seconds < 604800) return `Il y a ${Math.floor(seconds / 86400)} j`
  return `Il y a ${Math.floor(seconds / 604800)} sem`
}

// Système d'icônes de fichiers
function getFileIcon(fileName: string, filePath: string, fileType?: string): { src: string; type: string } {
  // Dossier en premier (avant de vérifier l'extension)
  if (fileType === 'folder') {
    return { type: 'icon', src: getFolderIcon() }
  }

  // Obtenir l'extension
  const parts = fileName.split('.')
  const ext = parts.length > 1 ? (parts[parts.length - 1] ?? '').toLowerCase() : ''

  // Images - Preview
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico']
  if (ext && imageExts.includes(ext)) {
    return { type: 'image', src: 'file://' + filePath }
  }

  // Documents
  if (ext && ['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return { type: 'icon', src: getDocIcon() }
  }

  // PDF
  if (ext === 'pdf') {
    return { type: 'icon', src: getPdfIcon() }
  }

  // Tableurs
  if (ext && ['xls', 'xlsx', 'ods', 'csv'].includes(ext)) {
    return { type: 'icon', src: getSpreadsheetIcon() }
  }

  // Archives
  if (ext && ['zip', 'tar', 'gz', 'bz2', 'rar', '7z', 'xz'].includes(ext)) {
    return { type: 'icon', src: getArchiveIcon() }
  }

  // Vidéos
  if (ext && ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm', 'flv'].includes(ext)) {
    return { type: 'icon', src: getVideoIcon() }
  }

  // Audio
  if (ext && ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext)) {
    return { type: 'icon', src: getAudioIcon() }
  }

  // Code
  const codeColors: Record<string, [string, string]> = {
    'js': ['JS', '#f7df1e'],
    'ts': ['TS', '#3178c6'],
    'jsx': ['JSX', '#61dafb'],
    'tsx': ['TSX', '#3178c6'],
    'py': ['PY', '#3776ab'],
    'java': ['JAVA', '#007396'],
    'c': ['C', '#555555'],
    'cpp': ['C++', '#00599c'],
    'cc': ['C++', '#00599c'],
    'cxx': ['C++', '#00599c'],
    'h': ['H', '#555555'],
    'hpp': ['HPP', '#00599c'],
    'hxx': ['HXX', '#00599c'],
    'rs': ['RS', '#ce422b'],
    'go': ['GO', '#00add8'],
    'rb': ['RB', '#cc342d'],
    'php': ['PHP', '#777bb4'],
    'html': ['HTML', '#e34c26'],
    'htm': ['HTM', '#e34c26'],
    'css': ['CSS', '#264de4'],
    'scss': ['SCSS', '#cc6699'],
    'sass': ['SASS', '#cc6699'],
    'less': ['LESS', '#1d365d'],
    'json': ['JSON', '#292929'],
    'xml': ['XML', '#ff6600'],
    'md': ['MD', '#083fa1'],
    'markdown': ['MD', '#083fa1'],
    'sh': ['SH', '#4eaa25'],
    'bash': ['BASH', '#4eaa25'],
    'zsh': ['ZSH', '#4eaa25'],
    'yml': ['YML', '#cb171e'],
    'yaml': ['YAML', '#cb171e'],
    'toml': ['TOML', '#9c4121'],
    'ini': ['INI', '#6d8086'],
    'conf': ['CONF', '#6d8086'],
    'dart': ['DART', '#0175c2'],
    'kt': ['KT', '#7f52ff'],
    'swift': ['SWIFT', '#fa7343'],
    'vue': ['VUE', '#42b883'],
    'svelte': ['SVELTE', '#ff3e00'],
    'sql': ['SQL', '#f29111'],
    'r': ['R', '#276dc3'],
    'lua': ['LUA', '#000080'],
    'pl': ['PERL', '#39457e'],
    'scala': ['SCALA', '#dc322f']
  }

  if (ext && codeColors[ext]) {
    return { type: 'icon', src: getCodeIcon(codeColors[ext][0], codeColors[ext][1]) }
  }

  return { type: 'icon', src: getGenericFileIcon() }
}

function getDocIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#2b579a" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">DOC</text></svg>')
}

function getPdfIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#f40f02" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">PDF</text></svg>')
}

function getSpreadsheetIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#217346" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">XLS</text></svg>')
}

function getArchiveIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#7e7e7e" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">ZIP</text></svg>')
}

function getVideoIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ff4444" rx="4"/><polygon points="18,14 32,24 18,34" fill="white"/></svg>')
}

function getAudioIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#9c27b0" rx="4"/><circle cx="20" cy="28" r="4" fill="white"/><rect x="24" y="12" width="2" height="16" fill="white"/></svg>')
}

function getCodeIcon(label: string, color: string): string {
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${color}" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${label}</text></svg>`)
}

function getFolderIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#ffa726" d="M10 12h14l4 4h14v20H10z"/><path fill="#ffb74d" d="M10 16h32v20H10z"/></svg>')
}

function getGenericFileIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#90a4ae" rx="4"/><path fill="white" d="M14 10h14l6 6v22H14z" opacity="0.9"/></svg>')
}

function getGoogleIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#4285f4" rx="4"/><path fill="white" d="M24 20v5h7.5c-.3 1.6-1.9 4.7-7.5 4.7-4.5 0-8.2-3.7-8.2-8.2s3.7-8.2 8.2-8.2c2.6 0 4.3 1.1 5.3 2l4-3.9C30.8 9.2 27.7 8 24 8c-7.7 0-14 6.3-14 14s6.3 14 14 14c8.1 0 13.5-5.7 13.5-13.7 0-.9-.1-1.6-.2-2.3H24z"/></svg>')
}

function getTerminalIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#2d2d2d" rx="4"/><path fill="#4caf50" d="M12 14l6 6-6 6v-2l4-4-4-4v-2z"/><rect x="20" y="24" width="10" height="2" fill="#4caf50"/></svg>')
}

function getConversionIcon(): string {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ff9800" rx="4"/><path fill="white" d="M20 16l-4 4 4 4v-3h8v-2h-8v-3zm8 12l4-4-4-4v3h-8v2h8v3z"/></svg>')
}

function getSettingIcon(settingId: string): string {
  const icons: Record<string, string> = {
    'wifi': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#2196f3" rx="4"/><path fill="white" d="M24 31c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3zm0-8c-3.9 0-7 3.1-7 7h4c0-1.7 1.3-3 3-3s3 1.3 3 3h4c0-3.9-3.1-7-7-7zm0-8c-6.1 0-11 4.9-11 11h4c0-3.9 3.1-7 7-7s7 3.1 7 7h4c0-6.1-4.9-11-11-11z"/></svg>',
    'bluetooth': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#2196f3" rx="4"/><path fill="white" d="M23 10v12l-6-6-2 2 8 8-8 8 2 2 6-6v12h2l8-8-6-6 6-6-8-8h-2zm2 4l4 4-4 4V14zm0 16l4 4-4 4v-8z"/></svg>',
    'sound': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#4caf50" rx="4"/><path fill="white" d="M12 18v12h8l10 10V8L20 18h-8zm20 6c0-2.2-1.2-4.1-3-5.1v10.2c1.8-1 3-2.9 3-5.1zm-3-13.4v4.1c3.5 1.5 6 5 6 9.3s-2.5 7.8-6 9.3v4.1c5.6-1.6 10-6.7 10-13.4s-4.4-11.8-10-13.4z"/></svg>',
    'display': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#9c27b0" rx="4"/><path fill="white" d="M8 10v20h32V10H8zm28 16H12V14h24v12zm-12 4h-4v4h-4v4h12v-4h-4v-4z"/></svg>',
    'power': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#4caf50" rx="4"/><path fill="white" d="M26 8h-4v14h4V8zm7.1 3.5l-2.8 2.8C32.7 16 34 18.8 34 22c0 5.5-4.5 10-10 10s-10-4.5-10-10c0-3.2 1.3-6 3.7-7.7l-2.8-2.8C11.5 14.3 10 18 10 22c0 7.7 6.3 14 14 14s14-6.3 14-14c0-4-1.5-7.7-4.9-10.5z"/></svg>',
    'keyboard': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#607d8b" rx="4"/><rect x="10" y="14" width="28" height="20" rx="2" fill="white"/><rect x="13" y="17" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="17" y="17" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="21" y="17" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="25" y="17" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="29" y="17" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="13" y="21" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="17" y="21" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="21" y="21" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="25" y="21" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="29" y="21" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="15" y="28" width="18" height="3" rx="0.5" fill="#607d8b"/></svg>',
    'mouse': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#607d8b" rx="4"/><path fill="white" d="M24 10c-5.5 0-10 4.5-10 10v8c0 5.5 4.5 10 10 10s10-4.5 10-10v-8c0-5.5-4.5-10-10-10zm-6 10c0-3.3 2.7-6 6-6s6 2.7 6 6v2H18v-2zm0 6h12v2c0 3.3-2.7 6-6 6s-6-2.7-6-6v-2z"/></svg>',
    'printers': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#795548" rx="4"/><path fill="white" d="M36 16H32V8H16v8H12c-2.2 0-4 1.8-4 4v10h8v10h16V30h8V20c0-2.2-1.8-4-4-4zm-16-4h8v4h-8v-4zm8 24h-8V28h8v8zm8-12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>',
    'users': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ff5722" rx="4"/><circle cx="24" cy="18" r="6" fill="white"/><path fill="white" d="M24 26c-6.6 0-12 3-12 6.7V36h24v-3.3c0-3.7-5.4-6.7-12-6.7z"/></svg>',
    'datetime': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ff9800" rx="4"/><circle cx="24" cy="24" r="12" fill="white"/><path fill="#ff9800" d="M24 14v10l7 4-1.2 2-8.8-5V14h3z"/></svg>',
    'privacy': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#f44336" rx="4"/><path fill="white" d="M24 8L10 14v10c0 8.6 6 16.6 14 18 8-1.4 14-9.4 14-18V14L24 8zm0 22h-2v-2h2v2zm0-4h-2v-8h2v8z"/></svg>',
    'appearance': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#e91e63" rx="4"/><circle cx="24" cy="24" r="8" fill="white"/><path fill="white" d="M24 10c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2s2-.9 2-2v-2c0-1.1-.9-2-2-2zm0 24c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2s2-.9 2-2v-2c0-1.1-.9-2-2-2zm12-12c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2s.9 2 2 2h2c1.1 0 2-.9 2-2zm-24 0c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2s.9 2 2 2h2c1.1 0 2-.9 2-2z"/></svg>'
  }

  return 'data:image/svg+xml,' + encodeURIComponent(icons[settingId] ?? icons['appearance'] ?? '')
}

function openGoogleSearch(query: string): void {
  // SÉCURITÉ : Valider et limiter la requête
  if (!query || typeof query !== 'string') return
  const sanitizedQuery = query.trim().substring(0, 1000)

  window.electronAPI.searchWeb(sanitizedQuery)

  searchInput.value = ''
  filteredResults = []
  displayResults()
}

// Fonction de conversion universelle (devises, unités, pixels, etc.)


// Vérifier si une chaîne est une expression mathématique


// Évaluer une expression mathématique de manière sécurisée sans eval


// Parser d'expressions mathématiques (sans eval)


/**
 * Affiche l'avancement de l'indexation.
 *
 * Une fois l'index constitué, le nombre d'éléments n'aide plus à chercher :
 * le compteur s'efface pour ne pas occuper durablement l'écran.
 */
let indexCounterTimer: ReturnType<typeof setTimeout> | null = null

function updateIndexCounter(): void {
  const total = allApps.length + allFiles.length

  if (total === 0) {
    indexCounter.textContent = 'Indexation…'
    return
  }

  indexCounter.textContent = `${allApps.length} applications · ${allFiles.length} fichiers`

  if (indexCounterTimer) clearTimeout(indexCounterTimer)
  indexCounterTimer = setTimeout(() => {
    indexCounter.style.opacity = '0'
    // Vider le texte après la transition libère aussi la hauteur occupée
    setTimeout(() => {
      indexCounter.textContent = ''
      indexCounter.style.opacity = ''
    }, 220)
  }, 2400)
}

// Charger toutes les applications et fichiers au démarrage
async function loadApplications() {
  try {
    allApps = await window.electronAPI.getApplications()
    console.log(`Loaded ${allApps.length} applications`)
    updateIndexCounter()
  } catch (error) {
    console.error('Error loading applications:', error)
  }
}

async function loadFiles() {
  try {
    allFiles = await window.electronAPI.getFiles()
    console.log(`Loaded ${allFiles.length} files`)
    updateIndexCounter()
  } catch (error) {
    console.error('Error loading files:', error)
  }
}

async function loadSettings() {
  try {
    // Charger tous les paramètres système disponibles
    allSettings = await window.electronAPI.searchSettings('')
    console.log(`Loaded ${allSettings.length} settings`)
  } catch (error) {
    console.error('Error loading settings:', error)
  }
}

// Filtrer les applications et fichiers selon la recherche
function filterResults(query: string): void {
  if (!query.trim()) {
    filteredResults = []
    calculationResult = null
    return
  }

  // === SNIPPET: "??" - Recherche web directe ===
  if (query.startsWith('??')) {
    const searchQuery = query.substring(2).trim()
    if (searchQuery) {
      filteredResults = [{
        name: 'Rechercher sur Google',
        description: `"${searchQuery}"`,
        resultType: 'web-search',
        searchQuery: searchQuery,
        icon: getGoogleIcon()
      }]
      calculationResult = null
      selectedIndex = 0
      return
    }
  }

  // === SNIPPET: ">" - Exécution de commande ===
  if (query.startsWith('>')) {
    const command = query.substring(1).trim()
    if (command) {
      filteredResults = [{
        name: 'Exécuter la commande',
        description: command,
        resultType: 'command',
        command: command,
        icon: getTerminalIcon()
      }]
      calculationResult = null
      selectedIndex = 0
      return
    }
  }

  // === SNIPPET: "to" - Conversion ===
  if (query.includes(' to ')) {
    const conversionResult = tryConversion(query)
    if (conversionResult) {
      filteredResults = [{
        name: conversionResult.result,
        description: conversionResult.description,
        resultType: 'conversion',
        value: conversionResult.result,
        icon: getConversionIcon()
      }]
      calculationResult = null
      selectedIndex = 0
      return
    }
  }

  // Vérifier si c'est une expression mathématique
  if (isMathExpression(query)) {
    const result = evaluateMath(query)
    console.log('Math expression detected:', query, 'Result:', result)
    if (result !== null) {
      calculationResult = result
      filteredResults = []
      return
    }
  }

  calculationResult = null

  // === SNIPPET: "." - Applications uniquement ===
  let lowerQuery = query.toLowerCase()
  let searchAppsOnly = false
  let searchFilesOnly = false

  if (lowerQuery.startsWith('.')) {
    searchAppsOnly = true
    lowerQuery = lowerQuery.substring(1).trim().toLowerCase()
  }
  // === SNIPPET: "?" - Fichiers/dossiers uniquement ===
  else if (lowerQuery.startsWith('?')) {
    searchFilesOnly = true
    lowerQuery = lowerQuery.substring(1).trim().toLowerCase()
  }

  const results = []

  // Filtrer les applications (sauf si snippet "?")
  if (!searchFilesOnly) {
    const apps = allApps.filter(app => {
      return app.name.toLowerCase().includes(lowerQuery) ||
             (app.description && app.description.toLowerCase().includes(lowerQuery))
    }).map(app => ({
      ...app,
      resultType: 'app',
      score: app.name.toLowerCase().startsWith(lowerQuery) ? 2 : 1
    }))
    results.push(...apps)
  }

  // Filtrer les fichiers (sauf si snippet ".")
  if (!searchAppsOnly) {
    const files = allFiles.filter(file => {
      return file.name.toLowerCase().includes(lowerQuery)
    }).map(file => ({
      ...file,
      resultType: 'file',
      score: file.name.toLowerCase().startsWith(lowerQuery) ? 2 : 1
    }))
    results.push(...files)
  }

  // Rechercher dans les paramètres système (toujours inclus)
  if (!searchAppsOnly && !searchFilesOnly) {
    const settings = allSettings.filter(setting => {
      return setting.name.toLowerCase().includes(lowerQuery) ||
             (setting.keywords ?? []).some((kw) => kw.toLowerCase().includes(lowerQuery))
    }).map(setting => ({
      ...setting,
      resultType: 'setting',
      score: setting.name.toLowerCase().startsWith(lowerQuery) ? 3 :
             (setting.keywords ?? []).some((kw) => kw.toLowerCase().startsWith(lowerQuery)) ? 2.5 : 1
    }))
    results.push(...settings)
  }

  // Combiner et trier par score
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score

    // Priorité : paramètres > apps > fichiers (si même score)
    const typeOrder: Record<string, number> = { 'setting': 3, 'app': 2, 'file': 1 }
    const orderA = typeOrder[a.resultType] || 0
    const orderB = typeOrder[b.resultType] || 0

    if (orderA !== orderB) return orderB - orderA

    return 0
  })

  // Limiter à 10 résultats
  filteredResults = results.slice(0, 10)
  selectedIndex = 0
}

// Afficher les résultats
function displayResults(): void {
  resultsContainer.innerHTML = ''

  // Si c'est un calcul, afficher le résultat dans l'input. La liste reste
  // vide : la règle .results-container:empty la retire de la mise en page.
  if (calculationResult !== null) {
    calculationResultElement.textContent = '= ' + calculationResult
    return
  }

  calculationResultElement.textContent = ''

  if (filteredResults.length === 0) {
    const query = searchInput.value.trim()

    // Ne pas afficher l'option Google si on utilise un snippet
    const isSnippet = query.startsWith('.') || query.startsWith('?') || query.startsWith('>') || query.includes(' to ')

    if (query && !isSnippet) {
      // Créer une option de recherche Google
      const googleItem = document.createElement('div')
      googleItem.className = 'result-item google-search selected'

      const icon = document.createElement('img')
      icon.className = 'result-icon'
      icon.src = getGoogleIcon()

      const info = document.createElement('div')
      info.className = 'result-info'

      const name = document.createElement('div')
      name.className = 'result-name'
      name.textContent = 'Rechercher sur Google'

      const description = document.createElement('div')
      description.className = 'result-description'
      description.textContent = `"${searchInput.value}"`

      info.appendChild(name)
      info.appendChild(description)

      googleItem.appendChild(icon)
      googleItem.appendChild(info)

      googleItem.addEventListener('click', () => {
        openGoogleSearch(searchInput.value)
      })

      resultsContainer.appendChild(googleItem)
      selectedIndex = 0
    } else if (!query) {
      // Afficher l'historique si l'input est vide
      displayHistory()
    }
    return
  }

  filteredResults.forEach((result, index) => {
    const item = document.createElement('div')
    item.className = 'result-item' + (index === selectedIndex ? ' selected' : '')

    // Créer l'icône
    const icon = document.createElement('img')
    icon.className = 'result-icon'

    if (result.resultType === 'app') {
      // Icône d'application
      if (result.iconPath) {
        icon.src = 'file://' + result.iconPath
      } else {
        icon.src = getIconPath(result.icon ?? '')
      }
      icon.onerror = () => {
        icon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23555"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10">?</text></svg>'
      }
    } else if (
      result.resultType === 'web-search' ||
      result.resultType === 'command' ||
      result.resultType === 'conversion'
    ) {
      // Ces résultats embarquent leur propre icône, générée à la volée
      icon.src = result.icon ?? ''
    } else if (result.resultType === 'setting') {
      icon.src = getSettingIcon(result.id ?? '')
    } else {
      // Icône de fichier ou dossier avec le système d'icônes personnalisées
      const fileIconInfo = getFileIcon(result.name, result.path ?? '', result.type)

      icon.src = fileIconInfo.src

      // Pour les images, ajouter un style pour l'affichage en preview
      if (fileIconInfo.type === 'image') {
        icon.style.objectFit = 'cover'
        icon.onerror = () => {
          // Si l'image ne charge pas, afficher une icône générique
          icon.src = 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
              <rect width="48" height="48" fill="#4caf50" rx="4"/>
              <text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">IMG</text>
            </svg>
          `)
        }
      }
    }

    // Créer les infos
    const info = document.createElement('div')
    info.className = 'result-info'

    const name = document.createElement('div')
    name.className = 'result-name'
    name.textContent = result.name

    const description = document.createElement('div')
    description.className = 'result-description'

    if (result.resultType === 'app') {
      description.textContent = result.description || 'Application'
    } else if (result.resultType === 'setting') {
      description.textContent = 'Paramètre système'
    } else if (result.path) {
      description.textContent = result.path
    }

    info.appendChild(name)
    info.appendChild(description)

    item.appendChild(icon)
    item.appendChild(info)

    // Ajouter un bouton "Ouvrir" pour les fichiers
    if (result.resultType === 'file') {
      const openButton = document.createElement('button')
      openButton.className = 'open-file-btn'
      openButton.innerHTML = '▶'
      openButton.title = 'Ouvrir le fichier'
      openButton.addEventListener('click', (e) => {
        e.stopPropagation() // Empêcher le clic de se propager au parent
        openResult(result, true) // forceOpenFile = true
      })
      item.appendChild(openButton)
    }

    // Ajouter un switch toggle pour les paramètres système avec action toggle
    if (result.resultType === 'setting' && result.actions) {
      const toggleAction = result.actions.find(a => a.id === 'toggle')

      if (toggleAction) {
        const toggleSwitch = document.createElement('label')
        toggleSwitch.className = 'toggle-switch'
        toggleSwitch.title = toggleAction.name

        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.className = 'toggle-checkbox'

        const slider = document.createElement('span')
        slider.className = 'toggle-slider'

        toggleSwitch.appendChild(checkbox)
        toggleSwitch.appendChild(slider)

        // Charger l'état actuel du paramètre
        window.electronAPI.getSettingState(result.id ?? '').then(isEnabled => {
          checkbox.checked = isEnabled // checked = vert = activé, unchecked = gris = désactivé
        }).catch(err => {
          console.error('Error loading setting state:', err)
        })

        toggleSwitch.addEventListener('click', (e) => {
          e.stopPropagation()
          // Inverser immédiatement pour feedback visuel
          checkbox.checked = !checkbox.checked
          window.electronAPI.executeSettingAction(result.id ?? '', 'toggle')
        })

        item.appendChild(toggleSwitch)
      }
    }

    // Click pour ouvrir (par défaut : emplacement pour fichiers, exécution pour apps)
    item.addEventListener('click', () => {
      openResult(result)
    })

    resultsContainer.appendChild(item)
  })
}

// Obtenir le chemin de l'icône
function getIconPath(iconName: string): string {
  if (!iconName) {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><rect width="24" height="24" fill="%23666"/></svg>'
  }

  // Si c'est un chemin absolu
  if (iconName.startsWith('/')) {
    return 'file://' + iconName
  }

  // Chemins standards pour les icônes
  const iconPaths = [
    `/usr/share/icons/hicolor/48x48/apps/${iconName}.png`,
    `/usr/share/icons/hicolor/scalable/apps/${iconName}.svg`,
    `/usr/share/pixmaps/${iconName}.png`,
    `/usr/share/pixmaps/${iconName}.svg`,
    `/usr/share/pixmaps/${iconName}.xpm`
  ]

  // Retourner le premier chemin (on utilisera onerror pour fallback)
  return 'file://' + iconPaths[0]
}

// Ouvrir un résultat (application ou fichier)
function openResult(result: SearchResult, forceOpenFile = false): void {
  // Ajouter à l'historique avant d'ouvrir (sauf pour conversions, commandes et paramètres)
  if (result.resultType !== 'conversion' && result.resultType !== 'command' && result.resultType !== 'web-search' && result.resultType !== 'setting') {
    const query = searchInput.value
    addToHistory(query, result.resultType ?? '', result)
  }

  if (result.resultType === 'app' && result.path) {
    window.electronAPI.launchApp(result.path)
  } else if (result.resultType === 'setting') {
    // Pour les paramètres, ouvrir l'action "settings" par défaut
    const settingsAction = (result.actions ?? []).find((a) => a.id === 'settings')
    if (settingsAction) {
      window.electronAPI.executeSettingAction(result.id ?? '', 'settings')
    }
    return // Ne pas continuer pour éviter de vider l'input
  } else if (result.resultType === 'file' && result.path) {
    // Si forceOpenFile est true, ouvrir directement le fichier
    // Sinon, ouvrir l'emplacement (comportement par défaut)
    if (forceOpenFile) {
      window.electronAPI.openFile(result.path)
    } else {
      window.electronAPI.openLocation(result.path)
    }
  } else if (result.resultType === 'web-search') {
    // Ouvrir la recherche Google
    openGoogleSearch(result.searchQuery ?? '')
    return // Ne pas vider l'input ici, openGoogleSearch le fait déjà
  } else if (result.resultType === 'command') {
    // Exécuter la commande dans un terminal
    window.electronAPI.executeCommand(result.command ?? '')
  } else if (result.resultType === 'conversion') {
    // Copier le résultat de la conversion dans le presse-papier
    const valeurCopiee = String(result.value ?? '')
    void navigator.clipboard.writeText(valeurCopiee).then(() => {
      // Montrer brièvement le résultat copié
      searchInput.value = valeurCopiee
      setTimeout(() => {
        searchInput.value = ''
        filteredResults = []
        displayResults()
      }, 300)
    }).catch(() => {
      // Si la copie échoue, juste fermer
      searchInput.value = ''
      filteredResults = []
      displayResults()
    })
    return
  }

  searchInput.value = ''
  filteredResults = []
  displayResults()
}

// Navigation au clavier
function selectItem(delta: number): void {
  if (filteredResults.length === 0) return

  selectedIndex = (selectedIndex + delta + filteredResults.length) % filteredResults.length
  displayResults()

  // Scroller pour que l'élément sélectionné soit visible
  const selectedElement = resultsContainer.querySelector('.result-item.selected')
  if (selectedElement) {
    selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

// Événements
window.addEventListener('DOMContentLoaded', async () => {
  loadHistory()
  await Promise.all([loadApplications(), loadFiles(), loadSettings()])
  displayResults() // Afficher l'historique au démarrage
  searchInput.focus()
})

window.addEventListener('focus', () => {
  searchInput.focus()
  searchInput.select()
})

searchInput.addEventListener('input', () => {
  filterResults(searchInput.value)
  displayResults()
})

/**
 * Efface les données conservées localement, après confirmation explicite.
 *
 * La suppression est irréversible : elle ne doit pas pouvoir être déclenchée
 * par une frappe accidentelle.
 */
async function effacerDonneesLocales(): Promise<void> {
  indexCounter.textContent = 'Effacement…'

  try {
    const emplacements = await window.electronAPI.eraseLocalData()
    if (emplacements === null) {
      indexCounter.textContent = ''
      return
    }

    // L'historique chargé en mémoire doit être vidé après la confirmation
    // native, en plus du stockage supprimé par le processus principal.
    searchHistory = []
    localStorage.removeItem('finderHistory')

    allApps = []
    allFiles = []
    filteredResults = []
    searchInput.value = ''
    displayResults()

    indexCounter.textContent = `${emplacements.length + 1} emplacements effacés`
  } catch (error: unknown) {
    console.error("Échec de l'effacement:", error)
    indexCounter.textContent = "Échec de l'effacement"
  }
}

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Delete' && event.ctrlKey) {
    // Droit à l'effacement (article 17 du RGPD) : retire l'historique de
    // recherche et les données conservées par le moteur de rendu.
    event.preventDefault()
    void effacerDonneesLocales()
  } else if (event.key === 'F5') {
    // Réindexe applications et fichiers : utile après avoir installé un
    // logiciel, sans quoi il faut attendre l'expiration du cache.
    event.preventDefault()
    indexCounter.textContent = 'Réindexation…'

    void window.electronAPI
      .refreshIndex()
      .then(({ applications, files }) => {
        allApps = applications
        allFiles = files
        updateIndexCounter()
        filterResults(searchInput.value)
        displayResults()
      })
      .catch((error: unknown) => {
        console.error('Échec de la réindexation:', error)
        indexCounter.textContent = ''
      })
  } else if (event.key === 'Escape') {
    searchInput.value = ''
    filteredResults = []
    displayResults()
    window.electronAPI.hideWindow()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectItem(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectItem(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (calculationResult !== null) {
      // Si c'est un calcul, copier le résultat dans le presse-papier
      const valeurCalcul = String(calculationResult)
      void navigator.clipboard.writeText(valeurCalcul).then(() => {
        // Remplacer l'input par le résultat brièvement pour montrer qu'il a été copié
        searchInput.value = valeurCalcul
        setTimeout(() => {
          searchInput.value = ''
          calculationResult = null
          filteredResults = []
          displayResults()
        }, 300)
      }).catch(() => {
        // Si la copie échoue, juste fermer
        searchInput.value = ''
        calculationResult = null
        filteredResults = []
        displayResults()
      })
    } else if (filteredResults.length > 0 && selectedIndex >= 0) {
      const selection = filteredResults[selectedIndex]
      if (selection) openResult(selection)
    } else if (searchInput.value.trim()) {
      // Si pas de résultats mais qu'il y a une recherche, ouvrir Google
      openGoogleSearch(searchInput.value)
    }
  }
})
