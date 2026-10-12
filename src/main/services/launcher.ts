/**
 * Finder - Lancement de processus externes
 *
 * Les processus sont démarrés détachés, sans shell : passer par `shell: true`
 * ferait interpréter la ligne de commande, ce qui rouvrirait la porte à
 * l'injection malgré la validation en amont.
 *
 * `spawn` ne lève pas d'exception quand le programme est introuvable : il
 * retourne un processus puis émet `error` (ENOENT) au tour de boucle suivant.
 * Sans écouteur, cet événement devient une exception non rattrapée, et le
 * gestionnaire global quitte l'application — une entrée `.desktop` orpheline
 * ou un terminal absent suffisait à faire disparaître Finder. L'issue réelle
 * n'est donc connue qu'à l'événement `spawn` ou `error`.
 */

import { spawn } from 'node:child_process'

/**
 * Variables posées par snapd pour Finder lui-même (SNAP, SNAP_NAME,
 * SNAP_USER_DATA…). Transmises aux applications lancées, elles leur feraient
 * croire qu'elles s'exécutent dans le snap de Finder : certaines désactivent
 * alors leur propre mise à jour ou déplacent leurs données.
 */
const SNAP_VARIABLE = /^SNAP($|_)/

/**
 * Environnement à transmettre à une application de l'hôte : celui de Finder,
 * sans les variables propres à son paquet snap.
 */
export function hostEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!environment['SNAP']) return environment

  return Object.fromEntries(
    Object.entries(environment).filter(([name]) => !SNAP_VARIABLE.test(name))
  )
}

/**
 * Lance un processus détaché du parent.
 *
 * @param args - Programme puis arguments, déjà séparés
 * @param description - Libellé utilisé dans les journaux
 * @returns `true` si le processus a effectivement démarré
 */
export function launchDetachedProcess(
  args: readonly string[],
  description: string
): Promise<boolean> {
  const [command, ...commandArgs] = args

  if (!command) {
    console.error('Invalid arguments for launching process')
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    try {
      const child = spawn(command, commandArgs, {
        detached: true,
        stdio: 'ignore',
        env: hostEnvironment(process.env),
        // Critique : sans shell, les arguments ne sont jamais réinterprétés
        shell: false
      })

      child.once('spawn', () => {
        console.log(`${description} launched successfully`)
        resolve(true)
      })

      // Écouteur permanent : une erreur tardive ne doit jamais remonter
      // jusqu'au gestionnaire d'exceptions global.
      child.on('error', (error: NodeJS.ErrnoException) => {
        console.error(`Error launching ${description}:`, error.code ?? error.message)
        resolve(false)
      })

      // Détache le processus enfant : Finder peut se fermer sans l'emporter
      child.unref()
    } catch {
      console.error(`Error launching ${description}`)
      resolve(false)
    }
  })
}
