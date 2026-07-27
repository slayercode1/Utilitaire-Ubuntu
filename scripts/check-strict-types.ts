/** Empêche l'introduction de types échappatoires dans les sources TypeScript. */

import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(__dirname, '..')
const SOURCE_ROOTS = ['src', 'tests', 'scripts'] as const
const ROOT_FILES = ['forge.config.ts', 'playwright.config.ts', 'vitest.config.ts'] as const

const blockedWords = ['a' + 'ny', 'un' + 'known']
const catchBindingPattern = /\bcatch\s*\([^)]*\)\s*\{/

function collectTypeScriptFiles(relativePath: string): string[] {
  const absolutePath = path.join(PROJECT_ROOT, relativePath)
  const stat = fs.statSync(absolutePath)

  if (stat.isFile()) {
    return absolutePath.endsWith('.ts') ? [absolutePath] : []
  }

  return fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .flatMap((entry) => collectTypeScriptFiles(path.join(relativePath, entry.name)))
}

const files = [
  ...SOURCE_ROOTS.flatMap(collectTypeScriptFiles),
  ...ROOT_FILES.map((file) => path.join(PROJECT_ROOT, file))
]

const violations: string[] = []

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')

  for (const [index, line] of lines.entries()) {
    if (catchBindingPattern.test(line)) {
      violations.push(`${path.relative(PROJECT_ROOT, file)}:${index + 1}: paramètre de capture`)
    }

    for (const blockedWord of blockedWords) {
      const pattern = new RegExp(`\\b${blockedWord}\\b`)
      if (pattern.test(line)) {
        violations.push(`${path.relative(PROJECT_ROOT, file)}:${index + 1}: ${blockedWord}`)
      }
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Types interdits détectés :\n${violations.join('\n')}`)
}

console.log('types stricts : aucun type échappatoire explicite')
