// Focus automatiquement sur l'input au chargement
const searchInput = document.getElementById('searchInput')
const resultsContainer = document.getElementById('resultsContainer')
const calculationResultElement = document.getElementById('calculationResult')
const indexCounter = document.getElementById('indexCounter')

let allApps = []
let allFiles = []
let allSettings = []
let filteredResults = []
let selectedIndex = 0
let calculationResult = null
let searchHistory = []

// === SÉCURITÉ : FONCTIONS D'ÉCHAPPEMENT ET VALIDATION ===

/**
 * Échappe les caractères HTML pour prévenir XSS
 * @param {string} text - Texte à échapper
 * @returns {string} Texte sécurisé
 */
function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Valide une URL pour empêcher javascript: et data: malveillants
 * @param {string} url - URL à valider
 * @returns {boolean} true si l'URL est sûre
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false

  // Bloquer les URLs potentiellement dangereuses
  const dangerousProtocols = /^(javascript|data|vbscript):/i
  if (dangerousProtocols.test(url)) {
    console.error('Dangerous URL protocol blocked:', url)
    return false
  }

  return true
}

/**
 * Valide les données de l'historique
 * @param {any} data - Données à valider
 * @returns {boolean} true si valide
 */
function validateHistoryData(data) {
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
function loadHistory() {
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
function saveHistory() {
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
function addToHistory(query, resultType, result) {
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
function removeFromHistory(index) {
  searchHistory.splice(index, 1)
  saveHistory()
  displayResults()
  // Redonner le focus à l'input pour garder le contrôle clavier
  searchInput.focus()
}

// Afficher les snippets disponibles
function displaySnippets() {
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
    item.style.cssText = 'cursor: default; opacity: 0.8;'

    const icon = document.createElement('div')
    icon.className = 'snippet-symbol'
    icon.textContent = snippet.symbol
    icon.style.cssText = 'width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; color: #888; font-weight: bold; font-size: 20px; flex-shrink: 0;'

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
function displayHistory() {
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
function getHistoryIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#666" rx="4"/><path fill="white" d="M24 10c-7.7 0-14 6.3-14 14s6.3 14 14 14 14-6.3 14-14h-4c0 5.5-4.5 10-10 10s-10-4.5-10-10 4.5-10 10-10v4l6-6-6-6v4z"/></svg>')
}

// Formater le temps écoulé
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'À l\'instant'
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`
  if (seconds < 604800) return `Il y a ${Math.floor(seconds / 86400)} j`
  return `Il y a ${Math.floor(seconds / 604800)} sem`
}

// Système d'icônes de fichiers
function getFileIcon(fileName, filePath, fileType) {
  // Dossier en premier (avant de vérifier l'extension)
  if (fileType === 'folder') {
    return { type: 'icon', src: getFolderIcon() }
  }

  // Obtenir l'extension
  const parts = fileName.split('.')
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''

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
  const codeColors = {
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

function getDocIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#2b579a" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">DOC</text></svg>')
}

function getPdfIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#f40f02" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">PDF</text></svg>')
}

function getSpreadsheetIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#217346" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">XLS</text></svg>')
}

function getArchiveIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#7e7e7e" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">ZIP</text></svg>')
}

function getVideoIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ff4444" rx="4"/><polygon points="18,14 32,24 18,34" fill="white"/></svg>')
}

function getAudioIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#9c27b0" rx="4"/><circle cx="20" cy="28" r="4" fill="white"/><rect x="24" y="12" width="2" height="16" fill="white"/></svg>')
}

function getCodeIcon(label, color) {
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${color}" rx="4"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${label}</text></svg>`)
}

function getFolderIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#ffa726" d="M10 12h14l4 4h14v20H10z"/><path fill="#ffb74d" d="M10 16h32v20H10z"/></svg>')
}

function getGenericFileIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#90a4ae" rx="4"/><path fill="white" d="M14 10h14l6 6v22H14z" opacity="0.9"/></svg>')
}

function getGoogleIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#4285f4" rx="4"/><path fill="white" d="M24 20v5h7.5c-.3 1.6-1.9 4.7-7.5 4.7-4.5 0-8.2-3.7-8.2-8.2s3.7-8.2 8.2-8.2c2.6 0 4.3 1.1 5.3 2l4-3.9C30.8 9.2 27.7 8 24 8c-7.7 0-14 6.3-14 14s6.3 14 14 14c8.1 0 13.5-5.7 13.5-13.7 0-.9-.1-1.6-.2-2.3H24z"/></svg>')
}

function getTerminalIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#2d2d2d" rx="4"/><path fill="#4caf50" d="M12 14l6 6-6 6v-2l4-4-4-4v-2z"/><rect x="20" y="24" width="10" height="2" fill="#4caf50"/></svg>')
}

function getConversionIcon() {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#ff9800" rx="4"/><path fill="white" d="M20 16l-4 4 4 4v-3h8v-2h-8v-3zm8 12l4-4-4-4v3h-8v2h8v3z"/></svg>')
}

function getSettingIcon(settingId) {
  const icons = {
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

  return 'data:image/svg+xml,' + encodeURIComponent(icons[settingId] || icons['appearance'])
}

function openGoogleSearch(query) {
  // SÉCURITÉ : Valider et limiter la requête
  if (!query || typeof query !== 'string') return
  const sanitizedQuery = query.trim().substring(0, 1000)

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(sanitizedQuery)}`

  // SÉCURITÉ : Valider l'URL avant de l'ouvrir
  if (isValidUrl(searchUrl)) {
    window.electronAPI.openFile(searchUrl)
  } else {
    console.error('Invalid search URL')
    return
  }

  searchInput.value = ''
  filteredResults = []
  displayResults()
}

// Fonction de conversion universelle (devises, unités, pixels, etc.)
function tryConversion(query) {
  // Parser la requête : "valeur unité_source to unité_destination"
  const match = query.match(/^([\d.,]+)\s*([a-zA-Z€$£¥°%]+)\s+to\s+([a-zA-Z€$£¥°%]+)$/i)

  if (!match) return null

  const value = parseFloat(match[1].replace(',', '.'))
  const fromUnit = match[2].toLowerCase()
  const toUnit = match[3].toLowerCase()

  if (isNaN(value)) return null

  // Tables de conversion complètes
  const conversions = {
    // ===== DEVISES =====
    'currencies': {
      'usd': { 'eur': 0.92, 'gbp': 0.79, 'jpy': 149.5, 'cad': 1.36, 'chf': 0.88, 'aud': 1.52, 'cny': 7.24 },
      '$': { 'eur': 0.92, '€': 0.92, 'gbp': 0.79, '£': 0.79, 'jpy': 149.5, '¥': 149.5 },
      'eur': { 'usd': 1.09, 'gbp': 0.86, 'jpy': 163, 'cad': 1.48, 'chf': 0.96, 'aud': 1.65, 'cny': 7.87 },
      '€': { 'usd': 1.09, '$': 1.09, 'gbp': 0.86, '£': 0.86, 'jpy': 163, '¥': 163 },
      'gbp': { 'usd': 1.27, 'eur': 1.16, 'jpy': 189, 'cad': 1.72, 'chf': 1.11, 'aud': 1.92, 'cny': 9.15 },
      '£': { 'usd': 1.27, '$': 1.27, 'eur': 1.16, '€': 1.16, 'jpy': 189, '¥': 189 },
      'jpy': { 'usd': 0.0067, 'eur': 0.0061, 'gbp': 0.0053, 'cad': 0.0091, 'chf': 0.0059 },
      '¥': { 'usd': 0.0067, '$': 0.0067, 'eur': 0.0061, '€': 0.0061, 'gbp': 0.0053, '£': 0.0053 },
      'cad': { 'usd': 0.74, 'eur': 0.68, 'gbp': 0.58, 'jpy': 110, 'chf': 0.65 },
      'chf': { 'usd': 1.14, 'eur': 1.04, 'gbp': 0.90, 'jpy': 170, 'cad': 1.54 },
      'aud': { 'usd': 0.66, 'eur': 0.61, 'gbp': 0.52, 'jpy': 98, 'cad': 0.89 },
      'cny': { 'usd': 0.14, 'eur': 0.13, 'gbp': 0.11, 'jpy': 20.7, 'cad': 0.19 }
    },

    // ===== LONGUEURS / DISTANCES =====
    'length': {
      // Métriques
      'km': { 'm': 1000, 'cm': 100000, 'mm': 1000000, 'µm': 1e9, 'nm': 1e12, 'mi': 0.621371, 'yd': 1093.61, 'ft': 3280.84, 'in': 39370.1 },
      'm': { 'km': 0.001, 'cm': 100, 'mm': 1000, 'µm': 1e6, 'nm': 1e9, 'mi': 0.000621371, 'yd': 1.09361, 'ft': 3.28084, 'in': 39.3701 },
      'cm': { 'km': 0.00001, 'm': 0.01, 'mm': 10, 'µm': 10000, 'nm': 1e7, 'mi': 0.00000621371, 'yd': 0.0109361, 'ft': 0.0328084, 'in': 0.393701 },
      'mm': { 'km': 0.000001, 'm': 0.001, 'cm': 0.1, 'µm': 1000, 'nm': 1e6, 'mi': 0.000000621371, 'yd': 0.00109361, 'ft': 0.00328084, 'in': 0.0393701 },
      'µm': { 'km': 1e-9, 'm': 1e-6, 'cm': 1e-4, 'mm': 0.001, 'nm': 1000, 'in': 0.0000393701 },
      'nm': { 'km': 1e-12, 'm': 1e-9, 'cm': 1e-7, 'mm': 1e-6, 'µm': 0.001, 'in': 0.0000000393701 },
      // Impériales
      'mi': { 'km': 1.60934, 'm': 1609.34, 'cm': 160934, 'mm': 1609340, 'yd': 1760, 'ft': 5280, 'in': 63360 },
      'yd': { 'km': 0.0009144, 'm': 0.9144, 'cm': 91.44, 'mm': 914.4, 'mi': 0.000568182, 'ft': 3, 'in': 36 },
      'ft': { 'km': 0.0003048, 'm': 0.3048, 'cm': 30.48, 'mm': 304.8, 'mi': 0.000189394, 'yd': 0.333333, 'in': 12 },
      'in': { 'km': 0.0000254, 'm': 0.0254, 'cm': 2.54, 'mm': 25.4, 'µm': 25400, 'nm': 25400000, 'mi': 0.000015783, 'yd': 0.0277778, 'ft': 0.0833333 }
    },

    // ===== POIDS / MASSES =====
    'weight': {
      // Métriques
      'kg': { 'g': 1000, 'mg': 1e6, 'µg': 1e9, 't': 0.001, 'lb': 2.20462, 'oz': 35.274, 'ton': 0.00110231 },
      'g': { 'kg': 0.001, 'mg': 1000, 'µg': 1e6, 't': 1e-6, 'lb': 0.00220462, 'oz': 0.035274 },
      'mg': { 'kg': 1e-6, 'g': 0.001, 'µg': 1000, 't': 1e-9, 'lb': 0.00000220462, 'oz': 0.000035274 },
      'µg': { 'kg': 1e-9, 'g': 1e-6, 'mg': 0.001, 't': 1e-12 },
      't': { 'kg': 1000, 'g': 1e6, 'mg': 1e9, 'lb': 2204.62, 'oz': 35274, 'ton': 1.10231 },
      // Impériales
      'lb': { 'kg': 0.453592, 'g': 453.592, 'mg': 453592, 'oz': 16, 'ton': 0.0005 },
      'oz': { 'kg': 0.0283495, 'g': 28.3495, 'mg': 28349.5, 'lb': 0.0625 },
      'ton': { 'kg': 907.185, 'g': 907185, 't': 0.907185, 'lb': 2000, 'oz': 32000 }
    },

    // ===== TEMPÉRATURES =====
    'temperature': {
      'c': { 'f': (v) => v * 9/5 + 32, '°f': (v) => v * 9/5 + 32, 'k': (v) => v + 273.15 },
      '°c': { 'f': (v) => v * 9/5 + 32, '°f': (v) => v * 9/5 + 32, 'k': (v) => v + 273.15 },
      'f': { 'c': (v) => (v - 32) * 5/9, '°c': (v) => (v - 32) * 5/9, 'k': (v) => (v - 32) * 5/9 + 273.15 },
      '°f': { 'c': (v) => (v - 32) * 5/9, '°c': (v) => (v - 32) * 5/9, 'k': (v) => (v - 32) * 5/9 + 273.15 },
      'k': { 'c': (v) => v - 273.15, '°c': (v) => v - 273.15, 'f': (v) => (v - 273.15) * 9/5 + 32, '°f': (v) => (v - 273.15) * 9/5 + 32 }
    },

    // ===== VOLUMES / CAPACITÉS =====
    'volume': {
      // Métriques
      'l': { 'ml': 1000, 'cl': 100, 'dl': 10, 'm³': 0.001, 'cm³': 1000, 'gal': 0.264172, 'qt': 1.05669, 'pt': 2.11338, 'cup': 4.22675, 'floz': 33.814 },
      'ml': { 'l': 0.001, 'cl': 0.1, 'dl': 0.01, 'm³': 1e-6, 'cm³': 1, 'gal': 0.000264172, 'qt': 0.00105669, 'pt': 0.00211338, 'cup': 0.00422675, 'floz': 0.033814 },
      'cl': { 'l': 0.01, 'ml': 10, 'dl': 0.1, 'm³': 0.00001, 'cm³': 10, 'gal': 0.00264172, 'qt': 0.0105669, 'pt': 0.0211338, 'cup': 0.0422675, 'floz': 0.33814 },
      'dl': { 'l': 0.1, 'ml': 100, 'cl': 10, 'm³': 0.0001, 'cm³': 100, 'gal': 0.0264172, 'qt': 0.105669, 'pt': 0.211338, 'cup': 0.422675, 'floz': 3.3814 },
      'm³': { 'l': 1000, 'ml': 1e6, 'cl': 100000, 'cm³': 1e6, 'gal': 264.172, 'qt': 1056.69 },
      'cm³': { 'l': 0.001, 'ml': 1, 'cl': 0.1, 'm³': 1e-6 },
      // Impériales / US
      'gal': { 'l': 3.78541, 'ml': 3785.41, 'cl': 378.541, 'qt': 4, 'pt': 8, 'cup': 16, 'floz': 128 },
      'qt': { 'l': 0.946353, 'ml': 946.353, 'cl': 94.6353, 'gal': 0.25, 'pt': 2, 'cup': 4, 'floz': 32 },
      'pt': { 'l': 0.473176, 'ml': 473.176, 'cl': 47.3176, 'gal': 0.125, 'qt': 0.5, 'cup': 2, 'floz': 16 },
      'cup': { 'l': 0.236588, 'ml': 236.588, 'cl': 23.6588, 'gal': 0.0625, 'qt': 0.25, 'pt': 0.5, 'floz': 8 },
      'floz': { 'l': 0.0295735, 'ml': 29.5735, 'cl': 2.95735, 'gal': 0.0078125, 'qt': 0.03125, 'pt': 0.0625, 'cup': 0.125 }
    },

    // ===== SURFACES / AIRES =====
    'area': {
      // Métriques
      'km²': { 'm²': 1e6, 'cm²': 1e10, 'ha': 100, 'a': 10000, 'mi²': 0.386102, 'ac': 247.105, 'yd²': 1.196e6, 'ft²': 1.076e7 },
      'm²': { 'km²': 1e-6, 'cm²': 10000, 'mm²': 1e6, 'ha': 0.0001, 'a': 0.01, 'mi²': 3.861e-7, 'ac': 0.000247105, 'yd²': 1.19599, 'ft²': 10.7639, 'in²': 1550 },
      'cm²': { 'km²': 1e-10, 'm²': 0.0001, 'mm²': 100, 'in²': 0.155 },
      'mm²': { 'm²': 1e-6, 'cm²': 0.01, 'in²': 0.00155 },
      'ha': { 'km²': 0.01, 'm²': 10000, 'a': 100, 'ac': 2.47105 },
      'a': { 'km²': 0.0001, 'm²': 100, 'ha': 0.01 },
      // Impériales
      'mi²': { 'km²': 2.58999, 'm²': 2.59e6, 'ha': 259, 'ac': 640, 'yd²': 3.098e6, 'ft²': 2.788e7 },
      'ac': { 'km²': 0.00404686, 'm²': 4046.86, 'ha': 0.404686, 'mi²': 0.0015625, 'yd²': 4840, 'ft²': 43560 },
      'yd²': { 'km²': 8.361e-7, 'm²': 0.836127, 'mi²': 3.228e-7, 'ac': 0.000206612, 'ft²': 9, 'in²': 1296 },
      'ft²': { 'km²': 9.290e-8, 'm²': 0.092903, 'cm²': 929.03, 'mi²': 3.587e-8, 'ac': 0.0000229568, 'yd²': 0.111111, 'in²': 144 },
      'in²': { 'm²': 0.00064516, 'cm²': 6.4516, 'mm²': 645.16, 'ft²': 0.00694444, 'yd²': 0.000771605 }
    },

    // ===== VITESSES =====
    'speed': {
      'km/h': { 'm/s': 0.277778, 'mph': 0.621371, 'ft/s': 0.911344, 'knot': 0.539957 },
      'kmh': { 'm/s': 0.277778, 'mph': 0.621371, 'ft/s': 0.911344, 'knot': 0.539957 },
      'kph': { 'm/s': 0.277778, 'mph': 0.621371, 'ft/s': 0.911344, 'knot': 0.539957 },
      'm/s': { 'km/h': 3.6, 'kmh': 3.6, 'kph': 3.6, 'mph': 2.23694, 'ft/s': 3.28084, 'knot': 1.94384 },
      'mph': { 'km/h': 1.60934, 'kmh': 1.60934, 'kph': 1.60934, 'm/s': 0.44704, 'ft/s': 1.46667, 'knot': 0.868976 },
      'ft/s': { 'km/h': 1.09728, 'kmh': 1.09728, 'm/s': 0.3048, 'mph': 0.681818, 'knot': 0.592484 },
      'knot': { 'km/h': 1.852, 'kmh': 1.852, 'm/s': 0.514444, 'mph': 1.15078, 'ft/s': 1.68781 }
    },

    // ===== TEMPS =====
    'time': {
      's': { 'ms': 1000, 'µs': 1e6, 'ns': 1e9, 'min': 0.0166667, 'h': 0.000277778, 'd': 0.0000115741, 'week': 0.00000165344, 'month': 3.8052e-7, 'year': 3.171e-8 },
      'ms': { 's': 0.001, 'µs': 1000, 'ns': 1e6, 'min': 0.0000166667, 'h': 2.7778e-7 },
      'µs': { 's': 1e-6, 'ms': 0.001, 'ns': 1000 },
      'ns': { 's': 1e-9, 'ms': 1e-6, 'µs': 0.001 },
      'min': { 's': 60, 'ms': 60000, 'h': 0.0166667, 'd': 0.000694444, 'week': 0.0000992063, 'month': 0.0000228154, 'year': 0.00000190259 },
      'h': { 's': 3600, 'ms': 3.6e6, 'min': 60, 'd': 0.0416667, 'week': 0.00595238, 'month': 0.00136895, 'year': 0.000114155 },
      'd': { 's': 86400, 'ms': 8.64e7, 'min': 1440, 'h': 24, 'week': 0.142857, 'month': 0.0328767, 'year': 0.00273973 },
      'day': { 's': 86400, 'ms': 8.64e7, 'min': 1440, 'h': 24, 'week': 0.142857, 'month': 0.0328767, 'year': 0.00273973 },
      'week': { 's': 604800, 'min': 10080, 'h': 168, 'd': 7, 'day': 7, 'month': 0.230137, 'year': 0.0191781 },
      'month': { 's': 2.628e6, 'min': 43800, 'h': 730, 'd': 30.4167, 'day': 30.4167, 'week': 4.34524, 'year': 0.0833333 },
      'year': { 's': 3.154e7, 'min': 525600, 'h': 8760, 'd': 365, 'day': 365, 'week': 52.1429, 'month': 12 }
    },

    // ===== DONNÉES INFORMATIQUES =====
    'data': {
      // Bytes
      'b': { 'kb': 0.001, 'mb': 1e-6, 'gb': 1e-9, 'tb': 1e-12, 'pb': 1e-15, 'kib': 0.0009765625, 'mib': 9.537e-7, 'gib': 9.313e-10, 'tib': 9.095e-13 },
      'kb': { 'b': 1000, 'mb': 0.001, 'gb': 1e-6, 'tb': 1e-9, 'pb': 1e-12, 'kib': 0.9765625, 'mib': 0.000953674, 'gib': 9.313e-7, 'tib': 9.095e-10 },
      'mb': { 'b': 1e6, 'kb': 1000, 'gb': 0.001, 'tb': 1e-6, 'pb': 1e-9, 'kib': 976.5625, 'mib': 0.953674, 'gib': 0.000931323, 'tib': 9.095e-7 },
      'gb': { 'b': 1e9, 'kb': 1e6, 'mb': 1000, 'tb': 0.001, 'pb': 1e-6, 'kib': 976562.5, 'mib': 953.674, 'gib': 0.931323, 'tib': 0.000909495 },
      'tb': { 'b': 1e12, 'kb': 1e9, 'mb': 1e6, 'gb': 1000, 'pb': 0.001, 'mib': 953674, 'gib': 931.323, 'tib': 0.909495 },
      'pb': { 'b': 1e15, 'kb': 1e12, 'mb': 1e9, 'gb': 1e6, 'tb': 1000, 'gib': 931323, 'tib': 909.495 },
      // Binary (IEC)
      'kib': { 'b': 1024, 'kb': 1.024, 'mib': 0.0009765625, 'gib': 9.537e-7, 'tib': 9.313e-10 },
      'mib': { 'b': 1048576, 'kb': 1048.576, 'mb': 1.048576, 'kib': 1024, 'gib': 0.0009765625, 'tib': 9.537e-7 },
      'gib': { 'b': 1073741824, 'kb': 1073741.824, 'mb': 1073.741824, 'gb': 1.073741824, 'kib': 1048576, 'mib': 1024, 'tib': 0.0009765625 },
      'tib': { 'b': 1099511627776, 'kb': 1099511627.776, 'mb': 1099511.627776, 'gb': 1099.511627776, 'tb': 1.099511627776, 'kib': 1073741824, 'mib': 1048576, 'gib': 1024 }
    },

    // ===== PIXELS / WEB =====
    'web': {
      'px': { 'rem': (v, base = 16) => v / base, 'em': (v, base = 16) => v / base, 'pt': 0.75, 'cm': 0.0264583, 'mm': 0.264583, 'in': 0.0104167 },
      'rem': { 'px': (v, base = 16) => v * base, 'em': (v) => v, 'pt': (v, base = 16) => v * base * 0.75, 'cm': (v, base = 16) => v * base * 0.0264583, 'mm': (v, base = 16) => v * base * 0.264583, 'in': (v, base = 16) => v * base * 0.0104167 },
      'em': { 'px': (v, base = 16) => v * base, 'rem': (v) => v, 'pt': (v, base = 16) => v * base * 0.75, 'cm': (v, base = 16) => v * base * 0.0264583, 'mm': (v, base = 16) => v * base * 0.264583, 'in': (v, base = 16) => v * base * 0.0104167 },
      'pt': { 'px': 1.33333, 'rem': (v, base = 16) => v * 1.33333 / base, 'em': (v, base = 16) => v * 1.33333 / base, 'cm': 0.0352778, 'mm': 0.352778, 'in': 0.0138889 },
      '%': { 'decimal': 0.01 },
      'percent': { 'decimal': 0.01 },
      'decimal': { '%': 100, 'percent': 100 }
    },

    // ===== ANGLES =====
    'angle': {
      'deg': { 'rad': 0.0174533, 'grad': 1.11111, 'turn': 0.00277778 },
      '°': { 'rad': 0.0174533, 'grad': 1.11111, 'turn': 0.00277778 },
      'rad': { 'deg': 57.2958, '°': 57.2958, 'grad': 63.662, 'turn': 0.159155 },
      'grad': { 'deg': 0.9, '°': 0.9, 'rad': 0.015708, 'turn': 0.0025 },
      'turn': { 'deg': 360, '°': 360, 'rad': 6.28319, 'grad': 400 }
    },

    // ===== PRESSION =====
    'pressure': {
      'pa': { 'kpa': 0.001, 'mpa': 1e-6, 'bar': 0.00001, 'mbar': 0.01, 'psi': 0.000145038, 'atm': 0.00000986923, 'torr': 0.00750062, 'mmhg': 0.00750062 },
      'kpa': { 'pa': 1000, 'mpa': 0.001, 'bar': 0.01, 'mbar': 10, 'psi': 0.145038, 'atm': 0.00986923, 'torr': 7.50062, 'mmhg': 7.50062 },
      'mpa': { 'pa': 1e6, 'kpa': 1000, 'bar': 10, 'psi': 145.038, 'atm': 9.86923 },
      'bar': { 'pa': 100000, 'kpa': 100, 'mpa': 0.1, 'mbar': 1000, 'psi': 14.5038, 'atm': 0.986923, 'torr': 750.062, 'mmhg': 750.062 },
      'mbar': { 'pa': 100, 'kpa': 0.1, 'bar': 0.001, 'psi': 0.0145038, 'atm': 0.000986923 },
      'psi': { 'pa': 6894.76, 'kpa': 6.89476, 'mpa': 0.00689476, 'bar': 0.0689476, 'mbar': 68.9476, 'atm': 0.068046, 'torr': 51.7149, 'mmhg': 51.7149 },
      'atm': { 'pa': 101325, 'kpa': 101.325, 'mpa': 0.101325, 'bar': 1.01325, 'mbar': 1013.25, 'psi': 14.6959, 'torr': 760, 'mmhg': 760 },
      'torr': { 'pa': 133.322, 'kpa': 0.133322, 'bar': 0.00133322, 'psi': 0.0193368, 'atm': 0.00131579, 'mmhg': 1 },
      'mmhg': { 'pa': 133.322, 'kpa': 0.133322, 'bar': 0.00133322, 'psi': 0.0193368, 'atm': 0.00131579, 'torr': 1 }
    },

    // ===== ÉNERGIE =====
    'energy': {
      'j': { 'kj': 0.001, 'cal': 0.239006, 'kcal': 0.000239006, 'wh': 0.000277778, 'kwh': 2.778e-7, 'ev': 6.242e18, 'btu': 0.000947817 },
      'kj': { 'j': 1000, 'cal': 239.006, 'kcal': 0.239006, 'wh': 0.277778, 'kwh': 0.000277778, 'btu': 0.947817 },
      'cal': { 'j': 4.184, 'kj': 0.004184, 'kcal': 0.001, 'wh': 0.00116222, 'kwh': 1.16222e-6 },
      'kcal': { 'j': 4184, 'kj': 4.184, 'cal': 1000, 'wh': 1.16222, 'kwh': 0.00116222, 'btu': 3.96567 },
      'wh': { 'j': 3600, 'kj': 3.6, 'cal': 860.421, 'kcal': 0.860421, 'kwh': 0.001, 'btu': 3.41214 },
      'kwh': { 'j': 3.6e6, 'kj': 3600, 'cal': 860421, 'kcal': 860.421, 'wh': 1000, 'btu': 3412.14 },
      'ev': { 'j': 1.602e-19, 'kj': 1.602e-22 },
      'btu': { 'j': 1055.06, 'kj': 1.05506, 'cal': 252.164, 'kcal': 0.252164, 'wh': 0.293071, 'kwh': 0.000293071 }
    },

    // ===== PUISSANCE =====
    'power': {
      'w': { 'kw': 0.001, 'mw': 1e-6, 'hp': 0.00134102, 'btu/h': 3.41214 },
      'kw': { 'w': 1000, 'mw': 0.001, 'hp': 1.34102, 'btu/h': 3412.14 },
      'mw': { 'w': 1e6, 'kw': 1000, 'hp': 1341.02, 'btu/h': 3412140 },
      'hp': { 'w': 745.7, 'kw': 0.7457, 'mw': 0.0007457, 'btu/h': 2544.43 },
      'btu/h': { 'w': 0.293071, 'kw': 0.000293071, 'hp': 0.000392832 }
    }
  }

  // Rechercher dans toutes les catégories
  for (const category in conversions) {
    const table = conversions[category]

    if (table[fromUnit] && table[fromUnit][toUnit] !== undefined) {
      const factor = table[fromUnit][toUnit]
      let result

      if (typeof factor === 'function') {
        // Pour les conversions avec fonctions (température, rem/em, etc.)
        result = factor(value)
      } else {
        result = value * factor
      }

      // Formater le résultat selon la précision
      let formattedResult
      if (Math.abs(result) >= 1000000) {
        formattedResult = result.toExponential(2)
      } else if (Math.abs(result) < 0.01 && result !== 0) {
        formattedResult = result.toExponential(2)
      } else {
        formattedResult = result.toFixed(6).replace(/\.?0+$/, '')
      }

      return {
        result: `${formattedResult} ${toUnit.toUpperCase()}`,
        description: `${value} ${fromUnit.toUpperCase()} = ${formattedResult} ${toUnit.toUpperCase()}`
      }
    }
  }

  return null
}

// Vérifier si une chaîne est une expression mathématique
function isMathExpression(str) {
  // Supprimer les espaces
  const cleaned = str.trim()

  // Ne doit contenir que des caractères mathématiques valides
  const validChars = /^[\d+\-*/^()%.\s]+$/.test(cleaned)
  if (!validChars) return false

  // Doit contenir au moins un opérateur mathématique
  const hasMathOperator = /[+\-*/^%]/.test(cleaned)
  if (!hasMathOperator) return false

  // Doit contenir au moins un chiffre
  const hasNumbers = /\d/.test(cleaned)
  if (!hasNumbers) return false

  return cleaned.length > 0
}

// Évaluer une expression mathématique de manière sécurisée sans eval
function evaluateMath(expression) {
  try {
    // Nettoyer l'expression
    let cleaned = expression.trim().replace(/\s/g, '')

    // Vérifier que l'expression ne contient que des caractères mathématiques
    if (!/^[\d+\-*/^.()%]+$/.test(cleaned)) {
      return null
    }

    // Parser et évaluer l'expression
    const result = parseExpression(cleaned)

    // Vérifier que le résultat est un nombre valide
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      // Arrondir à 10 décimales pour éviter les problèmes de précision
      return Math.round(result * 10000000000) / 10000000000
    }

    return null
  } catch (error) {
    console.error('Math evaluation error:', error)
    return null
  }
}

// Parser d'expressions mathématiques (sans eval)
function parseExpression(expr) {
  let pos = 0

  function peek() {
    return expr[pos]
  }

  function consume() {
    return expr[pos++]
  }

  function parseNumber() {
    let num = ''
    while (pos < expr.length && (peek().match(/[\d.]/) || (peek() === '-' && num === ''))) {
      num += consume()
    }
    return parseFloat(num)
  }

  function parseFactor() {
    if (peek() === '(') {
      consume() // (
      const result = parseAddSub()
      consume() // )
      return result
    }
    return parseNumber()
  }

  function parsePower() {
    let left = parseFactor()
    while (pos < expr.length && peek() === '^') {
      consume() // ^
      const right = parseFactor()
      left = Math.pow(left, right)
    }
    return left
  }

  function parseMulDivMod() {
    let left = parsePower()
    while (pos < expr.length) {
      const op = peek()
      if (op === '*') {
        consume()
        left = left * parsePower()
      } else if (op === '/') {
        consume()
        left = left / parsePower()
      } else if (op === '%') {
        consume()
        left = left % parsePower()
      } else {
        break
      }
    }
    return left
  }

  function parseAddSub() {
    let left = parseMulDivMod()
    while (pos < expr.length) {
      const op = peek()
      if (op === '+') {
        consume()
        left = left + parseMulDivMod()
      } else if (op === '-') {
        consume()
        left = left - parseMulDivMod()
      } else {
        break
      }
    }
    return left
  }

  return parseAddSub()
}

// Mettre à jour le compteur d'indexation
function updateIndexCounter() {
  const totalApps = allApps.length
  const totalFiles = allFiles.length
  const total = totalApps + totalFiles
  indexCounter.textContent = `${totalApps} apps · ${totalFiles} fichiers · ${total} total`
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
function filterResults(query) {
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
             setting.keywords.some(kw => kw.toLowerCase().includes(lowerQuery))
    }).map(setting => ({
      ...setting,
      resultType: 'setting',
      score: setting.name.toLowerCase().startsWith(lowerQuery) ? 3 :
             setting.keywords.some(kw => kw.toLowerCase().startsWith(lowerQuery)) ? 2.5 : 1
    }))
    results.push(...settings)
  }

  // Combiner et trier par score
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score

    // Priorité : paramètres > apps > fichiers (si même score)
    const typeOrder = { 'setting': 3, 'app': 2, 'file': 1 }
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
function displayResults() {
  resultsContainer.innerHTML = ''

  // Si c'est un calcul, afficher le résultat dans l'input et masquer la liste
  if (calculationResult !== null) {
    calculationResultElement.textContent = '= ' + calculationResult
    resultsContainer.style.display = 'none'
    return
  } else {
    calculationResultElement.textContent = ''
    resultsContainer.style.display = 'block'
  }

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
        icon.src = getIconPath(result.icon)
      }
      icon.onerror = () => {
        icon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23555"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10">?</text></svg>'
      }
    } else if (result.resultType === 'web-search') {
      // Icône de recherche web
      icon.src = result.icon
    } else if (result.resultType === 'command') {
      // Icône de terminal pour les commandes
      icon.src = result.icon
    } else if (result.resultType === 'conversion') {
      // Icône de conversion
      icon.src = result.icon
    } else if (result.resultType === 'setting') {
      // Icône de paramètre système - créer un SVG
      icon.src = getSettingIcon(result.id)
    } else {
      // Icône de fichier ou dossier avec le système d'icônes personnalisées
      const fileIconInfo = getFileIcon(result.name, result.path, result.type)

      console.log('File:', result.name, 'Type:', result.type, 'IconType:', fileIconInfo.type)

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
        window.electronAPI.getSettingState(result.id).then(isEnabled => {
          checkbox.checked = isEnabled // checked = vert = activé, unchecked = gris = désactivé
        }).catch(err => {
          console.error('Error loading setting state:', err)
        })

        toggleSwitch.addEventListener('click', (e) => {
          e.stopPropagation()
          // Inverser immédiatement pour feedback visuel
          checkbox.checked = !checkbox.checked
          window.electronAPI.executeSettingAction(result.id, 'toggle')
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
function getIconPath(iconName) {
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
function openResult(result, forceOpenFile = false) {
  // Ajouter à l'historique avant d'ouvrir (sauf pour conversions, commandes et paramètres)
  if (result.resultType !== 'conversion' && result.resultType !== 'command' && result.resultType !== 'web-search' && result.resultType !== 'setting') {
    const query = searchInput.value
    addToHistory(query, result.resultType, result)
  }

  if (result.resultType === 'app' && result.exec) {
    window.electronAPI.launchApp(result.exec)
  } else if (result.resultType === 'setting') {
    // Pour les paramètres, ouvrir l'action "settings" par défaut
    const settingsAction = result.actions.find(a => a.id === 'settings')
    if (settingsAction) {
      window.electronAPI.executeSettingAction(result.id, 'settings')
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
    openGoogleSearch(result.searchQuery)
    return // Ne pas vider l'input ici, openGoogleSearch le fait déjà
  } else if (result.resultType === 'command') {
    // Exécuter la commande dans un terminal
    window.electronAPI.executeCommand(result.command)
  } else if (result.resultType === 'conversion') {
    // Copier le résultat de la conversion dans le presse-papier
    navigator.clipboard.writeText(result.value).then(() => {
      // Montrer brièvement le résultat copié
      searchInput.value = result.value
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
function selectItem(delta) {
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

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
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
      navigator.clipboard.writeText(calculationResult.toString()).then(() => {
        // Remplacer l'input par le résultat brièvement pour montrer qu'il a été copié
        searchInput.value = calculationResult.toString()
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
      openResult(filteredResults[selectedIndex])
    } else if (searchInput.value.trim()) {
      // Si pas de résultats mais qu'il y a une recherche, ouvrir Google
      openGoogleSearch(searchInput.value)
    }
  }
})