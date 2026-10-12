import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, type Page, test } from '@playwright/test'

/**
 * Parcours du site vitrine (docs/) : responsive, clavier, menu mobile,
 * téléchargement et carrousel. Le site est servi en fichier local ; l'API
 * GitHub et les téléchargements sont simulés pour rester hors réseau.
 */

const docsDir = path.resolve(__dirname, '../../docs')
const siteUrl = pathToFileURL(path.join(docsDir, 'index.html')).href
const linuxUserAgent =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const fakeRelease = {
  tag_name: 'v9.9.9',
  assets: [
    {
      name: 'Finder_9.9.9_amd64.deb',
      browser_download_url:
        'https://github.com/slayercode1/Utilitaire-Ubuntu/releases/download/v9.9.9/Finder_9.9.9_amd64.deb'
    },
    {
      name: 'Finder-9.9.9.AppImage',
      browser_download_url:
        'https://github.com/slayercode1/Utilitaire-Ubuntu/releases/download/v9.9.9/Finder-9.9.9.AppImage'
    }
  ]
}

async function mockNetwork(page: Page, release: 'ok' | 'down' = 'ok') {
  await page.route('https://api.github.com/**', (route) =>
    release === 'ok'
      ? route.fulfill({ json: fakeRelease })
      : route.fulfill({ status: 503, body: '' })
  )
  // Un 204 annule la navigation : la page reste affichée après le clic
  await page.route('https://github.com/**', (route) => route.fulfill({ status: 204, body: '' }))
}

test.describe('Site vitrine', () => {
  test.use({ userAgent: linuxUserAgent })

  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [2560, 1440]
  ] as const) {
    test(`aucun défilement horizontal en ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await mockNetwork(page)
      await page.goto(siteUrl)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
      expect(overflow).toBe(0)
    })
  }

  test('le lien d’évitement place le focus sur le contenu', async ({ page }) => {
    await mockNetwork(page)
    await page.goto(siteUrl)
    await page.keyboard.press('Tab')
    await expect(page.locator('.skip-link')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeFocused()
  })

  test('un lien direct vers une section y arrive sans attendre', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockNetwork(page)
    await page.goto(`${siteUrl}#questions`)
    await page.waitForTimeout(150)
    await expect(page.locator('#faq-title')).toBeInViewport()
  })

  test.describe('menu mobile', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('garde le focus dans l’en-tête et se ferme au clavier', async ({ page }) => {
      await mockNetwork(page)
      await page.goto(siteUrl)
      const button = page.locator('[data-menu-button]')
      await button.click()
      await expect(button).toHaveAttribute('aria-expanded', 'true')
      await expect(page.locator('[data-menu] a').first()).toBeFocused()

      for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
      const focusInHeader = await page.evaluate(
        () => document.activeElement?.closest('.site-header') !== null
      )
      expect(focusInHeader).toBe(true)

      await page.keyboard.press('Escape')
      await expect(button).toHaveAttribute('aria-expanded', 'false')
      await expect(button).toBeFocused()
      await expect(page.locator('main')).not.toHaveAttribute('inert')
    })

    test('se ferme quand on touche le voile', async ({ page }) => {
      await mockNetwork(page)
      await page.goto(siteUrl)
      const button = page.locator('[data-menu-button]')
      await button.click()
      await page.mouse.click(195, 760)
      await expect(button).toHaveAttribute('aria-expanded', 'false')
    })
  })

  test.describe('téléchargement', () => {
    test('indique comment installer le .deb après le clic', async ({ page }) => {
      await mockNetwork(page)
      await page.goto(siteUrl)
      const download = page.locator('.hero [data-download="deb"]')
      await expect(download).toHaveAttribute('href', /Finder_9\.9\.9_amd64\.deb$/)
      await expect(page.locator('.hero-badge [data-release-label]')).toHaveText('v9.9.9')

      await download.click()
      const panel = page.locator('[data-download-panel]')
      await expect(panel).toBeVisible()
      await expect(panel.locator('[data-download-command]')).toHaveText(
        'sudo apt install ./Finder_9.9.9_amd64.deb'
      )

      await page.keyboard.press('Escape')
      await expect(panel).toBeHidden()
    })

    test('sans réponse de GitHub, renvoie vers la page des versions', async ({ page }) => {
      await mockNetwork(page, 'down')
      await page.goto(siteUrl)
      const download = page.locator('.hero [data-download="deb"]')
      await expect(download).toHaveAttribute('href', /\/releases\/latest$/)
      await expect(page.locator('.hero-badge [data-release-label]')).toHaveText('Dernière version')
    })

    test('ne prévient pas les visiteurs sous Linux', async ({ page }) => {
      await mockNetwork(page)
      await page.goto(siteUrl)
      await expect(page.locator('[data-platform-note]')).toBeHidden()
    })
  })

  test.describe('visiteur hors Linux', () => {
    test.use({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
    })

    test('est prévenu que Finder s’installe sous Linux', async ({ page }) => {
      await mockNetwork(page)
      await page.goto(siteUrl)
      await expect(page.locator('[data-platform-note]')).toBeVisible()
    })
  })

  test.describe('carrousel', () => {
    test('les flèches font avancer les tuiles sur mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await mockNetwork(page)
      await page.goto(siteUrl)
      const track = page.locator('[data-gallery]')
      const previous = page.locator('[data-gallery-prev]')
      await track.scrollIntoViewIfNeeded()
      await expect(previous).toBeDisabled()

      await page.locator('[data-gallery-next]').click()
      await expect
        .poll(() => track.evaluate((node) => node.scrollLeft), { timeout: 3000 })
        .toBeGreaterThan(200)
      await expect(previous).toBeEnabled()
    })

    test('avance avec le défilement de la page sur grand écran', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await mockNetwork(page)
      await page.goto(siteUrl)
      const pinTop = await page
        .locator('[data-gallery-pin]')
        .evaluate((node) => node.getBoundingClientRect().top + window.scrollY)
      await page.evaluate((top) => window.scrollTo(0, top + 600), pinTop)
      await expect
        .poll(() => page.locator('[data-gallery]').evaluate((node) => node.scrollLeft), {
          timeout: 3000
        })
        .toBeGreaterThan(300)
    })
  })

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('le contenu reste visible et les flèches inutilisables sont masquées', async ({
      page
    }) => {
      await page.goto(siteUrl)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('.faq-list details').first()).toBeVisible()
      await expect(page.locator('.gallery-controls')).toBeHidden()
    })
  })

  test('une API GitHub lente ne bloque pas la page', async ({ page }) => {
    await page.route('https://api.github.com/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      await route.fulfill({ json: fakeRelease })
    })
    await page.route('https://github.com/**', (route) => route.fulfill({ status: 204, body: '' }))
    await page.goto(siteUrl)
    const download = page.locator('.hero [data-download="deb"]')
    // En attendant la réponse, le bouton mène déjà quelque part d'utile
    await expect(download).toBeVisible()
    await expect(download).toHaveAttribute('href', /\/releases\/latest$/)
    await expect(download).toHaveAttribute('href', /\.deb$/, { timeout: 6000 })
  })

  test('sur mobile, la commande d’installation reste lisible en entier', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await mockNetwork(page)
    await page.goto(siteUrl)
    await page.locator('.hero [data-download="deb"]').click()
    const command = page.locator('[data-download-command]')
    await expect(command).toBeVisible()
    const clipped = await command.evaluate((node) => node.scrollWidth > node.clientWidth + 1)
    expect(clipped).toBe(false)
  })

  test('une adresse inconnue mène à une page 404 avec une sortie', async ({ page }) => {
    // Simule GitHub Pages : les fichiers existants sont servis, sinon 404.html
    const origin = 'https://slayercode1.github.io'
    await page.route(`${origin}/**`, async (route) => {
      const pathname = new URL(route.request().url()).pathname.replace('/Utilitaire-Ubuntu/', '')
      try {
        const body = await readFile(path.join(docsDir, pathname || 'index.html'))
        const type = pathname.endsWith('.css')
          ? 'text/css'
          : pathname.endsWith('.png')
            ? 'image/png'
            : 'text/html'
        await route.fulfill({ body, contentType: type })
      } catch {
        await route.fulfill({
          status: 404,
          body: await readFile(path.join(docsDir, '404.html')),
          contentType: 'text/html'
        })
      }
    })
    const response = await page.goto(`${origin}/Utilitaire-Ubuntu/ancienne/page`)
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()
    // La feuille de style est bien chargée malgré la profondeur de l'adresse
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(background).toBe('rgb(11, 12, 14)')
    await page.getByRole('link', { name: 'Retour à l’accueil' }).click()
    await expect(page).toHaveURL(`${origin}/Utilitaire-Ubuntu/`)
  })

  for (const [label, heading] of [
    ['Mentions légales', 'Mentions légales'],
    ['Confidentialité', 'Confidentialité']
  ] as const) {
    test(`la page « ${label} » est accessible depuis le pied de page`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 })
      await mockNetwork(page)
      await page.goto(siteUrl)
      await page.locator('.footer-legal').getByRole('link', { name: label }).click()
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
      expect(overflow).toBe(0)
      // En file://, « ./ » ouvre le dossier ; GitHub Pages y sert l'accueil
      await expect(page.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
        'href',
        './'
      )
    })
  }

  test.describe('partage sur les réseaux sociaux', () => {
    const publicPages = ['index.html', 'confidentialite.html', 'mentions-legales.html']
    const required = [
      'og:title',
      'og:description',
      'og:url',
      'og:image',
      'og:image:width',
      'og:image:height',
      'og:image:alt',
      'twitter:card',
      'twitter:title',
      'twitter:description',
      'twitter:image',
      'twitter:image:alt'
    ]
    const siteBase = 'https://slayercode1.github.io/Utilitaire-Ubuntu/'

    for (const pageFile of publicPages) {
      test(`${pageFile} expose une carte de partage complète`, async () => {
        const html = await readFile(path.join(docsDir, pageFile), 'utf8')
        const meta = new Map<string, string>()
        for (const match of html.matchAll(
          /<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g
        )) {
          meta.set(match[1] ?? '', match[2] ?? '')
        }

        for (const key of required) expect(meta.get(key), key).toBeTruthy()
        expect(meta.get('twitter:card')).toBe('summary_large_image')

        // L'URL partagée doit être l'URL canonique de la page
        const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]
        expect(meta.get('og:url')).toBe(canonical)

        // L'image annoncée existe, au format 1200 × 630 et assez légère pour WhatsApp
        const imageUrl = meta.get('og:image') ?? ''
        expect(imageUrl.startsWith(siteBase)).toBe(true)
        const image = await readFile(path.join(docsDir, imageUrl.slice(siteBase.length)))
        expect(image.byteLength).toBeLessThan(300 * 1024)
        expect(image.readUInt32BE(16)).toBe(1200)
        expect(image.readUInt32BE(20)).toBe(630)
        expect(meta.get('og:image:width')).toBe('1200')
        expect(meta.get('og:image:height')).toBe('630')
      })
    }
  })
})
