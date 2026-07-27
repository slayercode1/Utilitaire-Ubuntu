const repository = 'slayercode1/Utilitaire-Ubuntu'
const releasesUrl = `https://github.com/${repository}/releases/latest`

document.documentElement.classList.add('reveal-ready')

const menuButton = document.querySelector('[data-menu-button]')
const menu = document.querySelector('[data-menu]')
const header = document.querySelector('[data-header]')

function closeMenu() {
  if (!menuButton || !menu) return
  menuButton.setAttribute('aria-expanded', 'false')
  menu.classList.remove('is-open')
  document.body.classList.remove('menu-open')
}

menuButton?.addEventListener('click', () => {
  const shouldOpen = menuButton.getAttribute('aria-expanded') !== 'true'
  menuButton.setAttribute('aria-expanded', String(shouldOpen))
  menu?.classList.toggle('is-open', shouldOpen)
  document.body.classList.toggle('menu-open', shouldOpen)
})

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMenu)
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

const demoCases = [
  { query: 'firefox', title: 'Firefox', meta: 'Application' },
  { query: '?rapport', title: 'rapport-projet.pdf', meta: 'Document · ~/Documents' },
  { query: '128 / 4', title: '32', meta: 'Résultat copié' },
  { query: '10 km to mi', title: '6.21371 mi', meta: 'Conversion' }
]

const queryNode = document.querySelector('[data-demo-query]')
const titleNode = document.querySelector('[data-demo-title]')
const metaNode = document.querySelector('[data-demo-meta]')

if (
  queryNode &&
  titleNode &&
  metaNode &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches
) {
  let demoIndex = 0
  window.setInterval(() => {
    demoIndex = (demoIndex + 1) % demoCases.length
    const nextCase = demoCases[demoIndex]
    queryNode.textContent = nextCase.query
    titleNode.textContent = nextCase.title
    metaNode.textContent = nextCase.meta
  }, 3200)
}
