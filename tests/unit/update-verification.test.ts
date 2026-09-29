/**
 * Provenance des mises à jour : un paquet n'est accepté que si son empreinte
 * figure dans une liste SHA256SUMS dont la signature Sigstore est valide.
 *
 * La vérification cryptographique réelle (réseau, racine TUF) est injectée ;
 * ces tests couvrent chaque branche de décision.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  isListedPackage,
  parseChecksums,
  releaseAssetUrl,
  type UpdateVerificationDeps,
  verifyDownloadedUpdate
} from '../../src/main/services/update-verification.js'

// Contenu réel de la release v1.1.4
const DEB = '911e1b5eb59994a0aa031e6a43f2ce94263e7b280b36e640d937253f076c7d08'
const APPIMAGE = '2eae50eab1a285e944eebe6d20fd72839fda4f3cc80bc4a9fbbeca1ccc70544b'
const YML = '3fde93b45ec427fc60ce78c5d2eedbd7b1b5aefddfc2d0137883fed145adb6fd'
const SHA256SUMS = [
  `${DEB}  Finder-1.1.4-amd64.deb`,
  `${APPIMAGE}  Finder-1.1.4-x86_64.AppImage`,
  `${YML}  latest-linux.yml`,
  ''
].join('\n')

function deps(overrides: Partial<UpdateVerificationDeps> = {}): UpdateVerificationDeps {
  return {
    fetchReleaseAsset: vi.fn(async (_tag: string, name: string) =>
      Buffer.from(name === 'SHA256SUMS' ? SHA256SUMS : '{"bundle":true}')
    ),
    verifyBundle: vi.fn(async () => {}),
    hashFile: vi.fn(async () => DEB),
    ...overrides
  }
}

describe('parseChecksums', () => {
  it('lit le format sha256sum, espace ou astérisque', () => {
    const map = parseChecksums(`${DEB}  a.deb\n${APPIMAGE} *b.AppImage\nligne invalide\n`)
    expect(map.get(DEB)).toBe('a.deb')
    expect(map.get(APPIMAGE)).toBe('b.AppImage')
    expect(map.size).toBe(2)
  })
})

describe('isListedPackage', () => {
  const map = parseChecksums(SHA256SUMS)

  it('accepte un paquet .deb ou .AppImage listé', () => {
    expect(isListedPackage(map, DEB)).toBe(true)
    expect(isListedPackage(map, APPIMAGE.toUpperCase())).toBe(true)
  })

  it('refuse une empreinte listée qui n’est pas un paquet', () => {
    expect(isListedPackage(map, YML)).toBe(false)
  })

  it('refuse une empreinte absente', () => {
    expect(isListedPackage(map, 'f'.repeat(64))).toBe(false)
  })
})

describe('verifyDownloadedUpdate', () => {
  it('accepte un paquet signé et listé, en vérifiant la liste reçue', async () => {
    const d = deps()
    await expect(verifyDownloadedUpdate('1.1.4', '/tmp/update.deb', d)).resolves.toEqual({
      ok: true
    })
    expect(d.fetchReleaseAsset).toHaveBeenCalledWith('v1.1.4', 'SHA256SUMS')
    expect(d.verifyBundle).toHaveBeenCalledWith('{"bundle":true}', Buffer.from(SHA256SUMS))
  })

  it('refuse une signature invalide, même si l’empreinte est listée', async () => {
    const d = deps({
      verifyBundle: vi.fn(async () => {
        throw new Error('SIGNATURE_ERROR')
      })
    })
    await expect(verifyDownloadedUpdate('1.1.4', '/tmp/update.deb', d)).resolves.toEqual({
      ok: false,
      reason: 'bad-signature'
    })
    expect(d.hashFile).not.toHaveBeenCalled()
  })

  it('refuse un paquet dont l’empreinte n’est pas listée', async () => {
    const d = deps({ hashFile: vi.fn(async () => 'a'.repeat(64)) })
    await expect(verifyDownloadedUpdate('1.1.4', '/tmp/update.deb', d)).resolves.toEqual({
      ok: false,
      reason: 'not-listed'
    })
  })

  it('refuse quand les fichiers de signature sont inaccessibles', async () => {
    const d = deps({
      fetchReleaseAsset: vi.fn(async () => {
        throw new Error('HTTP 404')
      })
    })
    await expect(verifyDownloadedUpdate('1.1.4', '/tmp/update.deb', d)).resolves.toEqual({
      ok: false,
      reason: 'fetch-failed'
    })
  })

  it.each(['1.1', '1.1.4-beta', '../1.1.4', 'v1.1.4'])(
    'refuse une version mal formée (%s) sans accès réseau',
    async (version) => {
      const d = deps()
      await expect(verifyDownloadedUpdate(version, '/tmp/update.deb', d)).resolves.toEqual({
        ok: false,
        reason: 'invalid-version'
      })
      expect(d.fetchReleaseAsset).not.toHaveBeenCalled()
    }
  )
})

describe('releaseAssetUrl', () => {
  it('pointe vers le dépôt officiel', () => {
    expect(releaseAssetUrl('v1.1.4', 'SHA256SUMS')).toBe(
      'https://github.com/slayercode1/Utilitaire-Ubuntu/releases/download/v1.1.4/SHA256SUMS'
    )
  })
})
