/** Configuration de production Electron Forge. */

import fs from 'node:fs/promises'
import path from 'node:path'

import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import type { ForgeConfig } from '@electron-forge/shared-types'

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

  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,

      // Electron 43 expose neuf fuses ; @electron/fuses@1.8 n'en connaît que
      // huit, et Forge 7 impose cette branche v1 en dépendance de pair. Sans
      // cette option, l'empaquetage échoue. Le fuse non couvert conserve sa
      // valeur par défaut ; à réactiver dès que Forge acceptera la v2.
      strictlyRequireAllFuses: false,

      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      // Activer ce fuse impose de livrer un snapshot V8 propre au processus
      // principal ; sans ce fichier, Electron s'arrête au démarrage sur
      // « Error loading V8 startup snapshot file ».
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      // L'interface est chargée par file:// depuis l'archive asar : sans ces
      // privilèges, Electron échoue sur ERR_FILE_NOT_FOUND. Le risque reste
      // contenu — la fenêtre ne charge que ce document local, jamais de
      // contenu distant, et la navigation est verrouillée par la CSP.
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: true
    })
  ],

  hooks: {
    postPackage: async (_config, results): Promise<void> => {
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
          'locales : ' + removed + ' fichiers retirés, ' +
            keptLocales.size + ' conservés'
        )

        await normalizePackageModes(outputPath)
      }
    }
  }
}

export default config
