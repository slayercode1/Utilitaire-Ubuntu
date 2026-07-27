/**
 * Tests de caractérisation des fonctions de validation.
 *
 * Ils décrivent le comportement actuel afin que toute réorganisation
 * ultérieure le préserve. Ils ne jugent pas ce comportement : quand une
 * règle paraît discutable, elle est documentée telle qu'elle est.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  parseCommandArguments,
  stripDesktopFieldCodes,
  validateAndSanitizePath,
  validateExecCommand,
  validateUserCommand
} from '../../src/main/services/validation.js'

// Ces fonctions journalisent leurs refus ; on garde la sortie de test lisible.
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('validateAndSanitizePath', () => {
  let home: string
  let outside: string
  let fichierTemporaire: string

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'finder-home-'))
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'finder-outside-'))
    vi.stubEnv('HOME', home)
    fichierTemporaire = path.join(home, 'document.txt')
    fs.writeFileSync(fichierTemporaire, 'test')
  })

  afterAll(() => {
    vi.unstubAllEnvs()
    fs.rmSync(home, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('accepte un fichier existant dans HOME', () => {
    expect(validateAndSanitizePath(fichierTemporaire)).toBe(fichierTemporaire)
  })

  it('résout les chemins relatifs en chemins absolus', () => {
    const resultat = validateAndSanitizePath(fichierTemporaire)
    expect(resultat).not.toBeNull()
    expect(path.isAbsolute(resultat!)).toBe(true)
  })

  it('refuse une entrée absente ou non textuelle', () => {
    expect(validateAndSanitizePath(null)).toBeNull()
    expect(validateAndSanitizePath('')).toBeNull()
    expect(validateAndSanitizePath(42)).toBeNull()
    expect(validateAndSanitizePath({})).toBeNull()
  })

  it('refuse un fichier inexistant', () => {
    expect(validateAndSanitizePath('/tmp/aucune-chance-que-ceci-existe-9182')).toBeNull()
  })

  it('refuse un chemin hors des répertoires autorisés', () => {
    // /etc existe mais n'est pas dans la liste blanche
    expect(validateAndSanitizePath('/etc/hostname')).toBeNull()
  })

  it('refuse les fichiers sensibles même sous un chemin autorisé', () => {
    expect(validateAndSanitizePath('/etc/passwd')).toBeNull()
    expect(validateAndSanitizePath('/etc/shadow')).toBeNull()
  })

  it('bloque la remontée de répertoire vers une zone interdite', () => {
    expect(validateAndSanitizePath(`${home}/../../etc/passwd`)).toBeNull()
  })

  it('refuse un préfixe qui ressemble à HOME sans être son descendant', () => {
    const sibling = `${home}-malveillant`
    fs.mkdirSync(sibling)
    const target = path.join(sibling, 'payload.txt')
    fs.writeFileSync(target, 'test')

    try {
      expect(validateAndSanitizePath(target)).toBeNull()
    } finally {
      fs.rmSync(sibling, { recursive: true, force: true })
    }
  })

  it('refuse un lien symbolique qui sort de HOME', () => {
    const target = path.join(outside, 'secret-factice.txt')
    const link = path.join(home, 'lien.txt')
    fs.writeFileSync(target, 'synthetique')
    fs.symlinkSync(target, link)

    expect(validateAndSanitizePath(link)).toBeNull()
  })
})

describe('validateExecCommand', () => {
  it('accepte une commande simple', () => {
    expect(validateExecCommand('/usr/bin/firefox')).toBe('/usr/bin/firefox')
  })

  it('conserve les codes de champ .desktop (nettoyés plus tard, par argument)', () => {
    // Comportement voulu : le nettoyage a lieu dans stripDesktopFieldCodes,
    // une fois les arguments séparés, pour ne pas laisser de "--" orphelin.
    expect(validateExecCommand('/snap/bin/discord --url -- %u')).toBe(
      '/snap/bin/discord --url -- %u'
    )
  })

  it('supprime les espaces de bordure', () => {
    expect(validateExecCommand('  code  ')).toBe('code')
  })

  it('refuse une entrée vide ou non textuelle', () => {
    expect(validateExecCommand('')).toBeNull()
    expect(validateExecCommand(null)).toBeNull()
    expect(validateExecCommand(undefined)).toBeNull()
    expect(validateExecCommand(123)).toBeNull()
  })

  it('refuse les métacaractères shell', () => {
    expect(validateExecCommand('firefox; rm -rf /')).toBeNull()
    expect(validateExecCommand('firefox && echo x')).toBeNull()
    expect(validateExecCommand('firefox || echo x')).toBeNull()
    expect(validateExecCommand('echo `whoami`')).toBeNull()
    expect(validateExecCommand('echo $(whoami)')).toBeNull()
    expect(validateExecCommand('cat a | grep b')).toBeNull()
  })

  it('refuse une commande dépassant 1000 caractères', () => {
    expect(validateExecCommand('a'.repeat(1001))).toBeNull()
    expect(validateExecCommand('a'.repeat(1000))).toBe('a'.repeat(1000))
  })
})

describe('parseCommandArguments', () => {
  it('sépare les arguments sur les espaces', () => {
    expect(parseCommandArguments('firefox --new-window')).toEqual(['firefox', '--new-window'])
  })

  it('préserve les segments entre guillemets', () => {
    expect(parseCommandArguments('app "mon fichier.txt"')).toEqual(['app', 'mon fichier.txt'])
  })

  it('accepte les apostrophes comme délimiteur', () => {
    expect(parseCommandArguments("app 'mon fichier.txt'")).toEqual(['app', 'mon fichier.txt'])
  })

  it('gère les guillemets échappés', () => {
    expect(parseCommandArguments('app "un \\"mot\\" cité"')).toEqual(['app', 'un "mot" cité'])
  })

  it('ignore les espaces multiples', () => {
    expect(parseCommandArguments('a    b')).toEqual(['a', 'b'])
  })

  it('retourne un tableau vide pour une chaîne vide', () => {
    expect(parseCommandArguments('')).toEqual([])
  })
})

describe('stripDesktopFieldCodes', () => {
  it('retire un code de champ isolé', () => {
    expect(stripDesktopFieldCodes(['code', '%F'])).toEqual(['code'])
    expect(stripDesktopFieldCodes(['firefox', '%u'])).toEqual(['firefox'])
  })

  it('retire le "--" devenu orphelin (cas Discord)', () => {
    // Régression : sans cela, Discord reçoit "--url --" et ne démarre pas
    expect(stripDesktopFieldCodes(['/snap/bin/discord', '--url', '--', '%u'])).toEqual([
      '/snap/bin/discord',
      '--url'
    ])
  })

  it("supprime un préfixe d'option vidé de sa valeur", () => {
    expect(stripDesktopFieldCodes(['app', '--file=%f', '--autre'])).toEqual(['app', '--autre'])
  })

  it('convertit %% en pourcentage littéral', () => {
    expect(stripDesktopFieldCodes(['app', '100%%'])).toEqual(['app', '100%'])
  })

  it('laisse intacte une commande sans code de champ', () => {
    expect(stripDesktopFieldCodes(['nautilus', '--new-window'])).toEqual([
      'nautilus',
      '--new-window'
    ])
  })

  it('conserve un % isolé qui ne forme pas un code connu', () => {
    expect(stripDesktopFieldCodes(['app', '%z'])).toEqual(['app', '%z'])
  })

  it('retourne un tableau vide si tout est supprimé', () => {
    expect(stripDesktopFieldCodes(['%F'])).toEqual([])
  })
})

describe('validateUserCommand', () => {
  it('accepte une commande courante', () => {
    expect(validateUserCommand('ls -la')).toBe('ls -la')
  })

  it('supprime les espaces de bordure', () => {
    expect(validateUserCommand('  pwd  ')).toBe('pwd')
  })

  it('refuse une entrée vide ou non textuelle', () => {
    expect(validateUserCommand('')).toBeNull()
    expect(validateUserCommand('   ')).toBeNull()
    expect(validateUserCommand(null)).toBeNull()
    expect(validateUserCommand(42)).toBeNull()
  })

  it('refuse les commandes destructives connues', () => {
    expect(validateUserCommand('rm -rf /')).toBeNull()
  })

  it('refuse une commande dépassant 1000 caractères', () => {
    expect(validateUserCommand('a'.repeat(1001))).toBeNull()
  })
})
