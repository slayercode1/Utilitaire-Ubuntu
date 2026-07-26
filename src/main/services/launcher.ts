/**
 * Finder - Lancement de processus externes
 *
 * Les processus sont démarrés détachés, sans shell : passer par `shell: true`
 * ferait interpréter la ligne de commande, ce qui rouvrirait la porte à
 * l'injection malgré la validation en amont.
 */

import { spawn } from 'node:child_process'

/**
 * Lance un processus détaché du parent.
 *
 * @param args - Programme puis arguments, déjà séparés
 * @param description - Libellé utilisé dans les journaux
 * @returns `true` si le processus a démarré
 */
export function launchDetachedProcess(
  args: readonly string[],
  description: string
): boolean {
  const [command, ...commandArgs] = args

  if (!command) {
    console.error('Invalid arguments for launching process')
    return false
  }

  try {
    const child = spawn(command, commandArgs, {
      detached: true,
      stdio: 'ignore',
      // Critique : sans shell, les arguments ne sont jamais réinterprétés
      shell: false
    })

    // Détache le processus enfant : Finder peut se fermer sans l'emporter
    child.unref()

    console.log(`${description} launched successfully`)
    return true
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Error launching ${description}:`, message)
    return false
  }
}
