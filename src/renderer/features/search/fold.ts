/**
 * Finder - Comparaison tolérante pour la recherche
 *
 * Un utilisateur tape « parametres » pour trouver « Paramètres », ou
 * « ECRAN » pour « Écran » : la recherche ignore la casse et les accents.
 * Le texte affiché, lui, n'est jamais modifié.
 *
 * Module sans dépendance au DOM, donc vérifiable sans navigateur.
 */

/** Marques combinantes laissées par la décomposition NFD (accents, cédilles…). */
const COMBINING_MARKS = /\p{M}/gu

/**
 * Les noms d'applications et de fichiers sont comparés à chaque frappe :
 * leur forme repliée est mémorisée. Le nombre d'entrées reste borné par
 * l'index (50 000 fichiers au plus), on vide simplement au-delà.
 */
const foldCache = new Map<string, string>()
const FOLD_CACHE_LIMIT = 60_000

/** Forme de comparaison : minuscules, sans accents ni marques combinantes. */
export function foldForSearch(text: string): string {
  const cached = foldCache.get(text)
  if (cached !== undefined) return cached

  const folded = text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
  if (foldCache.size >= FOLD_CACHE_LIMIT) foldCache.clear()
  foldCache.set(text, folded)
  return folded
}
