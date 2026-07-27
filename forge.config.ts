/** Configuration de production Electron Forge. */

import fs from 'node:fs/promises'
import path from 'node:path'

import {
  FuseState,
  FuseV1Options,
  FuseVersion,
  flipFuses,
  getCurrentFuseWire
} from '@electron/fuses'
import type { ForgeConfig } from '@electron-forge/shared-types'

// Les archives et paquets ne doivent pas hériter d'un umask développeur 0002.
process.umask(0o022)

async function normalizePackageModes(root: string): Promise<void> {
  const entries = await fs.readdir(root, { withFileTypes: true })

  for (const entry of entries) {
    const target = path.join(root, entry.name)

    if (entry.isDirectory()) {
      await fs.chmod(target, 0o755)
      await normalizePackageModes(target)
    } else if (entry.isFile()) {
      const current = await fs.stat(target)
      const executable = (current.mode & 0o111) !== 0
      await fs.chmod(target, executable ? 0o755 : 0o644)
    }
  }
}

const FUSE_CONFIG = {
  version: FuseVersion.V1,
  strictlyRequireAllFuses: true,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  // Le paquet ne livre pas de snapshot propre au processus navigateur.
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
  // Le renderer est servi par finder-app://, jamais par file://.
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  // Conserve les garde-pages V8 pour la sûreté mémoire WebAssembly.
  [FuseV1Options.WasmTrapHandlers]: true
} as const

async function hardenAndVerifyElectron(executablePath: string): Promise<void> {
  await flipFuses(executablePath, FUSE_CONFIG)

  const actual = await getCurrentFuseWire(executablePath)
  for (const [rawOption, expected] of Object.entries(FUSE_CONFIG)) {
    if (!/^\d+$/.test(rawOption)) continue

    const option = Number(rawOption) as FuseV1Options
    const expectedState = expected ? FuseState.ENABLE : FuseState.DISABLE
    if (actual[option] !== expectedState) {
      throw new Error(`Fuse ${FuseV1Options[option]} incorrecte après packaging`)
    }
  }

  console.log('fuses : 9 valeurs explicitement configurées et vérifiées')
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './logo.png',
    extraResource: ['./logo.png'],
    // Le cache dans le workspace rend le build reproductible entre le
    // téléchargement approuvé et les validations sandboxées suivantes.
    download: {
      cacheRoot: path.resolve('.electron-cache'),
      checksums: {
        'electron-v43.2.0-linux-x64.zip':
          'f77ca6ed67bbc68702b69b56ad499bca6ae090705ade7d04f0ac545e409dec68'
      }
    },

    // Liste blanche : l'application n'embarque aucune dépendance d'exécution.
    ignore: (candidate: string): boolean => {
      if (candidate === '') return false

      const allowed = [
        /^\/dist($|\/)/,
        // `electron-updater` et ses dépendances de production sont requis par
        // les paquets Forge ; npm prune retire les dépendances de développement.
        /^\/node_modules($|\/)/,
        /^\/package\.json$/
      ]
      if (/\.js\.map$/.test(candidate)) return true

      return !allowed.some((pattern) => pattern.test(candidate))
    }
  },

  rebuildConfig: {},

  makers: [
    {
      name: '@electron-forge/maker-zip',
      config: {},
      platforms: ['linux']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Finder Team',
          homepage: 'https://github.com/slayercode1/Utilitaire-Ubuntu',
          description: 'Application de recherche type Spotlight pour Linux',
          categories: ['Utility'],
          section: 'utils',
          priority: 'optional',
          icon: './logo.png',
          scripts: {
            // Ne touche qu'au cache système d'icônes, jamais au HOME.
            postinst: 'postinst.sh'
          }
        }
      }
    }
  ],

  hooks: {
    postPackage: async (_config, results): Promise<void> => {
      if (results.platform !== 'linux') {
        throw new Error('Le durcissement des fuses est configuré pour Linux')
      }

      const keptLocales = new Set(['fr.pak', 'en-US.pak'])

      for (const outputPath of results.outputPaths) {
        const localesPath = path.join(outputPath, 'locales')

        let localeFiles: string[]
        try {
          localeFiles = await fs.readdir(localesPath)
        } catch {
          continue
        }

        let removed = 0
        for (const localeFile of localeFiles) {
          if (keptLocales.has(localeFile)) continue
          await fs.rm(path.join(localesPath, localeFile), { force: true })
          removed++
        }

        console.log(
          'locales : ' + removed + ' fichiers retirés, ' + keptLocales.size + ' conservés'
        )

        await normalizePackageModes(outputPath)
        await hardenAndVerifyElectron(path.join(outputPath, 'finder'))
      }
    }
  }
}

export default config
