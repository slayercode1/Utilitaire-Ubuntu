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

import type { RuntimeValue } from '../shared/types.js'
import { tryConversion } from './features/conversion/convert-units.js'
import { evaluateMath, isMathExpression } from './features/conversion/evaluate-math.js'

/** Construit une URL média sur la même origine applicative que le document. */
function createMediaUrl(filePath: string): string {
  const mediaUrl = new URL('/media', window.location.origin)
  mediaUrl.searchParams.set('path', filePath)
  return mediaUrl.href
}

/** Encode un SVG inline en URL `data:`, utilisable comme `src` d'image. */
function svgDataUrl(svg: string): string {
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

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
  timestamp: number
}

let allApps: SearchResult[] = []
let allFiles: SearchResult[] = []
let allSettings: SearchResult[] = []
let filteredResults: SearchResult[] = []
let selectedIndex = 0
let calculationResult: number | string | null = null
let searchHistory: HistoryEntry[] = []

/**
 * Valide les données de l'historique lues depuis localStorage, qui restent
 * des données non fiables tant qu'elles n'ont pas été contrôlées.
 */
function isRuntimeValueArray(data: RuntimeValue): data is RuntimeValue[] {
  return Array.isArray(data)
}

function isRuntimeRecord(data: RuntimeValue): data is Record<string, RuntimeValue> {
  return typeof data === 'object' && data !== null && !Array.isArray(data)
}

function validateHistoryData(data: RuntimeValue): data is HistoryEntry[] {
  if (!isRuntimeValueArray(data)) return false
  if (data.length > 100) return false

  for (const entry of data) {
    if (!isRuntimeRecord(entry)) return false
    if (typeof entry['query'] !== 'string' || entry['query'].length > 500) return false
    if (typeof entry['timestamp'] !== 'number') return false
    if (typeof entry['type'] !== 'string') return false
    if (typeof entry['name'] !== 'string' || entry['name'].length > 500) return false
  }

  return true
}

function loadHistory(): void {
  try {
    const saved = localStorage.getItem('finderHistory')
    if (saved) {
      const parsed = JSON.parse(saved) as RuntimeValue

      if (validateHistoryData(parsed)) {
        searchHistory = parsed
      } else {
        console.warn('Invalid history data detected, clearing history')
        searchHistory = []
        localStorage.removeItem('finderHistory')
      }
    }
  } catch {
    console.error('Error loading history')
    searchHistory = []
    localStorage.removeItem('finderHistory')
  }
}

function saveHistory(): void {
  try {
    if (validateHistoryData(searchHistory)) {
      localStorage.setItem('finderHistory', JSON.stringify(searchHistory))
    } else {
      console.error('Invalid history data, not saving')
    }
  } catch {
    console.error('Error saving history')
  }
}

function addToHistory(query: string, resultType: string, result: SearchResult): void {
  // Ne pas ajouter les calculs ou recherches vides
  if (!query.trim() || calculationResult !== null) return

  const entry = {
    query: query.trim().substring(0, 500),
    timestamp: Date.now(),
    type: resultType,
    name: (result.name || query.trim()).substring(0, 500)
  }

  // Supprimer les doublons (même query), ajouter en tête, garder 5 entrées
  searchHistory = searchHistory.filter((h) => h.query !== entry.query)
  searchHistory.unshift(entry)
  searchHistory = searchHistory.slice(0, 5)

  saveHistory()
}

function removeFromHistory(index: number): void {
  searchHistory.splice(index, 1)
  saveHistory()
  displayResults()
  // Redonner le focus à l'input pour garder le contrôle clavier
  searchInput.focus()
}

function displaySnippets(): void {
  const snippets = [
    { symbol: '.', name: 'Applications', description: 'Rechercher uniquement les applications' },
    {
      symbol: '?',
      name: 'Fichiers',
      description: 'Rechercher uniquement les fichiers et dossiers'
    },
    { symbol: '??', name: 'Web', description: 'Rechercher directement sur Google' },
    { symbol: '>', name: 'Commande', description: 'Exécuter une commande shell' },
    {
      symbol: 'to',
      name: 'Conversion',
      description:
        'Convertir: devises, longueurs, poids, températures, volumes, surfaces, vitesses, temps, données, pixels, angles, pression, énergie, puissance (ex: 16px to rem, 100ml to cl, 32°c to f)'
    }
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

function displayHistory(): void {
  if (searchHistory.length === 0) {
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

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'delete-history-btn'
    deleteBtn.textContent = '×'
    deleteBtn.title = "Supprimer de l'historique"
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      removeFromHistory(index)
    })

    item.appendChild(icon)
    item.appendChild(info)
    item.appendChild(deleteBtn)

    item.addEventListener('click', () => {
      const query = entry.query.toLowerCase()

      let result = allApps.find(
        (app) => app.name.toLowerCase() === query || app.name.toLowerCase().includes(query)
      )

      if (result) {
        result = { ...result, resultType: 'app' }
      } else {
        result = allFiles.find(
          (file) =>
            file.name.toLowerCase() === entry.name.toLowerCase() || file.path === entry.query
        )
        if (result) {
          result = { ...result, resultType: 'file' }
        }
      }

      if (result) {
        openResult(result)
      } else {
        searchInput.value = entry.query
        filterResults(entry.query)
        displayResults()
        searchInput.focus()
      }
    })

    resultsContainer.appendChild(item)
  })
}

function getHistoryIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#666" rx="4"/><path fill="white" d="M24 10c-7.7 0-14 6.3-14 14s6.3 14 14 14 14-6.3 14-14h-4c0 5.5-4.5 10-10 10s-10-4.5-10-10 4.5-10 10-10v4l6-6-6-6v4z"/></svg>'
  )
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return "À l'instant"
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`
  if (seconds < 604800) return `Il y a ${Math.floor(seconds / 86400)} j`
  return `Il y a ${Math.floor(seconds / 604800)} sem`
}

function getFileIcon(
  fileName: string,
  filePath: string,
  fileType?: string
): { src: string; type: string } {
  // Dossier en premier (avant de vérifier l'extension)
  if (fileType === 'folder') {
    return { type: 'icon', src: getFolderIcon() }
  }

  const parts = fileName.split('.')
  const ext = parts.length > 1 ? (parts[parts.length - 1] ?? '').toLowerCase() : ''

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico']
  if (ext && imageExts.includes(ext)) {
    return { type: 'image', src: createMediaUrl(filePath) }
  }

  if (ext && ['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return { type: 'icon', src: getDocIcon() }
  }

  if (ext === 'pdf') {
    return { type: 'icon', src: getPdfIcon() }
  }

  if (ext && ['xls', 'xlsx', 'ods', 'csv'].includes(ext)) {
    return { type: 'icon', src: getSpreadsheetIcon() }
  }

  if (ext && ['zip', 'tar', 'gz', 'bz2', 'rar', '7z', 'xz'].includes(ext)) {
    return { type: 'icon', src: getArchiveIcon() }
  }

  if (ext && ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm', 'flv'].includes(ext)) {
    return { type: 'icon', src: getVideoIcon() }
  }

  if (ext && ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'].includes(ext)) {
    return { type: 'icon', src: getAudioIcon() }
  }

  const codeColors: Record<string, [string, string]> = {
    js: ['JS', '#f7df1e'],
    ts: ['TS', '#3178c6'],
    jsx: ['JSX', '#61dafb'],
    tsx: ['TSX', '#3178c6'],
    py: ['PY', '#3776ab'],
    java: ['JAVA', '#007396'],
    c: ['C', '#555555'],
    cpp: ['C++', '#00599c'],
    cc: ['C++', '#00599c'],
    cxx: ['C++', '#00599c'],
    h: ['H', '#555555'],
    hpp: ['HPP', '#00599c'],
    hxx: ['HXX', '#00599c'],
    rs: ['RS', '#ce422b'],
    go: ['GO', '#00add8'],
    rb: ['RB', '#cc342d'],
    php: ['PHP', '#777bb4'],
    html: ['HTML', '#e34c26'],
    htm: ['HTM', '#e34c26'],
    css: ['CSS', '#264de4'],
    scss: ['SCSS', '#cc6699'],
    sass: ['SASS', '#cc6699'],
    less: ['LESS', '#1d365d'],
    json: ['JSON', '#292929'],
    xml: ['XML', '#ff6600'],
    md: ['MD', '#083fa1'],
    markdown: ['MD', '#083fa1'],
    sh: ['SH', '#4eaa25'],
    bash: ['BASH', '#4eaa25'],
    zsh: ['ZSH', '#4eaa25'],
    yml: ['YML', '#cb171e'],
    yaml: ['YAML', '#cb171e'],
    toml: ['TOML', '#9c4121'],
    ini: ['INI', '#6d8086'],
    conf: ['CONF', '#6d8086'],
    dart: ['DART', '#0175c2'],
    kt: ['KT', '#7f52ff'],
    swift: ['SWIFT', '#fa7343'],
    vue: ['VUE', '#42b883'],
    svelte: ['SVELTE', '#ff3e00'],
    sql: ['SQL', '#f29111'],
    r: ['R', '#276dc3'],
    lua: ['LUA', '#000080'],
    pl: ['PERL', '#39457e'],
    scala: ['SCALA', '#dc322f']
  }

  if (ext && codeColors[ext]) {
    return { type: 'icon', src: getCodeIcon(codeColors[ext][0], codeColors[ext][1]) }
  }

  return { type: 'icon', src: getGenericFileIcon() }
}

function getDocIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#2b579a" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">DOC</text></svg>'
  )
}

function getPdfIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#f40f02" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">PDF</text></svg>'
  )
}

function getSpreadsheetIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#217346" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">XLS</text></svg>'
  )
}

function getArchiveIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#7e7e7e" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">ZIP</text></svg>'
  )
}

function getVideoIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ff4444" rx="4"/><polygon points="18,14 32,24 18,34" fill="white"/></svg>'
  )
}

function getAudioIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#9c27b0" rx="4"/><circle cx="20" cy="28" r="4" fill="white"/><rect x="24" y="12" width="2" height="16" fill="white"/></svg>'
  )
}

function getCodeIcon(label: string, color: string): string {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${color}" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${label}</text></svg>`
  )
}

function getFolderIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#ffa726" d="M10 12h14l4 4h14v20H10z"/><path fill="#ffb74d" d="M10 16h32v20H10z"/></svg>'
  )
}

function getGenericFileIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#90a4ae" rx="4"/><path fill="white" d="M14 10h14l6 6v22H14z" opacity="0.9"/></svg>'
  )
}

function getGoogleIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#4285f4" rx="4"/><path fill="white" d="M24 20v5h7.5c-.3 1.6-1.9 4.7-7.5 4.7-4.5 0-8.2-3.7-8.2-8.2s3.7-8.2 8.2-8.2c2.6 0 4.3 1.1 5.3 2l4-3.9C30.8 9.2 27.7 8 24 8c-7.7 0-14 6.3-14 14s6.3 14 14 14c8.1 0 13.5-5.7 13.5-13.7 0-.9-.1-1.6-.2-2.3H24z"/></svg>'
  )
}

function getTerminalIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#2d2d2d" rx="4"/><path fill="#4caf50" d="M12 14l6 6-6 6v-2l4-4-4-4v-2z"/><rect x="20" y="24" width="10" height="2" fill="#4caf50"/></svg>'
  )
}

function getConversionIcon(): string {
  return svgDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ff9800" rx="4"/><path fill="white" d="M20 16l-4 4 4 4v-3h8v-2h-8v-3zm8 12l4-4-4-4v3h-8v2h8v3z"/></svg>'
  )
}

function getSettingIcon(settingId: string): string {
  const icons: Record<string, string> = {
    wifi: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#2196f3" rx="4"/><path fill="white" d="M24 31c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3zm0-8c-3.9 0-7 3.1-7 7h4c0-1.7 1.3-3 3-3s3 1.3 3 3h4c0-3.9-3.1-7-7-7zm0-8c-6.1 0-11 4.9-11 11h4c0-3.9 3.1-7 7-7s7 3.1 7 7h4c0-6.1-4.9-11-11-11z"/></svg>',
    bluetooth:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#2196f3" rx="4"/><path fill="white" d="M23 10v12l-6-6-2 2 8 8-8 8 2 2 6-6v12h2l8-8-6-6 6-6-8-8h-2zm2 4l4 4-4 4V14zm0 16l4 4-4 4v-8z"/></svg>',
    sound:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#4caf50" rx="4"/><path fill="white" d="M12 18v12h8l10 10V8L20 18h-8zm20 6c0-2.2-1.2-4.1-3-5.1v10.2c1.8-1 3-2.9 3-5.1zm-3-13.4v4.1c3.5 1.5 6 5 6 9.3s-2.5 7.8-6 9.3v4.1c5.6-1.6 10-6.7 10-13.4s-4.4-11.8-10-13.4z"/></svg>',
    display:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#9c27b0" rx="4"/><path fill="white" d="M8 10v20h32V10H8zm28 16H12V14h24v12zm-12 4h-4v4h-4v4h12v-4h-4v-4z"/></svg>',
    power:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#4caf50" rx="4"/><path fill="white" d="M26 8h-4v14h4V8zm7.1 3.5l-2.8 2.8C32.7 16 34 18.8 34 22c0 5.5-4.5 10-10 10s-10-4.5-10-10c0-3.2 1.3-6 3.7-7.7l-2.8-2.8C11.5 14.3 10 18 10 22c0 7.7 6.3 14 14 14s14-6.3 14-14c0-4-1.5-7.7-4.9-10.5z"/></svg>',
    keyboard:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#607d8b" rx="4"/><rect x="10" y="14" width="28" height="20" rx="2" fill="white"/><rect x="13" y="17" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="17" y="17" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="21" y="17" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="25" y="17" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="29" y="17" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="13" y="21" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="17" y="21" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="21" y="21" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="25" y="21" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="29" y="21" width="3" height="3" rx="0.5" fill="#607d8b"/><rect x="15" y="28" width="18" height="3" rx="0.5" fill="#607d8b"/></svg>',
    mouse:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#607d8b" rx="4"/><path fill="white" d="M24 10c-5.5 0-10 4.5-10 10v8c0 5.5 4.5 10 10 10s10-4.5 10-10v-8c0-5.5-4.5-10-10-10zm-6 10c0-3.3 2.7-6 6-6s6 2.7 6 6v2H18v-2zm0 6h12v2c0 3.3-2.7 6-6 6s-6-2.7-6-6v-2z"/></svg>',
    printers:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#795548" rx="4"/><path fill="white" d="M36 16H32V8H16v8H12c-2.2 0-4 1.8-4 4v10h8v10h16V30h8V20c0-2.2-1.8-4-4-4zm-16-4h8v4h-8v-4zm8 24h-8V28h8v8zm8-12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>',
    users:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ff5722" rx="4"/><circle cx="24" cy="18" r="6" fill="white"/><path fill="white" d="M24 26c-6.6 0-12 3-12 6.7V36h24v-3.3c0-3.7-5.4-6.7-12-6.7z"/></svg>',
    datetime:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ff9800" rx="4"/><circle cx="24" cy="24" r="12" fill="white"/><path fill="#ff9800" d="M24 14v10l7 4-1.2 2-8.8-5V14h3z"/></svg>',
    privacy:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#f44336" rx="4"/><path fill="white" d="M24 8L10 14v10c0 8.6 6 16.6 14 18 8-1.4 14-9.4 14-18V14L24 8zm0 22h-2v-2h2v2zm0-4h-2v-8h2v8z"/></svg>',
    appearance:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#e91e63" rx="4"/><circle cx="24" cy="24" r="8" fill="white"/><path fill="white" d="M24 10c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2s2-.9 2-2v-2c0-1.1-.9-2-2-2zm0 24c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2s2-.9 2-2v-2c0-1.1-.9-2-2-2zm12-12c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2s.9 2 2 2h2c1.1 0 2-.9 2-2zm-24 0c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2s.9 2 2 2h2c1.1 0 2-.9 2-2z"/></svg>'
  }

  return svgDataUrl(icons[settingId] ?? icons['appearance'] ?? '')
}

function openGoogleSearch(query: string): void {
  if (!query || typeof query !== 'string') return
  const sanitizedQuery = query.trim().substring(0, 1000)

  window.electronAPI.searchWeb(sanitizedQuery)

  searchInput.value = ''
  filteredResults = []
  displayResults()
}

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

async function loadApplications() {
  try {
    allApps = await window.electronAPI.getApplications()
    console.log(`Loaded ${allApps.length} applications`)
    updateIndexCounter()
  } catch {
    console.error('Error loading applications')
  }
}

async function loadFiles() {
  try {
    allFiles = await window.electronAPI.getFiles()
    console.log(`Loaded ${allFiles.length} files`)
    updateIndexCounter()
  } catch {
    console.error('Error loading files')
  }
}

async function loadSettings() {
  try {
    allSettings = await window.electronAPI.searchSettings('')
    console.log(`Loaded ${allSettings.length} settings`)
  } catch {
    console.error('Error loading settings')
  }
}

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
      filteredResults = [
        {
          name: 'Rechercher sur Google',
          description: `"${searchQuery}"`,
          resultType: 'web-search',
          searchQuery: searchQuery,
          icon: getGoogleIcon()
        }
      ]
      calculationResult = null
      selectedIndex = 0
      return
    }
  }

  // === SNIPPET: ">" - Exécution de commande ===
  if (query.startsWith('>')) {
    const command = query.substring(1).trim()
    if (command) {
      filteredResults = [
        {
          name: 'Exécuter la commande',
          description: command,
          resultType: 'command',
          command: command,
          icon: getTerminalIcon()
        }
      ]
      calculationResult = null
      selectedIndex = 0
      return
    }
  }

  // === SNIPPET: "to" - Conversion ===
  if (query.includes(' to ')) {
    const conversionResult = tryConversion(query)
    if (conversionResult) {
      filteredResults = [
        {
          name: conversionResult.result,
          description: conversionResult.description,
          resultType: 'conversion',
          value: conversionResult.result,
          icon: getConversionIcon()
        }
      ]
      calculationResult = null
      selectedIndex = 0
      return
    }
  }

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

  if (!searchFilesOnly) {
    const apps = allApps
      .filter((app) => {
        return (
          app.name.toLowerCase().includes(lowerQuery) ||
          app.description?.toLowerCase().includes(lowerQuery)
        )
      })
      .map((app) => ({
        ...app,
        resultType: 'app',
        score: app.name.toLowerCase().startsWith(lowerQuery) ? 2 : 1
      }))
    results.push(...apps)
  }

  if (!searchAppsOnly) {
    const files = allFiles
      .filter((file) => {
        return file.name.toLowerCase().includes(lowerQuery)
      })
      .map((file) => ({
        ...file,
        resultType: 'file',
        score: file.name.toLowerCase().startsWith(lowerQuery) ? 2 : 1
      }))
    results.push(...files)
  }

  if (!searchAppsOnly && !searchFilesOnly) {
    const settings = allSettings
      .filter((setting) => {
        return (
          setting.name.toLowerCase().includes(lowerQuery) ||
          (setting.keywords ?? []).some((kw) => kw.toLowerCase().includes(lowerQuery))
        )
      })
      .map((setting) => ({
        ...setting,
        resultType: 'setting',
        score: setting.name.toLowerCase().startsWith(lowerQuery)
          ? 3
          : (setting.keywords ?? []).some((kw) => kw.toLowerCase().startsWith(lowerQuery))
            ? 2.5
            : 1
      }))
    results.push(...settings)
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score

    // Priorité : paramètres > apps > fichiers (si même score)
    const typeOrder: Record<string, number> = { setting: 3, app: 2, file: 1 }
    const orderA = typeOrder[a.resultType] || 0
    const orderB = typeOrder[b.resultType] || 0

    if (orderA !== orderB) return orderB - orderA

    return 0
  })

  filteredResults = results.slice(0, 10)
  selectedIndex = 0
}

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
    const isSnippet =
      query.startsWith('.') ||
      query.startsWith('?') ||
      query.startsWith('>') ||
      query.includes(' to ')

    if (query && !isSnippet) {
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
      displayHistory()
    }
    return
  }

  filteredResults.forEach((result, index) => {
    const item = document.createElement('div')
    item.className = 'result-item' + (index === selectedIndex ? ' selected' : '')

    const icon = document.createElement('img')
    icon.className = 'result-icon'

    if (result.resultType === 'app') {
      if (result.iconPath) {
        icon.src = createMediaUrl(result.iconPath)
      } else {
        icon.src = getIconPath(result.icon ?? '')
      }
      icon.onerror = () => {
        icon.src =
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23555"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10">?</text></svg>'
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
      const fileIconInfo = getFileIcon(result.name, result.path ?? '', result.type)

      icon.src = fileIconInfo.src

      if (fileIconInfo.type === 'image') {
        icon.style.objectFit = 'cover'
        icon.onerror = () => {
          icon.src = svgDataUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
              <rect width="48" height="48" fill="#4caf50" rx="4"/>
              <text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">IMG</text>
            </svg>
          `)
        }
      }
    }

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
    } else if (result.description) {
      // Résultats de snippets (commande, web, conversion) : la description
      // porte la donnée saisie, sans elle l'élément est ambigu.
      description.textContent = result.description
    } else if (result.path) {
      description.textContent = result.path
    }

    info.appendChild(name)
    info.appendChild(description)

    item.appendChild(icon)
    item.appendChild(info)

    if (result.resultType === 'file') {
      const openButton = document.createElement('button')
      openButton.className = 'open-file-btn'
      openButton.innerHTML = '▶'
      openButton.title = 'Ouvrir le fichier'
      openButton.addEventListener('click', (e) => {
        e.stopPropagation()
        openResult(result, true)
      })
      item.appendChild(openButton)
    }

    if (result.resultType === 'setting' && result.actions) {
      const toggleAction = result.actions.find((a) => a.id === 'toggle')

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

        window.electronAPI
          .getSettingState(result.id ?? '')
          .then((isEnabled) => {
            checkbox.checked = isEnabled // checked = vert = activé, unchecked = gris = désactivé
          })
          .catch(() => {
            console.error('Error loading setting state')
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

/**
 * URL d'icône pour une application dont le chemin n'a pas été résolu par le
 * main : chemin absolu tel quel, sinon emplacement hicolor standard, avec
 * repli sur `onerror` côté élément image.
 */
function getIconPath(iconName: string): string {
  if (!iconName) {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><rect width="24" height="24" fill="%23666"/></svg>'
  }

  if (iconName.startsWith('/')) {
    return createMediaUrl(iconName)
  }

  return createMediaUrl(`/usr/share/icons/hicolor/48x48/apps/${iconName}.png`)
}

/**
 * Copie une valeur dans le presse-papier en l'affichant brièvement dans le
 * champ de recherche, puis rend la main à `reset`. En cas d'échec de la
 * copie, `reset` est appelé immédiatement.
 */
function copyToClipboardThenReset(value: string, reset: () => void): void {
  void navigator.clipboard
    .writeText(value)
    .then(() => {
      searchInput.value = value
      setTimeout(reset, 300)
    })
    .catch(reset)
}

function openResult(result: SearchResult, forceOpenFile = false): void {
  // Ajouter à l'historique avant d'ouvrir (sauf pour conversions, commandes et paramètres)
  if (
    result.resultType !== 'conversion' &&
    result.resultType !== 'command' &&
    result.resultType !== 'web-search' &&
    result.resultType !== 'setting'
  ) {
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
    openGoogleSearch(result.searchQuery ?? '')
    return // Ne pas vider l'input ici, openGoogleSearch le fait déjà
  } else if (result.resultType === 'command') {
    window.electronAPI.executeCommand(result.command ?? '')
  } else if (result.resultType === 'conversion') {
    copyToClipboardThenReset(String(result.value ?? ''), () => {
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

function selectItem(delta: number): void {
  if (filteredResults.length === 0) return

  selectedIndex = (selectedIndex + delta + filteredResults.length) % filteredResults.length
  displayResults()

  const selectedElement = resultsContainer.querySelector('.result-item.selected')
  if (selectedElement) {
    selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

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
  } catch {
    console.error("Échec de l'effacement")
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
      .catch(() => {
        console.error('Échec de la réindexation')
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
      copyToClipboardThenReset(String(calculationResult), () => {
        searchInput.value = ''
        calculationResult = null
        filteredResults = []
        displayResults()
      })
    } else if (filteredResults.length > 0 && selectedIndex >= 0) {
      const selection = filteredResults[selectedIndex]
      if (selection) openResult(selection)
    } else if (searchInput.value.trim()) {
      openGoogleSearch(searchInput.value)
    }
  }
})
