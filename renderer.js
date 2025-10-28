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

function openGoogleSearch(query) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
  window.electronAPI.openFile(searchUrl)

  searchInput.value = ''
  filteredResults = []
  displayResults()
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
  const lowerQuery = query.toLowerCase()
  const results = []

  // Filtrer les applications
  const apps = allApps.filter(app => {
    return app.name.toLowerCase().includes(lowerQuery) ||
           (app.description && app.description.toLowerCase().includes(lowerQuery))
  }).map(app => ({
    ...app,
    resultType: 'app',
    score: app.name.toLowerCase().startsWith(lowerQuery) ? 2 : 1
  }))

  // Filtrer les fichiers
  const files = allFiles.filter(file => {
    return file.name.toLowerCase().includes(lowerQuery)
  }).map(file => ({
    ...file,
    resultType: 'file',
    score: file.name.toLowerCase().startsWith(lowerQuery) ? 2 : 1
  }))

  // Combiner et trier par score (apps en premier si score égal)
  results.push(...apps, ...files)
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.resultType === 'app' && b.resultType !== 'app') return -1
    if (a.resultType !== 'app' && b.resultType === 'app') return 1
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
    if (searchInput.value.trim()) {
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
  if (result.resultType === 'app' && result.exec) {
    window.electronAPI.launchApp(result.exec)
  } else if (result.resultType === 'file' && result.path) {
    window.electronAPI.openFile(result.path)
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
  await Promise.all([loadApplications(), loadFiles()])
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