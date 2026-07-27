/**
 * Vérifie qu'un chemin appartient réellement à une racine.
 *
 * Une comparaison par `startsWith` confond par exemple `/home/alice` avec
 * `/home/alice-malware`. `path.relative` respecte les frontières de segments
 * et fonctionne aussi lorsque le candidat est exactement la racine.
 */

import path from 'node:path'

export function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))

  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  )
}
