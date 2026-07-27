/**
 * Tests du service d'exécution de commandes en terminal.
 *
 * Ces vérifications étaient impossibles tant que la logique vivait dans un
 * handler IPC : il aurait fallu lancer Electron pour l'atteindre.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  buildScriptContent,
  removeCommandScript,
  scheduleCleanup,
  writeCommandScript
} from '../../src/main/services/terminal-command.js'

/** Répertoire isolé, pour ne pas polluer /tmp pendant les tests. */
let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finder-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('buildScriptContent', () => {
  it('produit un script bash', () => {
    expect(buildScriptContent('ls')).toMatch(/^#!\/bin\/bash\n/)
  })

  it('insère la commande telle quelle', () => {
    expect(buildScriptContent('ls -la /tmp')).toContain('ls -la /tmp')
  })

  it('maintient le terminal ouvert après exécution', () => {
    // Sans cette pause, la sortie de la commande serait illisible
    const contenu = buildScriptContent('echo test')
    expect(contenu).toContain('read')
    expect(contenu).toContain('Appuyez sur Entrée')
  })

  it('place la commande avant la pause', () => {
    const contenu = buildScriptContent('MA_COMMANDE')
    expect(contenu.indexOf('MA_COMMANDE')).toBeLessThan(contenu.indexOf('read'))
  })
})

describe('writeCommandScript', () => {
  it('crée un fichier contenant la commande', () => {
    const scriptPath = writeCommandScript('echo bonjour', { tmpDir })

    expect(fs.existsSync(scriptPath)).toBe(true)
    expect(fs.readFileSync(scriptPath, 'utf8')).toContain('echo bonjour')
  })

  it('restreint les droits au seul propriétaire', () => {
    const scriptPath = writeCommandScript('echo test', { tmpDir })
    const mode = fs.statSync(scriptPath).mode & 0o777

    // 0o700 : ni le groupe ni les autres ne peuvent lire la commande
    expect(mode).toBe(0o700)
  })

  it('génère un nom différent à chaque appel', () => {
    const a = writeCommandScript('echo 1', { tmpDir })
    const b = writeCommandScript('echo 2', { tmpDir })

    expect(a).not.toBe(b)
  })

  it('préfixe le fichier pour le rendre identifiable', () => {
    const scriptPath = writeCommandScript('echo test', { tmpDir })

    expect(path.basename(scriptPath)).toMatch(/^finder-cmd-[0-9a-f]{16}\.sh$/)
  })

  it('écrit dans le répertoire demandé', () => {
    const scriptPath = writeCommandScript('echo test', { tmpDir })

    expect(path.dirname(scriptPath)).toBe(tmpDir)
  })
})

describe('removeCommandScript', () => {
  it('supprime le script', () => {
    const scriptPath = writeCommandScript('echo test', { tmpDir })
    removeCommandScript(scriptPath)

    expect(fs.existsSync(scriptPath)).toBe(false)
  })

  it('ne lève pas si le fichier a déjà disparu', () => {
    const scriptPath = writeCommandScript('echo test', { tmpDir })
    removeCommandScript(scriptPath)

    expect(() => removeCommandScript(scriptPath)).not.toThrow()
  })
})

describe('scheduleCleanup', () => {
  it('supprime le script au terme du délai', async () => {
    const scriptPath = writeCommandScript('echo test', { tmpDir })

    scheduleCleanup(scriptPath, 10)
    expect(fs.existsSync(scriptPath)).toBe(true)

    await new Promise((r) => setTimeout(r, 40))
    expect(fs.existsSync(scriptPath)).toBe(false)
  })

  it('ne retient pas le processus en vie', () => {
    const scriptPath = writeCommandScript('echo test', { tmpDir })
    const timer = scheduleCleanup(scriptPath, 60000)

    // unref() permet à l'application de se fermer sans attendre le minuteur
    expect(timer.hasRef()).toBe(false)
    clearTimeout(timer)
  })
})
