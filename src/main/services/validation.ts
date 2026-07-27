/**
 * Finder - Validation des entrées
 *
 * Ces fonctions filtrent les données reçues du renderer avant toute exécution :
 * chemins de fichiers, commandes d'applications et commandes utilisateur.
 * Elles ne dépendent ni d'Electron ni de l'état de l'application, ce qui les
 * rend testables sans lancer le processus principal.
 *
 * Le typage ne remplace pas ces contrôles : les valeurs arrivent d'un canal IPC
 * et ne sont connues qu'à l'exécution.
 */

import fs from 'node:fs'
import path from 'node:path'

import { SYSTEM_DATA_ROOTS } from '../../shared/paths.js'
import type { RuntimeValue } from '../../shared/types.js'
import { isPathInside } from './path-security.js'

/** Longueur maximale acceptée pour une commande, en caractères. */
const MAX_COMMAND_LENGTH = 1000

/** Codes de champ définis par la spécification Desktop Entry. */
const FIELD_CODE_LETTERS = 'uUfFdDnNickvm'

/**
 * Fichiers dont la lecture ne doit jamais être proposée, même situés dans une
 * arborescence par ailleurs autorisée.
 */
const FORBIDDEN_PATH_FRAGMENTS: readonly string[] = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
  '/.ssh/',
  '/id_rsa',
  '/id_ed25519'
]

/** Motifs indiquant une tentative d'injection dans une commande d'application. */
const DANGEROUS_EXEC_PATTERNS: readonly RegExp[] = [
  /[;&|`$(){}]/, // Métacaractères shell
  /\$\(/, // Substitution de commande
  /`/, // Accents graves
  /\|\|/, // Opérateur OU
  /&&/, // Opérateur ET
  />\s*\/dev/, // Redirection vers /dev
  /rm\s+-rf/i, // Commande destructive
  /:\(\)\{/ // Bombe à fourche
]

/** Commandes utilisateur refusées quelles que soient les circonstances. */
const BLOCKED_USER_COMMANDS: readonly RegExp[] = [
  /^\s*rm\s+-rf\s+\//i,
  /:\(\)\{.*:\|:&\};:/,
  /dd\s+if=.*of=\/dev\/sd/i,
  /mkfs/i,
  />\s*\/dev\/sd/,
  /wget.*\|\s*sh/i,
  /curl.*\|\s*sh/i,
  /nc\s+-l/i,
  /\/dev\/tcp/
]

/**
 * Valide et normalise un chemin avant ouverture.
 *
 * @param filePath - Chemin proposé par le renderer
 * @returns Chemin absolu vérifié, ou `null` si l'accès est refusé
 */
export function validateAndSanitizePath(filePath: RuntimeValue): string | null {
  if (!filePath || typeof filePath !== 'string') {
    console.error('Invalid file path: not a string')
    return null
  }

  try {
    const resolvedPath = path.resolve(filePath)

    if (!fs.existsSync(resolvedPath)) {
      console.error('File does not exist')
      return null
    }

    const homeDir = process.env['HOME'] || process.env['USERPROFILE']

    // Si le répertoire personnel est introuvable, seuls les emplacements
    // système restent ouverts : la comparaison sur une valeur absente lèverait
    // une exception qui masquerait la raison du refus.
    const allowedPaths = [homeDir, ...SYSTEM_DATA_ROOTS].filter((candidate): candidate is string =>
      Boolean(candidate)
    )

    // Valider la cible réelle empêche qu'un lien symbolique situé dans HOME
    // ouvre un fichier extérieur à la liste blanche après le contrôle.
    const realPath = fs.realpathSync(resolvedPath)
    const isAllowed = allowedPaths.some((allowed) => {
      const realRoot = fs.existsSync(allowed) ? fs.realpathSync(allowed) : allowed
      return isPathInside(realPath, realRoot)
    })

    if (!isAllowed) {
      console.error('Access denied: path outside allowed directories')
      return null
    }

    const isForbidden = FORBIDDEN_PATH_FRAGMENTS.some((fragment) => realPath.includes(fragment))

    if (isForbidden) {
      console.error('Access denied: forbidden file pattern')
      return null
    }

    return realPath
  } catch {
    console.error('Path validation error')
    return null
  }
}

/**
 * Valide la commande d'une application issue d'un fichier `.desktop`.
 *
 * Les codes de champ (`%u`, `%F`…) sont conservés à ce stade : les retirer ici
 * laisserait un `--` orphelin. Ils sont traités par `stripDesktopFieldCodes`,
 * une fois les arguments séparés.
 *
 * @param execCommand - Valeur brute du champ `Exec=`
 * @returns Commande acceptée, ou `null`
 */
export function validateExecCommand(execCommand: RuntimeValue): string | null {
  if (!execCommand || typeof execCommand !== 'string') {
    return null
  }

  const cleanExec = execCommand.trim()

  if (!cleanExec) {
    return null
  }

  if (cleanExec.length > MAX_COMMAND_LENGTH) {
    console.error('Command length exceeds limit')
    return null
  }

  for (const pattern of DANGEROUS_EXEC_PATTERNS) {
    if (pattern.test(cleanExec)) {
      console.error('Dangerous pattern detected in command')
      return null
    }
  }

  return cleanExec
}

/**
 * Découpe une ligne de commande en arguments, en respectant les guillemets.
 *
 * @param commandLine - Ligne à découper
 * @returns Arguments séparés
 */
export function parseCommandArguments(commandLine: string): string[] {
  const args: string[] = []

  let current = ''
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i]
    const nextChar = commandLine[i + 1]

    if (char === undefined) continue

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true
      quoteChar = char
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false
      quoteChar = ''
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current)
        current = ''
      }
    } else if (char === '\\' && inQuotes && (nextChar === '"' || nextChar === "'")) {
      current += nextChar
      i++
    } else {
      current += char
    }
  }

  if (current) {
    args.push(current)
  }

  return args
}

/**
 * Retire les codes de champ `.desktop` d'une liste d'arguments.
 *
 * La spécification impose de supprimer le token entier, pas seulement la
 * séquence de caractères : un nettoyage par expression régulière laisse des
 * arguments vides ou tronqués. Le cas typique est
 * `Exec=/snap/bin/discord --url -- %u`, où retirer seulement `%u` laisse un
 * `--` orphelin qui empêche Discord de démarrer.
 *
 * @param args - Arguments issus de `parseCommandArguments`
 * @returns Arguments exécutables
 */
export function stripDesktopFieldCodes(args: readonly string[]): string[] {
  const fieldCodePattern = new RegExp(`^%[${FIELD_CODE_LETTERS}]$`)
  const cleaned: string[] = []

  for (const arg of args) {
    if (fieldCodePattern.test(arg)) {
      continue
    }

    // Codes collés à un préfixe, par exemple `--file=%f`. Un seul passage :
    // `%%` est un pourcentage littéral et ne doit pas être relu comme un code.
    let withoutInline = ''

    for (let i = 0; i < arg.length; i++) {
      const char = arg[i]

      if (char !== '%') {
        withoutInline += char
        continue
      }

      const next = arg[i + 1]

      if (next === '%') {
        withoutInline += '%'
        i++
      } else if (next !== undefined && FIELD_CODE_LETTERS.includes(next)) {
        i++
      } else {
        withoutInline += '%'
      }
    }

    // Un préfixe d'option vidé de sa valeur (`--file=`) serait transmis tel
    // quel au programme et rejeté : mieux vaut omettre l'argument.
    if (!withoutInline || /[=:]$/.test(withoutInline)) {
      continue
    }

    cleaned.push(withoutInline)
  }

  // Un `--` final ne sépare plus que des arguments supprimés ; le conserver
  // fait échouer les analyseurs stricts (Discord, applications Electron).
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === '--') {
    cleaned.pop()
  }

  return cleaned
}

/**
 * Valide une commande shell saisie par l'utilisateur.
 *
 * @param command - Commande saisie
 * @returns Commande acceptée, ou `null`
 */
export function validateUserCommand(command: RuntimeValue): string | null {
  if (!command || typeof command !== 'string') {
    return null
  }

  const trimmed = command.trim()

  if (trimmed.length === 0 || trimmed.length > MAX_COMMAND_LENGTH) {
    console.error('Command length invalid')
    return null
  }

  for (const blocked of BLOCKED_USER_COMMANDS) {
    if (blocked.test(trimmed)) {
      console.error('Blocked dangerous command')
      return null
    }
  }

  return trimmed
}
