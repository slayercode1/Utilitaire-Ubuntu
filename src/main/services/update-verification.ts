/**
 * Finder - Vérification de provenance des mises à jour
 *
 * electron-updater contrôle l'empreinte SHA-512 annoncée par `latest-linux.yml`,
 * mais ce fichier vient de la même release GitHub que le paquet : un compte ou
 * un jeton compromis pourrait publier les deux. La CI signe en revanche la
 * liste `SHA256SUMS` avec Sigstore, par une identité OIDC propre au workflow
 * de release. Un paquet n'est installé que si son empreinte figure dans une
 * liste dont cette signature est valide.
 *
 * Les accès réseau et la vérification cryptographique sont injectés : la
 * logique de décision reste testable sans réseau.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** Dépôt dont les releases sont signées par le workflow `release.yml`. */
const RELEASE_REPOSITORY = 'slayercode1/Utilitaire-Ubuntu'

/** Émetteur OIDC des jetons GitHub Actions. */
export const RELEASE_CERTIFICATE_ISSUER = 'https://token.actions.githubusercontent.com'

/**
 * Identité exacte du signataire : le workflow de release, sur `main`.
 * Motif ancré : sigstore l'applique comme expression régulière.
 */
export const RELEASE_CERTIFICATE_IDENTITY =
  '^https://github\\.com/slayercode1/Utilitaire-Ubuntu/\\.github/workflows/release\\.yml@refs/heads/main$'

/** Empreinte hexadécimale SHA-256. */
const SHA256_HEX = /^[0-9a-f]{64}$/

/** Taille maximale acceptée pour les fichiers de signature, en octets. */
export const MAX_METADATA_BYTES = 1024 * 1024

/** Dépendances d'accès au réseau et à la cryptographie Sigstore. */
export interface UpdateVerificationDeps {
  /** Télécharge un fichier de la release et retourne son contenu. */
  fetchReleaseAsset: (tag: string, name: string) => Promise<Buffer>
  /** Vérifie la signature Sigstore de `payload` ; lève une erreur si invalide. */
  verifyBundle: (bundle: string, payload: Buffer) => Promise<void>
  /** Empreinte SHA-256 du paquet téléchargé. */
  hashFile: (filePath: string) => Promise<string>
}

/** Issue d'une vérification. */
export type UpdateVerificationOutcome =
  | { ok: true }
  | {
      ok: false
      reason: 'invalid-version' | 'fetch-failed' | 'bad-signature' | 'not-listed'
    }

/** Lit un fichier `sha256sum` : empreinte → nom de fichier. */
export function parseChecksums(content: string): Map<string, string> {
  const entries = new Map<string, string>()

  for (const line of content.split('\n')) {
    // Format sha256sum : empreinte, deux caractères (espace + mode), nom
    const match = line.trim().match(/^([0-9a-fA-F]{64}) [ *](.+)$/)
    if (match?.[1] && match[2]) entries.set(match[1].toLowerCase(), match[2])
  }

  return entries
}

/** Vrai si l'empreinte désigne un paquet installable de la liste signée. */
export function isListedPackage(checksums: Map<string, string>, sha256: string): boolean {
  const name = checksums.get(sha256.toLowerCase())
  return name !== undefined && /\.(deb|AppImage)$/.test(name) && path.basename(name) === name
}

/**
 * Vérifie qu'un paquet téléchargé appartient à la release signée `version`.
 */
export async function verifyDownloadedUpdate(
  version: string,
  downloadedFile: string,
  deps: UpdateVerificationDeps
): Promise<UpdateVerificationOutcome> {
  // La version compose une URL : seule une forme semver simple est admise.
  if (!/^\d+\.\d+\.\d+$/.test(version)) return { ok: false, reason: 'invalid-version' }

  const tag = `v${version}`

  let checksums: Buffer
  let bundle: Buffer
  try {
    ;[checksums, bundle] = await Promise.all([
      deps.fetchReleaseAsset(tag, 'SHA256SUMS'),
      deps.fetchReleaseAsset(tag, 'SHA256SUMS.sigstore.json')
    ])
  } catch {
    return { ok: false, reason: 'fetch-failed' }
  }

  try {
    await deps.verifyBundle(bundle.toString('utf8'), checksums)
  } catch {
    return { ok: false, reason: 'bad-signature' }
  }

  let digest: string
  try {
    digest = await deps.hashFile(downloadedFile)
  } catch {
    return { ok: false, reason: 'not-listed' }
  }

  if (!SHA256_HEX.test(digest)) return { ok: false, reason: 'not-listed' }

  return isListedPackage(parseChecksums(checksums.toString('utf8')), digest)
    ? { ok: true }
    : { ok: false, reason: 'not-listed' }
}

/** Empreinte SHA-256 d'un fichier, lue en flux. */
export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')))
  })
}

/** URL d'un fichier publié dans une release. */
export function releaseAssetUrl(tag: string, name: string): string {
  return `https://github.com/${RELEASE_REPOSITORY}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`
}
