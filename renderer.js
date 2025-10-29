// Focus automatiquement sur l'input au chargement
const searchInput = document.getElementById('searchInput')
const resultsContainer = document.getElementById('resultsContainer')
const calculationResultElement = document.getElementById('calculationResult')
const indexCounter = document.getElementById('indexCounter')

let allApps = []
let allFiles = []
let filteredResults = []
let selectedIndex = 0
let calculationResult = null
let searchHistory = []

// Charger l'historique depuis localStorage
function loadHistory() {
  try {
    const saved = localStorage.getItem('finderHistory')
    if (saved) {
      searchHistory = JSON.parse(saved)
    }
  } catch (error) {
    console.error('Error loading history:', error)
    searchHistory = []
  }
}

// Sauvegarder l'historique dans localStorage
function saveHistory() {
  try {
    localStorage.setItem('finderHistory', JSON.stringify(searchHistory))
  } catch (error) {
    console.error('Error saving history:', error)
  }
}

// Ajouter une entrée à l'historique
function addToHistory(query, resultType, result) {
  // Ne pas ajouter les calculs ou recherches vides
  if (!query.trim() || calculationResult !== null) return

  // Créer l'entrée d'historique
  const entry = {
    query: query.trim(),
    timestamp: Date.now(),
    type: resultType,
    name: result.name || query.trim()
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
    { symbol: 'to', name: 'Conversion', description: 'Convertir unités et devises (ex: 10$ to eur)' }
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
    deleteBtn.innerHTML = '×'
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

function openGoogleSearch(query) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
  window.electronAPI.openFile(searchUrl)

  searchInput.value = ''
  filteredResults = []
  displayResults()
}

// Fonction de conversion (devises et unités)
function tryConversion(query) {
  // Parser la requête : "valeur unité_source to unité_destination"
  const match = query.match(/^([\d.,]+)\s*([a-zA-Z€$£¥°]+)\s+to\s+([a-zA-Z€$£¥°]+)$/i)

  if (!match) return null

  const value = parseFloat(match[1].replace(',', '.'))
  const fromUnit = match[2].toLowerCase()
  const toUnit = match[3].toLowerCase()

  if (isNaN(value)) return null

  // Tables de conversion
  const conversions = {
    // Devises (taux approximatifs, devraient idéalement venir d'une API)
    'currencies': {
      'usd': { 'eur': 0.92, 'gbp': 0.79, 'jpy': 149.5, 'cad': 1.36, 'chf': 0.88 },
      '$': { 'eur': 0.92, '€': 0.92, 'gbp': 0.79, '£': 0.79 },
      'eur': { 'usd': 1.09, 'gbp': 0.86, 'jpy': 163, 'cad': 1.48, 'chf': 0.96 },
      '€': { 'usd': 1.09, '$': 1.09, 'gbp': 0.86, '£': 0.86 },
      'gbp': { 'usd': 1.27, 'eur': 1.16, 'jpy': 189, 'cad': 1.72, 'chf': 1.11 },
      '£': { 'usd': 1.27, '$': 1.27, 'eur': 1.16, '€': 1.16 },
    },

    // Longueurs
    'length': {
      'm': { 'km': 0.001, 'cm': 100, 'mm': 1000, 'ft': 3.28084, 'in': 39.3701, 'mi': 0.000621371 },
      'km': { 'm': 1000, 'cm': 100000, 'mm': 1000000, 'ft': 3280.84, 'in': 39370.1, 'mi': 0.621371 },
      'cm': { 'm': 0.01, 'km': 0.00001, 'mm': 10, 'ft': 0.0328084, 'in': 0.393701 },
      'mm': { 'm': 0.001, 'km': 0.000001, 'cm': 0.1, 'ft': 0.00328084, 'in': 0.0393701 },
      'ft': { 'm': 0.3048, 'km': 0.0003048, 'cm': 30.48, 'mm': 304.8, 'in': 12, 'mi': 0.000189394 },
      'in': { 'm': 0.0254, 'km': 0.0000254, 'cm': 2.54, 'mm': 25.4, 'ft': 0.0833333 },
      'mi': { 'm': 1609.34, 'km': 1.60934, 'ft': 5280, 'in': 63360 }
    },

    // Poids
    'weight': {
      'kg': { 'g': 1000, 'mg': 1000000, 'lb': 2.20462, 'oz': 35.274 },
      'g': { 'kg': 0.001, 'mg': 1000, 'lb': 0.00220462, 'oz': 0.035274 },
      'mg': { 'kg': 0.000001, 'g': 0.001, 'lb': 0.00000220462, 'oz': 0.000035274 },
      'lb': { 'kg': 0.453592, 'g': 453.592, 'mg': 453592, 'oz': 16 },
      'oz': { 'kg': 0.0283495, 'g': 28.3495, 'mg': 28349.5, 'lb': 0.0625 }
    },

    // Température
    'temperature': {
      'c': { 'f': (v) => v * 9/5 + 32, 'k': (v) => v + 273.15 },
      '°c': { 'f': (v) => v * 9/5 + 32, '°f': (v) => v * 9/5 + 32, 'k': (v) => v + 273.15 },
      'f': { 'c': (v) => (v - 32) * 5/9, 'k': (v) => (v - 32) * 5/9 + 273.15 },
      '°f': { 'c': (v) => (v - 32) * 5/9, '°c': (v) => (v - 32) * 5/9, 'k': (v) => (v - 32) * 5/9 + 273.15 },
      'k': { 'c': (v) => v - 273.15, 'f': (v) => (v - 273.15) * 9/5 + 32 }
    },

    // Volume
    'volume': {
      'l': { 'ml': 1000, 'gal': 0.264172, 'qt': 1.05669, 'pt': 2.11338 },
      'ml': { 'l': 0.001, 'gal': 0.000264172, 'qt': 0.00105669, 'pt': 0.00211338 },
      'gal': { 'l': 3.78541, 'ml': 3785.41, 'qt': 4, 'pt': 8 },
      'qt': { 'l': 0.946353, 'ml': 946.353, 'gal': 0.25, 'pt': 2 },
      'pt': { 'l': 0.473176, 'ml': 473.176, 'gal': 0.125, 'qt': 0.5 }
    }
  }

  // Rechercher dans toutes les catégories
  for (const category in conversions) {
    const table = conversions[category]

    if (table[fromUnit] && table[fromUnit][toUnit] !== undefined) {
      const factor = table[fromUnit][toUnit]
      let result

      if (typeof factor === 'function') {
        // Pour la température
        result = factor(value)
      } else {
        result = value * factor
      }

      // Formater le résultat
      const formattedResult = result.toFixed(2).replace(/\.?0+$/, '')

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

  // Combiner et trier par score (apps en premier si score égal, sauf si snippet "?")
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (!searchFilesOnly) {
      if (a.resultType === 'app' && b.resultType !== 'app') return -1
      if (a.resultType !== 'app' && b.resultType === 'app') return 1
    }
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
    } else {
      description.textContent = result.path
    }

    info.appendChild(name)
    info.appendChild(description)

    item.appendChild(icon)
    item.appendChild(info)

    // Click pour ouvrir
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
function openResult(result) {
  // Ajouter à l'historique avant d'ouvrir (sauf pour conversions et commandes)
  if (result.resultType !== 'conversion' && result.resultType !== 'command' && result.resultType !== 'web-search') {
    const query = searchInput.value
    addToHistory(query, result.resultType, result)
  }

  if (result.resultType === 'app' && result.exec) {
    window.electronAPI.launchApp(result.exec)
  } else if (result.resultType === 'file' && result.path) {
    window.electronAPI.openFile(result.path)
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
  await Promise.all([loadApplications(), loadFiles()])
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