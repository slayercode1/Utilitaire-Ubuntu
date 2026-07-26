/**
 * Finder - Évaluation d'expressions arithmétiques
 *
 * Analyseur descendant récursif : il n'utilise ni `eval` ni `Function`, qui
 * exécuteraient du code arbitraire saisi dans le champ de recherche.
 *
 * Module sans dépendance au DOM, donc vérifiable sans navigateur.
 */

export function isMathExpression(str: string): boolean {
  // Supprimer les espaces
  const cleaned = str.trim()

  // Ne doit contenir que des caractères mathématiques valides
  const validChars = /^[\d+\-*/^()%.\s]+$/.test(cleaned)
  if (!validChars) return false

  // Doit contenir au moins un opérateur mathématique
  const hasMathOperator = /[+\-*/^%]/.test(cleaned)
  if (!hasMathOperator) return false

  // Doit contenir au moins un chiffre
  const hasNumbers = /\d/.test(cleaned)
  if (!hasNumbers) return false

  return cleaned.length > 0
}

export function evaluateMath(expression: string): number | null {
  try {
    // Nettoyer l'expression
    let cleaned = expression.trim().replace(/\s/g, '')

    // Vérifier que l'expression ne contient que des caractères mathématiques
    if (!/^[\d+\-*/^.()%]+$/.test(cleaned)) {
      return null
    }

    // Parser et évaluer l'expression
    const result = parseExpression(cleaned)

    // Vérifier que le résultat est un nombre valide
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      // Arrondir à 10 décimales pour éviter les problèmes de précision
      return Math.round(result * 10000000000) / 10000000000
    }

    return null
  } catch (error) {
    console.error('Math evaluation error:', error)
    return null
  }
}

function parseExpression(expr: string): number | null {
  let pos = 0

  // Une chaîne vide en fin d'expression évite de propager `undefined` dans
  // toutes les comparaisons de l'analyseur.
  function peek(): string {
    return expr[pos] ?? ''
  }

  function consume(): string {
    return expr[pos++] ?? ''
  }

  function parseNumber(): number {
    let num = ''
    while (pos < expr.length && (peek().match(/[\d.]/) || (peek() === '-' && num === ''))) {
      num += consume()
    }
    return parseFloat(num)
  }

  function parseFactor(): number {
    if (peek() === '(') {
      consume() // (
      const result = parseAddSub()
      consume() // )
      return result
    }
    return parseNumber()
  }

  function parsePower(): number {
    let left = parseFactor()
    while (pos < expr.length && peek() === '^') {
      consume() // ^
      const right = parseFactor()
      left = Math.pow(left, right)
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

  return parseAddSub()
}
