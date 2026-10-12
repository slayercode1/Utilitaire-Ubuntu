const repository = 'slayercode1/Utilitaire-Ubuntu'
const releasesUrl = `https://github.com/${repository}/releases/latest`

document.documentElement.classList.add('reveal-ready')

// Un lien direct vers une section (…/#questions) y arrive immédiatement ;
// le défilement doux ne s'active qu'ensuite, pour les clics dans la page.
window.addEventListener('load', () => {
  window.setTimeout(() => document.documentElement.classList.add('smooth-scroll'), 0)
})

// Les blocs marqués data-stagger apparaissent élément par élément, en
// cascade : chaque enfant devient un .reveal avec un léger décalage.
document.querySelectorAll('[data-stagger]').forEach((group) => {
  ;[...group.children].forEach((child, index) => {
    child.classList.add('reveal')
    child.style.setProperty('--reveal-delay', `${index * 90}ms`)
  })
})

const menuButton = document.querySelector('[data-menu-button]')
const menu = document.querySelector('[data-menu]')
const header = document.querySelector('[data-header]')

const menuLabel = document.querySelector('[data-menu-label]')

// Pendant que le menu est ouvert, la page derrière le voile devient inerte :
// la tabulation reste dans l'en-tête et un lecteur d'écran ne lit plus
// le contenu masqué.
const pageRegions = document.querySelectorAll('main, .site-footer, .skip-link')

function setMenuOpen(open) {
  if (!menuButton || !menu) return
  menuButton.setAttribute('aria-expanded', String(open))
  if (menuLabel) menuLabel.textContent = open ? 'Fermer le menu' : 'Ouvrir le menu'
  menu.classList.toggle('is-open', open)
  document.body.classList.toggle('menu-open', open)
  pageRegions.forEach((region) => {
    region.inert = open
  })
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

// Un appui sur le voile, hors de l'îlot, ferme le menu comme on s'y attend
document.addEventListener('click', (event) => {
  if (!isMenuOpen() || event.target.closest('.nav-shell')) return
  setMenuOpen(false)
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

const releaseCacheKey = 'finder-latest-release'

// L'API GitHub limite les visiteurs anonymes à 60 requêtes par heure : la
// réponse est gardée pour la session, la navigation reste instantanée.
async function fetchLatestRelease() {
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(releaseCacheKey) ?? 'null')
    if (cached && Date.now() - cached.savedAt < 60 * 60 * 1000) return cached.release
  } catch {
    // Stockage indisponible (navigation privée) : on interroge l'API.
  }
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!response.ok) return null
  const release = await response.json()
  try {
    // Seuls la version et les liens des fichiers servent : inutile de garder le reste
    const essentials = {
      tag_name: release.tag_name,
      assets: (Array.isArray(release.assets) ? release.assets : []).map((asset) => ({
        name: asset.name,
        browser_download_url: asset.browser_download_url
      }))
    }
    window.sessionStorage.setItem(
      releaseCacheKey,
      JSON.stringify({ savedAt: Date.now(), release: essentials })
    )
  } catch {
    // Le cache est un confort, son absence ne change rien au téléchargement.
  }
  return release
}

async function resolveLatestRelease() {
  try {
    const release = await fetchLatestRelease()
    if (!release) return
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

// === TÉLÉCHARGEMENT : PLATEFORME ET ÉTAPE SUIVANTE ===

// Finder ne s'installe que sous Linux : depuis Windows, macOS ou un téléphone,
// on prévient avant le clic plutôt qu'après un fichier inutilisable.
const userAgent = window.navigator.userAgent
const isLinuxDesktop = /Linux|X11|CrOS/.test(userAgent) && !/Android/.test(userAgent)
const platformNote = document.querySelector('[data-platform-note]')
if (platformNote && !isLinuxDesktop) platformNote.hidden = false

// Après un clic sur un téléchargement direct, un panneau indique l'étape
// suivante : comment installer le fichier. Il reste affiché jusqu'à ce que
// la personne le ferme, une instruction ne doit pas disparaître seule.
const downloadPanel = document.querySelector('[data-download-panel]')
const downloadSteps = downloadPanel?.querySelector('[data-download-steps]')
const downloadCommand = downloadPanel?.querySelector('[data-download-command]')
const downloadCopy = downloadPanel?.querySelector('[data-download-copy]')

function showDownloadPanel(fileName) {
  if (!downloadPanel || !downloadSteps || !downloadCommand) return
  const isDeb = fileName.endsWith('.deb')
  downloadSteps.textContent = isDeb
    ? 'Une fois le fichier téléchargé, ouvrez-le pour l’installer, ou lancez dans un terminal :'
    : 'Une fois le fichier téléchargé, rendez-le exécutable puis lancez-le :'
  downloadCommand.textContent = isDeb
    ? `sudo apt install ./${fileName}`
    : `chmod +x ${fileName} && ./${fileName}`
  if (downloadCopy) downloadCopy.textContent = 'Copier'
  downloadPanel.hidden = false
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-download]')
  if (!link) return
  // Tant que la version n'est pas connue, le lien mène à la page des versions :
  // la navigation suffit, pas de panneau.
  const fileName = decodeURIComponent(link.pathname.split('/').pop() ?? '')
  if (/\.(deb|AppImage)$/.test(fileName)) showDownloadPanel(fileName)
})

downloadPanel?.querySelector('[data-download-close]')?.addEventListener('click', () => {
  downloadPanel.hidden = true
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && downloadPanel && !downloadPanel.hidden && !isMenuOpen()) {
    downloadPanel.hidden = true
  }
})

downloadCopy?.addEventListener('click', async () => {
  try {
    await window.navigator.clipboard.writeText(downloadCommand?.textContent ?? '')
    downloadCopy.textContent = 'Copié'
  } catch {
    // Presse-papiers refusé : on sélectionne la commande pour une copie manuelle
    const range = document.createRange()
    range.selectNodeContents(downloadCommand)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    downloadCopy.textContent = 'Sélectionnée, copiez avec Ctrl+C'
  }
})

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

// Sur iOS, :active ne s'applique qu'avec un écouteur tactile : le retour
// visuel doit partir dès l'appui, pas au relâchement.
document.addEventListener('touchstart', () => {}, { passive: true })

// === CARROUSEL DE FONCTIONNALITÉS ===
//
// Le défilement natif (doigt, pavé tactile) reste la base. Les flèches et le
// glisser à la souris passent par un ressort critique (sans rebond) qui part
// toujours de la position affichée : une nouvelle action interrompt et
// reprend le mouvement en cours, vitesse comprise, sans à-coup.

const galleryTrack = document.querySelector('[data-gallery]')
const galleryList = galleryTrack?.querySelector('ul')
const galleryPrev = document.querySelector('[data-gallery-prev]')
const galleryNext = document.querySelector('[data-gallery-next]')

// Ressort amorti critique, paramétré comme chez Apple par sa « réponse »
// (en secondes) plutôt que par masse et raideur.
function springTo({ from, to, velocity = 0, response = 0.4, onUpdate, onDone }) {
  const omega = (2 * Math.PI) / response
  let position = from
  let speed = velocity
  let last = performance.now()
  let frame = window.requestAnimationFrame(function step(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    speed += (-omega * omega * (position - to) - 2 * omega * speed) * dt
    position += speed * dt
    if (Math.abs(position - to) < 0.5 && Math.abs(speed) < 5) {
      onUpdate(to)
      frame = 0
      onDone?.()
      return
    }
    onUpdate(position)
    frame = window.requestAnimationFrame(step)
  })
  return {
    stop: () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      return speed
    }
  }
}

// Projection de l'élan au relâchement (formule de « Designing Fluid
// Interfaces ») : on vise l'endroit où le geste emmenait le contenu.
const projectMomentum = (velocity, decelerationRate = 0.998) =>
  ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)

// Au-delà des bords, la résistance croît au lieu de bloquer net.
const rubberband = (overshoot, dimension, constant = 0.55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))

if (galleryTrack && galleryList && galleryPrev && galleryNext) {
  // Sans JavaScript, la piste défile au doigt ou au pavé : les flèches restent masquées
  galleryPrev.closest('.gallery-controls')?.removeAttribute('hidden')

  let scrollSpring = null
  let scrollTarget = null
  let bandSpring = null

  const maxScroll = () => galleryTrack.scrollWidth - galleryTrack.clientWidth

  const snapPoints = () => {
    const inset = Number.parseFloat(getComputedStyle(galleryList).paddingLeft) || 0
    const trackLeft = galleryTrack.getBoundingClientRect().left
    const max = maxScroll()
    return [...galleryList.children].map((tile) => {
      const point = tile.getBoundingClientRect().left - trackLeft + galleryTrack.scrollLeft - inset
      return Math.min(Math.max(point, 0), max)
    })
  }

  const nearestIndex = (points, value) =>
    points.reduce(
      (best, point, index) =>
        Math.abs(point - value) < Math.abs(points[best] - value) ? index : best,
      0
    )

  const updateGalleryButtons = () => {
    const target = scrollTarget ?? galleryTrack.scrollLeft
    galleryPrev.disabled = target <= 4
    galleryNext.disabled = target >= maxScroll() - 4
  }

  // Interrompt le ressort en cours et rend sa vitesse, pour la transmettre
  // au mouvement suivant.
  const stopScrollSpring = () => {
    const speed = scrollSpring ? scrollSpring.stop() : 0
    scrollSpring = null
    return speed
  }

  const releaseSnap = () => {
    galleryTrack.style.scrollSnapType = ''
    scrollTarget = null
    updateGalleryButtons()
  }

  const scrollToPoint = (target, velocity = 0) => {
    scrollTarget = target
    updateGalleryButtons()
    if (prefersReducedMotion) {
      galleryTrack.scrollLeft = target
      releaseSnap()
      return
    }
    // L'aimantation native se battrait avec le ressort : coupée le temps du mouvement
    galleryTrack.style.scrollSnapType = 'none'
    scrollSpring = springTo({
      from: galleryTrack.scrollLeft,
      to: target,
      velocity,
      onUpdate: (value) => {
        galleryTrack.scrollLeft = value
      },
      onDone: () => {
        scrollSpring = null
        releaseSnap()
      }
    })
  }

  const step = (direction) => {
    const velocity = stopScrollSpring()
    const points = snapPoints()
    const from = scrollTarget ?? galleryTrack.scrollLeft
    const index = Math.min(Math.max(nearestIndex(points, from) + direction, 0), points.length - 1)
    // Carrousel épinglé : c'est le défilement de la page qui le fait avancer
    if (isGalleryPinned()) {
      scrollPinTo(points[index])
      return
    }
    scrollToPoint(points[index], velocity)
  }

  galleryPrev.addEventListener('click', () => step(-1))
  galleryNext.addEventListener('click', () => step(1))
  galleryTrack.addEventListener('scroll', () => scrollTarget === null && updateGalleryButtons(), {
    passive: true
  })
  window.addEventListener('resize', updateGalleryButtons)
  updateGalleryButtons()

  // --- Glisser à la souris : suivi 1:1, élan projeté, bords élastiques ---
  let drag = null

  const setBand = (offset) => {
    galleryList.style.transform = offset ? `translateX(${offset}px)` : ''
  }

  galleryTrack.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || isGalleryPinned()) return
    // Attraper le carrousel en mouvement l'arrête là où il est affiché
    stopScrollSpring()
    bandSpring?.stop()
    bandSpring = null
    scrollTarget = null
    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startScroll: galleryTrack.scrollLeft,
      band: 0,
      active: false,
      history: [{ x: event.clientX, t: event.timeStamp }]
    }
  })

  galleryTrack.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return
    const dx = event.clientX - drag.startX
    // Petit seuil avant de s'engager, pour ne pas confondre avec un clic
    if (!drag.active) {
      if (Math.abs(dx) < 6) return
      drag.active = true
      galleryTrack.setPointerCapture(event.pointerId)
      galleryTrack.style.scrollSnapType = 'none'
      galleryTrack.classList.add('is-dragging')
    }
    drag.history.push({ x: event.clientX, t: event.timeStamp })
    if (drag.history.length > 5) drag.history.shift()

    const max = maxScroll()
    const wanted = drag.startScroll - dx
    const clamped = Math.min(Math.max(wanted, 0), max)
    galleryTrack.scrollLeft = clamped
    drag.band = rubberband(clamped - wanted, galleryTrack.clientWidth)
    setBand(drag.band)
  })

  const endDrag = (event) => {
    if (!drag || event.pointerId !== drag.id) return
    const { active, history, band } = drag
    drag = null
    if (!active) return
    galleryTrack.classList.remove('is-dragging')

    // Vitesse du pointeur sur les derniers événements, convertie en vitesse de défilement
    const first = history[0]
    const lastPoint = history[history.length - 1]
    const elapsed = Math.max(lastPoint.t - first.t, 1)
    const velocity = -((lastPoint.x - first.x) / elapsed) * 1000

    if (band) {
      bandSpring = springTo({
        from: band,
        to: 0,
        onUpdate: setBand,
        onDone: () => {
          bandSpring = null
        }
      })
    }

    const points = snapPoints()
    const projected = galleryTrack.scrollLeft + projectMomentum(velocity)
    scrollToPoint(points[nearestIndex(points, projected)], band ? 0 : velocity)
  }

  galleryTrack.addEventListener('pointerup', endDrag)
  galleryTrack.addEventListener('pointercancel', endDrag)
}

// === ANIMATIONS LIÉES AU DÉFILEMENT ===
//
// Tout suit la position de défilement image par image : on peut remonter,
// s'arrêter, repartir, l'animation reste collée au geste. En mouvement
// réduit, rien ne bouge : le contenu s'affiche directement dans son état final.

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const scrollScenes = []
let scrollFrame = 0

function runScrollScenes() {
  scrollFrame = 0
  let needsAnotherFrame = false
  for (const scene of scrollScenes) {
    if (scene() === true) needsAnotherFrame = true
  }
  if (needsAnotherFrame) scrollFrame = window.requestAnimationFrame(runScrollScenes)
}

function requestScrollScenes() {
  if (!scrollFrame) scrollFrame = window.requestAnimationFrame(runScrollScenes)
}

if (!prefersReducedMotion) {
  window.addEventListener('scroll', requestScrollScenes, { passive: true })
  window.addEventListener('resize', requestScrollScenes)
}

// --- Promesse : les mots s'allument au fil de la lecture ---
const scrollWordsNode = document.querySelector('[data-scroll-words]')
if (scrollWordsNode && !prefersReducedMotion) {
  const wordNodes = []
  // Découpe chaque nœud texte en mots, en conservant les éléments (le <span> atténué)
  const splitWords = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment()
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue
          if (/^\s+$/.test(part)) {
            fragment.append(part)
            continue
          }
          const word = document.createElement('span')
          word.className = 'word'
          word.textContent = part
          wordNodes.push(word)
          fragment.append(word)
        }
        child.replaceWith(fragment)
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        splitWords(child)
      }
    }
  }
  splitWords(scrollWordsNode)
  scrollWordsNode.classList.add('is-scroll-lit')

  scrollScenes.push(() => {
    const rect = scrollWordsNode.getBoundingClientRect()
    const progress = clamp01(
      (window.innerHeight * 0.85 - rect.top) / (rect.height + window.innerHeight * 0.35)
    )
    const litCount = Math.round(progress * wordNodes.length)
    wordNodes.forEach((node, index) => {
      node.classList.toggle('is-lit', index < litCount)
    })
  })
}

// --- Carrousel épinglé : le défilement vertical le fait avancer ---
//
// Sur grand écran, la section reste fixée le temps de faire défiler toutes
// les tuiles. Sur mobile, le carrousel garde son défilement au doigt.
const galleryPin = document.querySelector('[data-gallery-pin]')
const pinQuery = window.matchMedia('(min-width: 901px) and (min-height: 640px)')

if (galleryPin && galleryTrack && galleryList && !prefersReducedMotion) {
  let shownScroll = 0

  const pinDistance = () => galleryTrack.scrollWidth - galleryTrack.clientWidth

  const layoutPin = () => {
    const pinned = pinQuery.matches
    galleryPin.classList.toggle('is-pinned', pinned)
    galleryPin.style.setProperty('--pin-distance', pinned ? `${pinDistance()}px` : '0px')
    requestScrollScenes()
  }

  scrollScenes.push(() => {
    if (!galleryPin.classList.contains('is-pinned')) return false
    const rect = galleryPin.getBoundingClientRect()
    const travel = rect.height - window.innerHeight
    const progress = travel > 0 ? clamp01(-rect.top / travel) : 0
    const target = progress * pinDistance()
    // Suivi amorti : la molette avance par crans, le carrousel glisse
    shownScroll += (target - shownScroll) * 0.2
    if (Math.abs(target - shownScroll) < 0.5) shownScroll = target
    galleryTrack.scrollLeft = shownScroll

    // Les tuiles grandissent en entrant par la droite
    const viewport = window.innerWidth
    for (const tile of galleryList.children) {
      const tileRect = tile.getBoundingClientRect()
      const enter = clamp01((viewport - tileRect.left) / (tileRect.width * 0.9))
      const media = tile.firstElementChild
      media.style.transform = `scale(${0.88 + enter * 0.12})`
      media.style.opacity = String(0.35 + enter * 0.65)
    }
    galleryTrack.dispatchEvent(new Event('scroll'))
    return shownScroll !== target
  })

  pinQuery.addEventListener('change', layoutPin)
  window.addEventListener('resize', layoutPin)
  layoutPin()
}

requestScrollScenes()

function isGalleryPinned() {
  return Boolean(galleryPin?.classList.contains('is-pinned'))
}

// Fait défiler la page jusqu'à la position verticale qui amène la tuile voulue
function scrollPinTo(target) {
  const rect = galleryPin.getBoundingClientRect()
  const travel = rect.height - window.innerHeight
  const distance = galleryTrack.scrollWidth - galleryTrack.clientWidth
  const ratio = distance ? target / distance : 0
  window.scrollTo({ top: window.scrollY + rect.top + ratio * travel, behavior: 'smooth' })
}

// === HERO : FAISCEAUX DE LIGNES (à la Mintlify) ===
//
// Deux éventails de courbes s'appuient sur la démo : l'un monte du coin bas
// gauche jusqu'à son bord gauche, l'autre part de son bord haut vers le coin
// haut droit. Les courbes sont recalculées sur la position réelle de la démo,
// se dessinent une fois au chargement, puis restent immobiles.

const heroWaves = document.querySelector('[data-hero-waves]')
const heroSection = heroWaves?.closest('.hero')
const heroStage = heroSection?.querySelector('.product-stage')

if (heroWaves && heroSection && heroStage) {
  const svgNs = 'http://www.w3.org/2000/svg'
  const count = 34
  const lowerPaths = []
  const upperPaths = []

  const gradient = document.createElementNS(svgNs, 'linearGradient')
  gradient.id = 'hero-wave-gradient'
  gradient.setAttribute('gradientUnits', 'userSpaceOnUse')
  for (const [offset, color, opacity] of [
    ['0', '#5b8cff', '0'],
    ['0.25', '#5b8cff', '0.6'],
    ['0.55', '#a37bff', '0.7'],
    ['0.85', '#5ee1ff', '0.55'],
    ['1', '#5ee1ff', '0']
  ]) {
    const stop = document.createElementNS(svgNs, 'stop')
    stop.setAttribute('offset', offset)
    stop.setAttribute('stop-color', color)
    stop.setAttribute('stop-opacity', opacity)
    gradient.append(stop)
  }
  const defs = document.createElementNS(svgNs, 'defs')
  defs.append(gradient)
  heroWaves.append(defs)

  for (let i = 0; i < count * 2; i++) {
    const path = document.createElementNS(svgNs, 'path')
    path.setAttribute('pathLength', '1')
    path.setAttribute('stroke', 'url(#hero-wave-gradient)')
    path.style.setProperty('--i', String(i % count))
    heroWaves.append(path)
    ;(i < count ? lowerPaths : upperPaths).push(path)
  }

  const drawWaves = () => {
    const heroRect = heroSection.getBoundingClientRect()
    const stageRect = heroStage.getBoundingClientRect()
    const width = heroRect.width
    const height = heroRect.height
    const left = stageRect.left - heroRect.left
    const top = stageRect.top - heroRect.top
    const stageWidth = Math.min(stageRect.width, width - left)
    const stageBottom = Math.min(stageRect.bottom - heroRect.top, height)

    heroWaves.setAttribute('viewBox', `0 0 ${width} ${height}`)
    gradient.setAttribute('x1', '0')
    gradient.setAttribute('y1', String(height))
    gradient.setAttribute('x2', String(width))
    gradient.setAttribute('y2', '0')

    lowerPaths.forEach((path, i) => {
      const t = i / (count - 1)
      // Départ sous le texte : les lignes ne passent jamais derrière les boutons
      const startY = height * 0.74 + t * height * 0.32
      const endY = top + 170 + t * (stageBottom - top - 210)
      path.setAttribute(
        'd',
        `M -40 ${startY} C ${left * 0.35} ${startY - 30 - t * 40}, ${left * 0.72} ${endY + 90 - t * 70}, ${left + 12} ${endY}`
      )
    })

    upperPaths.forEach((path, i) => {
      const t = i / (count - 1)
      const startX = left + stageWidth * 0.12 + t * stageWidth * 0.5
      const endY = height * 0.04 + t * top * 0.75
      path.setAttribute(
        'd',
        `M ${startX} ${top + 4} C ${startX + 140} ${top - 110 - t * 50}, ${width - 260 + t * 90} ${endY + 70}, ${width + 40} ${endY}`
      )
    })
  }

  drawWaves()
  window.addEventListener('resize', drawWaves)
}
