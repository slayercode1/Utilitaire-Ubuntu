/**
 * Vérifie que les trois déclarations des canaux IPC restent cohérentes.
 *
 * Le preload s'exécute en sandbox et ne peut pas charger ipcContracts.js : il
 * répète les noms de canaux littéralement. Ce test tient lieu de garde-fou en
 * comparant, par analyse statique, les canaux déclarés, ceux utilisés par le
 * preload et ceux traités par le processus principal.
 *
 * Un canal ajouté d'un seul côté fait échouer ce test.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import {
  IPC_CHANNELS,
  REQUEST_CHANNELS,
  COMMAND_CHANNELS
} from '../../src/shared/ipc-contracts.js'

// Vitest exécute depuis la racine du projet ; pas besoin de import.meta.url,
// qui serait incompatible avec la vérification en mode CommonJS.
const racine = process.cwd()

const lire = (nom: string): string =>
  fs.readFileSync(path.join(racine, nom), 'utf8')

const sourcePreload = lire('src/preload/index.ts')
const sourceMain = lire('src/main/ipc/register-handlers.ts')

/** Extrait les canaux d'un source via une expression donnée. */
function extraire(source: string, motif: RegExp): Set<string> {
  return new Set([...source.matchAll(motif)].map((m) => m[1]!))
}

describe('déclaration des canaux', () => {
  it('ne mélange pas requêtes et commandes', () => {
    const requetes: string[] = Object.values(REQUEST_CHANNELS)
    const commandes: string[] = Object.values(COMMAND_CHANNELS)
    const intersection = requetes.filter((c) => commandes.includes(c))

    expect(intersection).toEqual([])
  })

  it('regroupe tous les canaux dans IPC_CHANNELS', () => {
    const total = Object.keys(REQUEST_CHANNELS).length +
      Object.keys(COMMAND_CHANNELS).length

    expect(Object.keys(IPC_CHANNELS)).toHaveLength(total)
  })

  it('expose un objet figé', () => {
    expect(Object.isFrozen(IPC_CHANNELS)).toBe(true)
    expect(Object.isFrozen(REQUEST_CHANNELS)).toBe(true)
    expect(Object.isFrozen(COMMAND_CHANNELS)).toBe(true)
  })

  it('utilise des noms en kebab-case', () => {
    for (const canal of Object.values(IPC_CHANNELS)) {
      expect(canal).toMatch(/^[a-z]+(-[a-z]+)*$/)
    }
  })
})

describe('cohérence preload ↔ contrats', () => {
  const invokePreload = extraire(sourcePreload, /ipcRenderer\.invoke\('([^']+)'/g)
  const sendPreload = extraire(sourcePreload, /ipcRenderer\.send\('([^']+)'/g)

  it('le preload appelle exactement les canaux de requête déclarés', () => {
    expect([...invokePreload].sort()).toEqual(Object.values(REQUEST_CHANNELS).sort())
  })

  it('le preload envoie exactement les canaux de commande déclarés', () => {
    expect([...sendPreload].sort()).toEqual(Object.values(COMMAND_CHANNELS).sort())
  })
})

describe('cohérence main ↔ contrats', () => {
  // Le processus principal référence les constantes plutôt que des littéraux ;
  // on retrouve donc le canal via le nom de la clé.
  const resoudre = (
    cles: string[],
    source: Record<string, string>
  ): Set<string> => new Set(cles.map((cle) => source[cle]).filter(Boolean) as string[])

  const handleMain = resoudre(
    [...sourceMain.matchAll(/ipcMain\.handle\(\s*REQUEST_CHANNELS\.(\w+)/g)].map((m) => m[1]!),
    REQUEST_CHANNELS
  )

  const onMain = resoudre(
    [...sourceMain.matchAll(/ipcMain\.on\(\s*COMMAND_CHANNELS\.(\w+)/g)].map((m) => m[1]!),
    COMMAND_CHANNELS
  )

  it('le processus principal traite chaque canal de requête', () => {
    expect([...handleMain].sort()).toEqual(Object.values(REQUEST_CHANNELS).sort())
  })

  it('le processus principal traite chaque canal de commande', () => {
    expect([...onMain].sort()).toEqual(Object.values(COMMAND_CHANNELS).sort())
  })

  it('n\'utilise aucun nom de canal en dur', () => {
    // Un littéral échapperait à la vérification de cohérence ci-dessus
    const litteraux = [...sourceMain.matchAll(/ipcMain\.(?:on|handle)\(\s*'([^']+)'/g)]
    expect(litteraux.map((m) => m[1])).toEqual([])
  })

  it('aucun canal n\'est traité deux fois', () => {
    const tous = [...handleMain, ...onMain]
    expect(new Set(tous).size).toBe(tous.length)
  })
})

describe('surface exposée au renderer', () => {
  it('n\'expose pas ipcRenderer directement', () => {
    // exposeInMainWorld ne doit recevoir que des fonctions nommées, jamais
    // l'objet ipcRenderer, qui donnerait accès à tous les canaux.
    expect(sourcePreload).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer\s*[,)]/)
  })

  it('expose une méthode par canal', () => {
    const methodes = [...sourcePreload.matchAll(/^\s{2}(\w+):\s*\(/gm)].map((m) => m[1])
    expect(methodes.length).toBe(Object.keys(IPC_CHANNELS).length)
  })

  it('authentifie les émetteurs avant de traiter les canaux', () => {
    expect(sourceMain).toContain('hasTrustedSender(event)')
    expect(sourceMain).toContain('assertTrustedSender(event)')
    expect(sourceMain).toContain('isTrustedIpcSender')
  })

  it('ne reçoit jamais une commande Exec arbitraire pour lancer une application', () => {
    expect(sourcePreload).toContain("ipcRenderer.send('launch-app', desktopFilePath)")
    expect(sourceMain).toContain('entry.path === desktopFilePath')
    expect(sourceMain).not.toMatch(/LAUNCH_APP[^]*execCommand: unknown/)
  })
})
