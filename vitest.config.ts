import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{js,ts}'],
    environment: 'node'
  },
  resolve: {
    // Les sources TypeScript importent leurs voisins avec une extension .js,
    // comme l'exige la résolution Node16. Vitest doit remonter au fichier .ts
    // correspondant, qui n'est pas compilé pendant les tests.
    extensions: ['.ts', '.js', '.json']
  }
})
