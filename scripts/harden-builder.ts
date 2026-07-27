/** Durcit et vérifie les fuses des sorties produites par electron-builder. */

import path from 'node:path'
import type { AfterPackContext } from 'electron-builder'

async function hardenBuilder(context: AfterPackContext): Promise<void> {
  if (context.electronPlatformName !== 'linux') {
    throw new Error('Le durcissement electron-builder est configuré pour Linux')
  }

  // @electron/fuses 2 est ESM ; l'import dynamique garde ce hook CommonJS
  // compatible avec le chargeur de scripts electron-builder.
  const { flipFuses, FuseState, FuseV1Options, FuseVersion, getCurrentFuseWire } = await import(
    '@electron/fuses'
  )

  const config = {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    [FuseV1Options.WasmTrapHandlers]: true
  } as const

  const executablePath = path.join(context.appOutDir, 'finder')
  await flipFuses(executablePath, config)

  const actual = await getCurrentFuseWire(executablePath)
  for (const [rawOption, expected] of Object.entries(config)) {
    if (!/^\d+$/.test(rawOption)) continue

    const option = Number(rawOption) as (typeof FuseV1Options)[keyof typeof FuseV1Options]
    const expectedState = expected ? FuseState.ENABLE : FuseState.DISABLE
    if (actual[option] !== expectedState) {
      throw new Error(`Fuse ${FuseV1Options[option]} incorrecte après build`)
    }
  }
}

export = hardenBuilder
