/**
 * Tests de la minimisation des données locales.
 *
 * Ces fonctions retirent des fichiers du répertoire utilisateur : elles sont
 * vérifiées sur un répertoire temporaire, jamais sur des données réelles.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Répertoire jouant le rôle de `userData` pendant les tests. */
let userData: string

// `app.getPath('userData')` n'existe pas hors d'Electron : on le simule pour
// que les fonctions opèrent sur un répertoire jetable.
vi.mock('electron', () => ({
  app: {
    getPath: (nom: string): string => {
      if (nom !== 'userData') throw new Error(`chemin inattendu : ${nom}`)
      return userData
    }
  }
}))

const { purgeUnusedArtifacts, eraseLocalData } = await import(
  '../../src/main/services/privacy.js'
)

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'finder-privacy-'))
})

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true })
})

/** Crée un fichier avec les répertoires intermédiaires. */
function creerFichier(relatif: string, contenu = 'x'): void {
  const cible = path.join(userData, relatif)
  fs.mkdirSync(path.dirname(cible), { recursive: true })
  fs.writeFileSync(cible, contenu)
}

describe('purgeUnusedArtifacts', () => {
  it('retire l\'identifiant persistant du poste', () => {
    // Crashpad génère un identifiant unique par installation : sans serveur de
    // collecte, il est créé sans finalité.
    creerFichier('Crashpad/client_id', '0123456789abcdef')

    purgeUnusedArtifacts()

    expect(fs.existsSync(path.join(userData, 'Crashpad'))).toBe(false)
  })

  it('retire le journal de détection de suivi inter-sites', () => {
    creerFichier('DIPS')

    purgeUnusedArtifacts()

    expect(fs.existsSync(path.join(userData, 'DIPS'))).toBe(false)
  })

  it('retourne le nombre d\'artefacts effectivement retirés', () => {
    creerFichier('Crashpad/client_id')
    creerFichier('DIPS')

    expect(purgeUnusedArtifacts()).toBe(2)
  })

  it('préserve les données nécessaires au fonctionnement', () => {
    creerFichier('Preferences', '{}')
    creerFichier('Local Storage/leveldb/000003.log')

    purgeUnusedArtifacts()

    expect(fs.existsSync(path.join(userData, 'Preferences'))).toBe(true)
    expect(fs.existsSync(path.join(userData, 'Local Storage'))).toBe(true)
  })

  it('ne signale rien quand il n\'y a rien à retirer', () => {
    expect(purgeUnusedArtifacts()).toBe(0)
  })
})

describe('eraseLocalData', () => {
  it('efface le stockage contenant l\'historique de recherche', () => {
    creerFichier('Local Storage/leveldb/000003.log', 'finderHistory')

    eraseLocalData()

    expect(fs.existsSync(path.join(userData, 'Local Storage'))).toBe(false)
  })

  it('efface les caches du moteur de rendu', () => {
    creerFichier('Cache/index')
    creerFichier('Code Cache/js/index')
    creerFichier('GPUCache/data_0')

    eraseLocalData()

    for (const cache of ['Cache', 'Code Cache', 'GPUCache']) {
      expect(fs.existsSync(path.join(userData, cache))).toBe(false)
    }
  })

  it('efface aussi les artefacts sans finalité', () => {
    creerFichier('Crashpad/client_id')

    eraseLocalData()

    expect(fs.existsSync(path.join(userData, 'Crashpad'))).toBe(false)
  })

  it('rend compte des emplacements effacés', () => {
    creerFichier('Local Storage/leveldb/000003.log')
    creerFichier('Cache/index')

    const efface = eraseLocalData()

    // L'utilisateur doit pouvoir constater ce qui a été supprimé
    expect(efface).toContain('Local Storage')
    expect(efface).toContain('Cache')
  })

  it('retourne une liste vide si rien n\'est stocké', () => {
    expect(eraseLocalData()).toEqual([])
  })
})
