import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{js,ts}'],
    environment: 'node',

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',

      include: ['src/**/*.ts'],

      exclude: [
        'src/**/*.d.ts',
        // Modules liés au runtime Electron ou au DOM : couverts par les tests
        // E2E Playwright, pas par les tests unitaires Node.
        'src/main/index.ts',
        'src/main/window.ts',
        'src/main/lifecycle.ts',
        'src/main/app-protocol.ts',
        'src/main/config.ts',
        'src/main/ipc/**',
        'src/main/scanners/**',
        'src/preload/**',
        'src/renderer/main.ts',
        'src/shared/types.ts'
      ]
    }
  },
  resolve: {
    // Les sources TypeScript importent leurs voisins avec une extension .js,
    // comme l'exige la résolution Node16. Vitest doit remonter au fichier .ts
    // correspondant, qui n'est pas compilé pendant les tests.
    extensions: ['.ts', '.js', '.json']
  }
})
