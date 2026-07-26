/**
 * Copie vers dist/ les fichiers que TypeScript n'émet pas.
 *
 * Le projet n'utilise pas de bundler : le document HTML doit être placé à côté
 * du script compilé, faute de quoi la fenêtre resterait vide.
 *
 * Compilé avec le reste du projet puis exécuté depuis dist/.
 */

import fs from 'node:fs'
import path from 'node:path'

const racine = path.join(__dirname, '..')

/** Fichiers à recopier, exprimés en chemins relatifs à la racine du projet. */
const ASSETS: readonly (readonly [source: string, destination: string])[] = [
  ['src/renderer/index.html', 'dist/renderer/index.html'],
  ['src/renderer/styles.css', 'dist/renderer/styles.css']
]

for (const [source, destination] of ASSETS) {
  const cible = path.join(racine, destination)

  fs.mkdirSync(path.dirname(cible), { recursive: true })
  fs.copyFileSync(path.join(racine, source), cible)

  console.log(`copié : ${destination}`)
}
