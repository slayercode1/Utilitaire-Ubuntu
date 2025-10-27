// Focus automatiquement sur l'input au chargement
const searchInput = document.getElementById('searchInput')
const resultsContainer = document.getElementById('resultsContainer')

let allApps = []
let filteredApps = []
let selectedIndex = 0

// Charger toutes les applications au démarrage
async function loadApplications() {
  try {
    allApps = await window.electronAPI.getApplications()
    console.log(`Loaded ${allApps.length} applications`)
  } catch (error) {
    console.error('Error loading applications:', error)
  }
}

// Filtrer les applications selon la recherche
function filterApps(query) {
  if (!query.trim()) {
    filteredApps = []
    return
  }

  const lowerQuery = query.toLowerCase()
  filteredApps = allApps.filter(app => {
    return app.name.toLowerCase().includes(lowerQuery) ||
           (app.description && app.description.toLowerCase().includes(lowerQuery))
  }).slice(0, 10) // Limiter à 10 résultats

  selectedIndex = 0
}

// Afficher les résultats
function displayResults() {
  resultsContainer.innerHTML = ''

  if (filteredApps.length === 0) {
    if (searchInput.value.trim()) {
      resultsContainer.innerHTML = '<div class="no-results">Aucune application trouvée</div>'
    }
    return
  }

  filteredApps.forEach((app, index) => {
    const item = document.createElement('div')
    item.className = 'result-item' + (index === selectedIndex ? ' selected' : '')

    // Créer l'icône
    const icon = document.createElement('img')
    icon.className = 'result-icon'

    if (app.iconPath) {
      icon.src = 'file://' + app.iconPath
    } else {
      icon.src = getIconPath(app.icon)
    }

    icon.onerror = () => {
      icon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23555"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10">?</text></svg>'
    }

    // Créer les infos
    const info = document.createElement('div')
    info.className = 'result-info'

    const name = document.createElement('div')
    name.className = 'result-name'
    name.textContent = app.name

    const description = document.createElement('div')
    description.className = 'result-description'
    description.textContent = app.description || 'Aucune description'

    info.appendChild(name)
    info.appendChild(description)

    item.appendChild(icon)
    item.appendChild(info)

    // Click pour lancer
    item.addEventListener('click', () => {
      launchApp(app)
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

// Lancer une application
function launchApp(app) {
  if (app && app.exec) {
    window.electronAPI.launchApp(app.exec)
    searchInput.value = ''
    filteredApps = []
    displayResults()
  }
}

// Navigation au clavier
function selectItem(delta) {
  if (filteredApps.length === 0) return

  selectedIndex = (selectedIndex + delta + filteredApps.length) % filteredApps.length
  displayResults()

  // Scroller pour que l'élément sélectionné soit visible
  const selectedElement = resultsContainer.querySelector('.result-item.selected')
  if (selectedElement) {
    selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

// Événements
window.addEventListener('DOMContentLoaded', async () => {
  await loadApplications()
  searchInput.focus()
})

window.addEventListener('focus', () => {
  searchInput.focus()
  searchInput.select()
})

searchInput.addEventListener('input', () => {
  filterApps(searchInput.value)
  displayResults()
})

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    searchInput.value = ''
    filteredApps = []
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
    if (filteredApps.length > 0 && selectedIndex >= 0) {
      launchApp(filteredApps[selectedIndex])
    }
  }
})