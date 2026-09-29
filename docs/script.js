const repository = 'slayercode1/Utilitaire-Ubuntu'
const releasesUrl = `https://github.com/${repository}/releases/latest`

document.documentElement.classList.add('reveal-ready')

const menuButton = document.querySelector('[data-menu-button]')
const menu = document.querySelector('[data-menu]')
const header = document.querySelector('[data-header]')

const menuLabel = document.querySelector('[data-menu-label]')

function setMenuOpen(open) {
  if (!menuButton || !menu) return
  menuButton.setAttribute('aria-expanded', String(open))
  if (menuLabel) menuLabel.textContent = open ? 'Fermer le menu' : 'Ouvrir le menu'
  menu.classList.toggle('is-open', open)
  document.body.classList.toggle('menu-open', open)
}

function isMenuOpen() {
  return menuButton?.getAttribute('aria-expanded') === 'true'
}

menuButton?.addEventListener('click', () => {
  const shouldOpen = !isMenuOpen()
  setMenuOpen(shouldOpen)
  // À l'ouverture, le premier lien reçoit le focus pour enchaîner au clavier
  if (shouldOpen) menu?.querySelector('a')?.focus({ preventScroll: true })
})

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenuOpen(false))
})

// Échap ferme le menu et rend le focus au bouton qui l'a ouvert
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !isMenuOpen()) return
  setMenuOpen(false)
  menuButton?.focus()
})

// Passé au format desktop, la navigation redevient visible en ligne :
// un menu resté ouvert bloquerait le défilement de la page.
window.matchMedia('(min-width: 641px)').addEventListener('change', (event) => {
  if (event.matches) setMenuOpen(false)
})

window.addEventListener(
  'scroll',
  () => header?.classList.toggle('is-scrolled', window.scrollY > 16),
  { passive: true }
)

const revealElements = document.querySelectorAll('.reveal')
if (window.location.hash) {
  revealElements.forEach((element) => {
    element.classList.add('is-visible')
  })
} else if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -7%', threshold: 0.08 }
  )
  revealElements.forEach((element) => {
    revealObserver.observe(element)
  })
} else {
  revealElements.forEach((element) => {
    element.classList.add('is-visible')
  })
}

document.querySelectorAll('[data-year]').forEach((node) => {
  node.textContent = String(new Date().getFullYear())
})

async function resolveLatestRelease() {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!response.ok) return

    const release = await response.json()
    const assets = Array.isArray(release.assets) ? release.assets : []
    const deb = assets.find((asset) => asset.name.endsWith('.deb'))
    const appImage = assets.find((asset) => asset.name.endsWith('.AppImage'))

    document.querySelectorAll('[data-download="deb"]').forEach((link) => {
      link.href = deb?.browser_download_url ?? releasesUrl
    })
    document.querySelectorAll('[data-download="appimage"]').forEach((link) => {
      link.href = appImage?.browser_download_url ?? releasesUrl
    })

    if (typeof release.tag_name === 'string') {
      document.querySelectorAll('[data-release-label]').forEach((node) => {
        node.textContent = release.tag_name
      })
    }
  } catch {
    // The release page remains a reliable fallback when the API is unavailable.
  }
}

resolveLatestRelease()

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// === DÉMO MOTION DESIGN DU HERO ===
//
// Une boucle scénarisée rejoue les gestes réels de l'application : raccourci,
// frappe, résultats, Entrée. Sans JavaScript ou en mouvement réduit, le HTML
// livre la première scène figée ; la boucle ne démarre jamais.

const motionScenes = [
  {
    query: 'firef',
    count: '2 résultats',
    toast: 'Firefox s’ouvre',
    items: [
      { icon: 'F', title: 'Firefox', meta: 'Application' },
      { icon: 'N', title: 'Navigateur de fichiers', meta: 'Application' }
    ]
  },
  {
    query: '?rapport',
    count: '2 fichiers',
    toast: 'rapport-projet.pdf s’ouvre',
    items: [
      { icon: 'R', title: 'rapport-projet.pdf', meta: 'Document · ~/Documents' },
      { icon: 'R', title: 'rapport-2025.odt', meta: 'Document · ~/Bureau' }
    ]
  },
  {
    query: '23*7+12',
    count: 'Calculatrice',
    toast: 'Résultat copié',
    items: [{ icon: '=', title: '173', meta: 'Entrée pour copier' }]
  },
  {
    query: '10 km to mi',
    count: 'Conversion',
    toast: 'Conversion copiée',
    items: [{ icon: '⇄', title: '6,21 mi', meta: '10 kilomètres en miles' }]
  },
  {
    query: '>htop',
    count: 'Commande',
    toast: 'Commande lancée',
    items: [{ icon: '>', title: 'Exécuter htop', meta: 'Commande dans le terminal' }]
  }
]

const motionStage = document.querySelector('[data-motion-demo]')
const motionPalette = document.querySelector('[data-motion-palette]')
const motionHint = document.querySelector('[data-motion-hint]')
const motionQuery = document.querySelector('[data-motion-query]')
const motionResults = document.querySelector('[data-motion-results]')
const motionCount = document.querySelector('[data-motion-count]')
const motionToast = document.querySelector('[data-motion-toast]')

if (
  motionStage &&
  motionPalette &&
  motionHint &&
  motionQuery &&
  motionResults &&
  motionCount &&
  motionToast &&
  !prefersReducedMotion
) {
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

  let stageInView = true
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        stageInView = entries.some((entry) => entry.isIntersecting)
      },
      { threshold: 0.25 }
    ).observe(motionStage)
  }

  // La boucle se met en pause hors écran ou onglet masqué : rien à animer.
  async function untilStageVisible() {
    while (!stageInView || document.hidden) {
      await sleep(420)
    }
  }

  function renderMotionResults(items) {
    motionResults.replaceChildren()
    items.forEach((item, index) => {
      const row = document.createElement('li')
      row.className = index === 0 ? 'motion-row is-selected' : 'motion-row'

      const icon = document.createElement('span')
      icon.className = 'motion-row-icon'
      icon.textContent = item.icon

      const text = document.createElement('span')
      text.className = 'motion-row-text'
      const title = document.createElement('strong')
      title.textContent = item.title
      const meta = document.createElement('small')
      meta.textContent = item.meta
      text.append(title, meta)

      row.append(icon, text)
      motionResults.append(row)
      window.setTimeout(() => row.classList.add('is-in'), 50 + index * 110)
    })
  }

  function resetMotionScene() {
    motionQuery.textContent = ''
    motionCount.textContent = ''
    motionResults.replaceChildren()
    motionPalette.classList.remove('is-open', 'is-typing')
  }

  async function playMotionScene(scene) {
    motionHint.classList.add('is-visible')
    await sleep(1150)
    motionHint.classList.remove('is-visible')
    await sleep(240)

    motionPalette.classList.add('is-open')
    await sleep(520)

    motionPalette.classList.add('is-typing')
    for (const char of scene.query) {
      motionQuery.textContent += char
      await sleep(88)
    }
    await sleep(300)

    renderMotionResults(scene.items)
    motionCount.textContent = scene.count
    await sleep(1350)

    motionResults.querySelector('.is-selected')?.classList.add('is-activated')
    await sleep(380)

    motionPalette.classList.remove('is-open')
    motionToast.textContent = scene.toast
    motionToast.classList.add('is-visible')
    await sleep(1250)
    motionToast.classList.remove('is-visible')

    await sleep(420)
    resetMotionScene()
  }

  ;(async () => {
    resetMotionScene()
    await sleep(600)
    let sceneIndex = 0
    while (true) {
      await untilStageVisible()
      await playMotionScene(motionScenes[sceneIndex])
      sceneIndex = (sceneIndex + 1) % motionScenes.length
    }
  })()
}

const demoCases = [
  { query: 'firefox', title: 'Firefox', meta: 'Application' },
  { query: '?rapport', title: 'rapport-projet.pdf', meta: 'Document · ~/Documents' },
  { query: '128 / 4', title: '32', meta: 'Résultat copié' },
  { query: '10 km to mi', title: '6.21371 mi', meta: 'Conversion' }
]

const queryNode = document.querySelector('[data-demo-query]')
const titleNode = document.querySelector('[data-demo-title]')
const metaNode = document.querySelector('[data-demo-meta]')

if (queryNode && titleNode && metaNode && !prefersReducedMotion) {
  let demoIndex = 0
  window.setInterval(() => {
    demoIndex = (demoIndex + 1) % demoCases.length
    const nextCase = demoCases[demoIndex]
    queryNode.textContent = nextCase.query
    titleNode.textContent = nextCase.title
    metaNode.textContent = nextCase.meta
  }, 3200)
}
