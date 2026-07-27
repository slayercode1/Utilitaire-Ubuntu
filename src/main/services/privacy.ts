/**
 * Finder - Minimisation des données locales
 *
 * L'application ne comporte ni compte, ni serveur, ni télémétrie : le seul
 * traitement de données personnelles est local. Chromium installe pourtant, de
 * lui-même, des artefacts destinés à des applications connectées.
 *
 * Ce module les retire, en application du principe de minimisation
 * (article 5.1.c du RGPD) et de la protection des données par défaut
 * (article 25.2).
 */

import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

/**
 * Artefacts créés par Chromium sans finalité pour cette application.
 *
 * - `Crashpad/client_id` identifie durablement l'installation. Le collecteur
 *   n'a aucun serveur configuré (`getUploadToServer()` retourne `false`) : cet
 *   identifiant n'est donc jamais transmis, mais il n'a pas non plus de raison
 *   d'exister.
 * - `DIPS` recense les sites visités pour la détection de suivi inter-sites ;
 *   Finder ne charge qu'un document local.
 * - Les répertoires de cookies et de stockage réseau restent vides faute de
 *   navigation, mais sont recréés à chaque démarrage.
 */
const ARTEFACTS_INUTILES: readonly string[] = [
  'Crashpad',
  'DIPS',
  'DIPS-wal',
  'Network Persistent State',
  'Cookies',
  'Cookies-journal',
  'TransportSecurity',
  'SharedStorage',
  'Trust Tokens',
  'Trust Tokens-journal'
]

/**
 * Supprime les artefacts sans finalité du répertoire de données utilisateur.
 *
 * Appelé au démarrage, avant l'initialisation de Chromium : il retire ceux de
 * la session précédente, alors qu'aucun descripteur n'est ouvert. Les faire
 * disparaître à la fermeture reviendrait à les retirer pendant que le moteur
 * s'arrête, ce qui rompt son propre arrêt.
 *
 * @returns Nombre d'artefacts effectivement retirés
 */
export function purgeUnusedArtifacts(): number {
  let racine: string

  try {
    racine = app.getPath('userData')
  } catch {
    // Appelé hors d'un contexte Electron initialisé
    return 0
  }

  let retires = 0

  for (const artefact of ARTEFACTS_INUTILES) {
    const cible = path.join(racine, artefact)

    try {
      if (!fs.existsSync(cible)) continue

      fs.rmSync(cible, { recursive: true, force: true })
      retires++
    } catch {
      // Fichier verrouillé ou déjà supprimé : sans conséquence
    }
  }

  return retires
}

/**
 * Efface l'intégralité des données conservées localement.
 *
 * Sert de point d'entrée au droit à l'effacement (article 17) : historique de
 * recherche, caches de Chromium et artefacts. L'index des applications et des
 * fichiers ne vit qu'en mémoire et disparaît avec le processus.
 *
 * @returns Chemins des emplacements effacés
 */
export function eraseLocalData(): string[] {
  const efface: string[] = []

  let racine: string
  try {
    racine = app.getPath('userData')
  } catch {
    return efface
  }

  // Le stockage local du renderer contient l'historique de recherche
  const emplacements = [
    'Local Storage',
    'Session Storage',
    'IndexedDB',
    'Cache',
    'Code Cache',
    'GPUCache',
    'blob_storage',
    ...ARTEFACTS_INUTILES
  ]

  for (const emplacement of emplacements) {
    const cible = path.join(racine, emplacement)

    try {
      if (!fs.existsSync(cible)) continue

      fs.rmSync(cible, { recursive: true, force: true })
      efface.push(emplacement)
    } catch {
      // Emplacement verrouillé : signalé par son absence de la liste
    }
  }

  return efface
}
