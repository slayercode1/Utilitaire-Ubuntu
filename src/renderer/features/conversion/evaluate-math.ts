/**
 * Finder - Évaluation d'expressions arithmétiques
 *
 * Analyseur descendant récursif : il n'utilise ni `eval` ni `Function`, qui
 * exécuteraient du code arbitraire saisi dans le champ de recherche.
 *
 * Module sans dépendance au DOM, donc vérifiable sans navigateur.
 */

// Compilées une seule fois : ces fonctions sont appelées à chaque frappe.
const VALID_EXPRESSION_CHARS = /^[\d+\-*/^()%.\s]+$/
const HAS_OPERATOR = /[+\-*/^%]/
const HAS_DIGIT = /\d/
const VALID_CLEANED_EXPRESSION = /^[\d+\-*/^.()%]+$/
const WHITESPACE = /\s/g

/**
 * Date saisie pour retrouver un fichier (2024-01-15, 15/01/2024, 15.01.2024).
 * Évaluée, elle devenait « = 2008 » et masquait les fichiers correspondants.
 */
const DATE_LIKE = /^\d{1,4}([-/.])\d{1,2}\1\d{1,4}$/

/**
 * Une expression est mathématique si elle ne contient que des caractères
 * autorisés, au moins un opérateur et au moins un chiffre.
 */
export function isMathExpression(str: string): boolean {
  const cleaned = str.trim()

  if (DATE_LIKE.test(cleaned)) return false

  return (
    VALID_EXPRESSION_CHARS.test(cleaned) && HAS_OPERATOR.test(cleaned) && HAS_DIGIT.test(cleaned)
  )
}

export function evaluateMath(expression: string): number | null {
  try {
    const cleaned = expression.trim().replace(WHITESPACE, '')

    if (!VALID_CLEANED_EXPRESSION.test(cleaned)) {
      return null
    }

    const result = parseExpression(cleaned)

    if (typeof result === 'number' && !Number.isNaN(result) && Number.isFinite(result)) {
      // Arrondir à 10 décimales pour éviter les problèmes de précision
      return Math.round(result * 10000000000) / 10000000000
    }

    return null
  } catch {
    console.error('Math evaluation error')
    return null
  }
}

function parseExpression(expr: string): number | null {
  let pos = 0

  /** Parenthèse non fermée ou nombre invalide, relevé pendant l'analyse. */
  let malformed = false

  // Une chaîne vide en fin d'expression évite de propager `undefined` dans
  // toutes les comparaisons de l'analyseur.
  function peek(): string {
    return expr[pos] ?? ''
  }

  function consume(): string {
    return expr[pos++] ?? ''
  }

  function parseNumber(): number {
    // Comparaison de codes plutôt que regex : `match` allouait un tableau
    // de résultat par caractère consommé.
    const start = pos
    if (expr.charCodeAt(pos) === 45 /* - */) pos++

    while (pos < expr.length) {
      const code = expr.charCodeAt(pos)
      if ((code >= 48 && code <= 57) /* 0-9 */ || code === 46 /* . */) {
        pos++
      } else {
        break
      }
    }

    // `parseFloat` lit le plus long préfixe valide : « 1..2 » valait 1 et
    // « 1.2.3 » valait 1.2, ce qui affichait un résultat faux.
    const literal = expr.slice(start, pos)
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(literal)) malformed = true

    return parseFloat(literal)
  }

  function parseFactor(): number {
    if (peek() === '(') {
      consume() // (
      const result = parseAddSub()
      if (consume() !== ')') malformed = true
      return result
    }
    return parseNumber()
  }

  function parsePower(): number {
    let left = parseFactor()
    while (pos < expr.length && peek() === '^') {
      consume() // ^
      const right = parseFactor()
      left = left ** right
    }
    return left
  }

  function parseMulDivMod(): number {
    let left = parsePower()
    while (pos < expr.length) {
      const op = peek()
      if (op === '*') {
        consume()
        left = left * parsePower()
      } else if (op === '/') {
        consume()
        left = left / parsePower()
      } else if (op === '%') {
        consume()
        left = left % parsePower()
      } else {
        break
      }
    }
    return left
  }

  function parseAddSub(): number {
    let left = parseMulDivMod()
    while (pos < expr.length) {
      const op = peek()
      if (op === '+') {
        consume()
        left = left + parseMulDivMod()
      } else if (op === '-') {
        consume()
        left = left - parseMulDivMod()
      } else {
        break
      }
    }
    return left
  }

  const result = parseAddSub()

  // Un reliquat non consommé (« 2)+3 ») signalait jusqu'ici un calcul
  // tronqué présenté comme exact.
  return malformed || pos !== expr.length ? null : result
}
