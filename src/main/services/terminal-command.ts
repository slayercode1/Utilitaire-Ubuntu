/**
 * Finder - Exécution de commandes dans un terminal
 *
 * La commande saisie par l'utilisateur est écrite dans un script temporaire
 * plutôt que passée en argument du terminal : interpoler une chaîne dans une
 * ligne de commande rouvrirait la porte à l'injection, y compris via des
 * échappements ou des caractères Unicode.
 *
 * Ce module ne dépend pas d'Electron, ce qui permet de vérifier la composition
 * du script et le nettoyage sans lancer l'application.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Délai avant suppression du script, en millisecondes.
 * Le script se termine normalement bien avant ; ce nettoyage n'est qu'un filet
 * de sécurité si le terminal n'a jamais été lancé.
 */
export const CLEANUP_DELAY = 60_000

/** Options de création d'un script temporaire. */
export interface WriteScriptOptions {
  /** Répertoire d'accueil, surchargé par les tests. */
  tmpDir?: string
}

/**
 * Compose le contenu du script temporaire.
 *
 * La pause finale évite que le terminal ne se referme immédiatement, ce qui
 * empêcherait de lire la sortie de la commande.
 *
 * @param command - Commande déjà validée
 */
export function buildScriptContent(command: string): string {
  return `#!/bin/bash
${command}
echo
echo "Appuyez sur Entrée pour fermer..."
read
`
}

/**
 * Écrit la commande dans un script temporaire exécutable par son seul
 * propriétaire.
 *
 * @param command - Commande déjà validée
 * @param options - Répertoire d'accueil
 * @returns Chemin du script créé
 */
export function writeCommandScript(command: string, options: WriteScriptOptions = {}): string {
  const tmpDir = options.tmpDir ?? os.tmpdir()
  const scriptId = crypto.randomBytes(8).toString('hex')
  const scriptPath = path.join(tmpDir, `finder-cmd-${scriptId}.sh`)

  // 0o700 : lecture, écriture et exécution réservées au propriétaire
  fs.writeFileSync(scriptPath, buildScriptContent(command), {
    mode: 0o700,
    flag: 'wx'
  })

  return scriptPath
}

/**
 * Supprime un script temporaire, sans échouer s'il a déjà disparu.
 */
export function removeCommandScript(scriptPath: string): void {
  try {
    fs.rmSync(scriptPath, { force: true })
  } catch {
    // Le script a pu être supprimé par le terminal lui-même
  }
}

/**
 * Programme la suppression différée du script.
 *
 * @param scriptPath - Chemin du script
 * @param delay - Délai en millisecondes
 * @returns Minuteur, pour permettre son annulation
 */
export function scheduleCleanup(scriptPath: string, delay: number = CLEANUP_DELAY): NodeJS.Timeout {
  const timer = setTimeout(() => removeCommandScript(scriptPath), delay)

  // Ce minuteur ne doit pas retarder la fermeture de l'application
  timer.unref()

  return timer
}
