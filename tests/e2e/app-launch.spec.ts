/**
 * Lancement, diagnostics, posture de sécurité et mesures de performance.
 */

import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from './fixtures/electron.fixture'

const QA_DIR = path.resolve('test-results/qa')
const SCREENSHOTS = path.resolve('test-results/screenshots')

test.beforeAll(() => {
  fs.mkdirSync(QA_DIR, { recursive: true })
  fs.mkdirSync(SCREENSHOTS, { recursive: true })
})

test("l'application démarre, s'identifie et affiche sa fenêtre", async ({
  electronApp,
  mainWindow,
  pageErrors
}) => {
  const diagnostics = await electronApp.evaluate(({ app, BrowserWindow }) => ({
    name: app.getName(),
    version: app.getVersion(),
    locale: app.getLocale(),
    ready: app.isReady(),
    versions: process.versions,
    platform: process.platform,
    architecture: process.arch,
    windowCount: BrowserWindow.getAllWindows().length
  }))

  fs.writeFileSync(path.join(QA_DIR, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2))

  expect(diagnostics.name).toBe('finder')
  expect(diagnostics.version).toBe('1.1.0')
  expect(diagnostics.ready).toBe(true)
  expect(diagnostics.windowCount).toBe(1)

  await test.step("document rendu, pas d'écran blanc", async () => {
    await expect(mainWindow.locator('body')).toBeVisible()
    expect(await mainWindow.title()).toBe('Finder')
    expect(mainWindow.url()).toBe('finder-app://renderer/index.html')

    const hasContent = await mainWindow.evaluate(
      () => document.querySelector('.search-box') !== null
    )
    expect(hasContent).toBe(true)

    await mainWindow.screenshot({
      path: path.join(SCREENSHOTS, '01-launch-initial-600x500.png')
    })
  })

  await test.step('focus initial sur le champ de recherche', async () => {
    const activeId = await mainWindow.evaluate(() => document.activeElement?.id ?? '')
    expect(activeId).toBe('searchInput')
  })

  expect(pageErrors).toEqual([])
})

test('la fenêtre naît cachée, comportement Spotlight assumé', async ({ electronApp }) => {
  // Sans intervention de la fixture, la fenêtre doit rester invisible :
  // l'application vit en arrière-plan derrière son raccourci global.
  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  const state = await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    return {
      visible: win?.isVisible() ?? null,
      skipTaskbar: true,
      alwaysOnTop: win?.isAlwaysOnTop() ?? null,
      resizable: win?.isResizable() ?? null
    }
  })

  expect(state.visible).toBe(false)
  expect(state.alwaysOnTop).toBe(true)
  expect(state.resizable).toBe(false)
})

test('posture de sécurité du renderer', async ({ mainWindow, electronApp }) => {
  await test.step('aucune API Node exposée', async () => {
    const exposure = await mainWindow.evaluate(() => ({
      requirePresent: 'require' in window,
      processPresent: 'process' in window,
      bufferPresent: 'Buffer' in window,
      ipcRendererPresent: 'ipcRenderer' in window
    }))

    expect(exposure.requirePresent).toBe(false)
    expect(exposure.processPresent).toBe(false)
    expect(exposure.bufferPresent).toBe(false)
    expect(exposure.ipcRendererPresent).toBe(false)
  })

  await test.step('surface electronAPI minimale et typée', async () => {
    const api = await mainWindow.evaluate(() => {
      const bridge = window.electronAPI
      return {
        keys: Object.keys(bridge).sort(),
        allFunctions: Object.values(bridge).every((value) => typeof value === 'function')
      }
    })

    expect(api.keys).toEqual([
      'eraseLocalData',
      'executeCommand',
      'executeSettingAction',
      'getApplications',
      'getFiles',
      'getSettingState',
      'hideWindow',
      'launchApp',
      'openFile',
      'openLocation',
      'refreshIndex',
      'searchSettings',
      'searchWeb'
    ])
    expect(api.allFunctions).toBe(true)
  })

  await test.step('CSP présente et restrictive', async () => {
    const csp = await mainWindow.evaluate(
      () =>
        document
          .querySelector('meta[http-equiv="Content-Security-Policy"]')
          ?.getAttribute('content') ?? ''
    )
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("connect-src 'none'")
    expect(csp).not.toContain('unsafe-inline')
    expect(csp).not.toContain('unsafe-eval')
  })

  await test.step('DevTools fermés', async () => {
    const devToolsOpened = await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.isDevToolsOpened()
    )
    expect(devToolsOpened).toBe(false)
  })
})

test('performance : démarrage, mémoire et cycle affichage/masquage', async ({
  electronApp,
  mainWindow
}) => {
  const startup = await electronApp.evaluate(({ app }) => ({
    // uptime mesuré au moment où le test s'exécute : borne haute du temps
    // de démarrage réel (lancement + ready + chargement du renderer).
    uptimeSeconds: process.uptime(),
    readyAfterMs: app.isReady() ? null : -1
  }))

  const metricsBefore = await electronApp.evaluate(({ app }) =>
    app.getAppMetrics().map((m) => ({
      type: m.type,
      memoryKb: m.memory.workingSetSize,
      cpu: m.cpu.percentCPUUsage
    }))
  )

  // Dix cycles affichage/masquage : détecte un effondrement ou une
  // croissance mémoire manifeste, sans conclure à une fuite sans preuve.
  for (let i = 0; i < 10; i++) {
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      win?.hide()
      win?.show()
    })
  }
  await mainWindow.waitForTimeout(1500)

  const metricsAfter = await electronApp.evaluate(({ app }) =>
    app.getAppMetrics().map((m) => ({
      type: m.type,
      memoryKb: m.memory.workingSetSize,
      cpu: m.cpu.percentCPUUsage
    }))
  )

  const totalBefore = metricsBefore.reduce((sum, m) => sum + m.memoryKb, 0)
  const totalAfter = metricsAfter.reduce((sum, m) => sum + m.memoryKb, 0)

  fs.writeFileSync(
    path.join('test-results/qa', 'perf.json'),
    JSON.stringify(
      {
        startupUptimeSeconds: startup.uptimeSeconds,
        memoryBeforeKb: totalBefore,
        memoryAfterTenToggleKb: totalAfter,
        processes: metricsAfter
      },
      null,
      2
    )
  )

  const windowStillAlive = await electronApp.evaluate(({ BrowserWindow }) =>
    Boolean(BrowserWindow.getAllWindows()[0]?.isVisible())
  )
  expect(windowStillAlive).toBe(true)

  // Garde-fou large : plus de 3× la mémoire initiale après dix cycles
  // signalerait un problème réel, pas du bruit de mesure.
  expect(totalAfter).toBeLessThan(totalBefore * 3)
})
