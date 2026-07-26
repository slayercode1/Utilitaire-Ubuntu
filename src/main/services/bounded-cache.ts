/**
 * Finder - Cache borné
 *
 * Les index d'icônes mémorisent le contenu de répertoires système qui peuvent
 * contenir des dizaines de milliers de fichiers. Sans borne, cette mémoire
 * n'était jamais rendue pendant toute la durée de vie de l'application, qui
 * reste résidente en arrière-plan.
 *
 * L'éviction retire l'entrée la moins récemment utilisée : les icônes des
 * applications réellement lancées restent en cache, les autres s'effacent.
 */

export class BoundedCache<K, V> {
  /**
   * L'ordre d'insertion d'une Map JavaScript est garanti : la première clé
   * énumérée est la plus anciennement utilisée, ce qui suffit à implémenter
   * l'éviction sans structure supplémentaire.
   */
  private readonly entries = new Map<K, V>()

  constructor(private readonly maxSize: number) {
    if (maxSize <= 0) {
      throw new RangeError('La taille maximale doit être strictement positive')
    }
  }

  /** Nombre d'entrées actuellement mémorisées. */
  get size(): number {
    return this.entries.size
  }

  /**
   * Lit une entrée et la marque comme récemment utilisée.
   */
  get(key: K): V | undefined {
    const value = this.entries.get(key)

    if (value === undefined) return undefined

    // Réinsérer place la clé en fin d'ordre d'énumération
    this.entries.delete(key)
    this.entries.set(key, value)

    return value
  }

  /** Indique si une clé est présente, sans modifier son ancienneté. */
  has(key: K): boolean {
    return this.entries.has(key)
  }

  /**
   * Mémorise une entrée, en évinçant la plus ancienne si la borne est atteinte.
   */
  set(key: K, value: V): void {
    if (this.entries.has(key)) {
      this.entries.delete(key)
    } else if (this.entries.size >= this.maxSize) {
      const plusAncienne = this.entries.keys().next()
      if (!plusAncienne.done) {
        this.entries.delete(plusAncienne.value)
      }
    }

    this.entries.set(key, value)
  }

  /** Vide entièrement le cache. */
  clear(): void {
    this.entries.clear()
  }
}
