/**
 * Finder - Emplacements standard du système
 *
 * Regroupe les répertoires définis par les spécifications freedesktop et par
 * les gestionnaires de paquets. Ils étaient auparavant redéclarés dans chaque
 * scanner, avec des replis divergents sur HOME : ajouter un emplacement
 * demandait de modifier trois fichiers, et une variable d'environnement absente
 * ne produisait pas le même comportement partout.
 */

import path from 'node:path'

/**
 * Répertoire personnel de l'utilisateur.
 *
 * Le repli sur une chaîne vide est délibéré : path.join l'accepte et produit un
 * chemin relatif qui n'existera pas, ce qui écarte simplement l'emplacement au
 * lieu de faire échouer le scan. USERPROFILE couvre Windows.
 */
export const HOME: string =
  process.env['HOME'] || process.env['USERPROFILE'] || ''

/**
 * Racines système contenant des données applicatives partagées.
 * Sert aussi de liste blanche pour la résolution des liens symboliques.
 */
export const SYSTEM_DATA_ROOTS: readonly string[] = Object.freeze([
  '/usr/share',
  '/usr/local/share',
  '/opt',
  '/var/lib/flatpak',
  '/var/lib/snapd'
])

/**
 * Répertoires contenant des fichiers .desktop, par ordre de priorité.
 * En cas de doublon, la première occurrence l'emporte : une entrée utilisateur
 * doit primer sur celle du système.
 */
export const DESKTOP_DIRS: readonly string[] = Object.freeze([
  path.join(HOME, '.local/share/applications'),
  '/usr/share/applications',
  '/usr/local/share/applications',
  '/var/lib/snapd/desktop/applications',
  '/var/lib/flatpak/exports/share/applications',
  path.join(HOME, '.local/share/flatpak/exports/share/applications')
])

/**
 * Racines des thèmes d'icônes, par ordre de priorité.
 */
export const ICON_THEME_DIRS: readonly string[] = Object.freeze([
  path.join(HOME, '.local/share/icons'),
  path.join(HOME, '.icons'),
  '/usr/share/icons',
  '/usr/local/share/icons',
  '/var/lib/snapd/desktop/icons',
  '/var/lib/flatpak/exports/share/icons'
])

/**
 * Répertoires où les icônes sont posées à plat, sans arborescence de thème.
 */
export const FLAT_ICON_DIRS: readonly string[] = Object.freeze([
  '/usr/share/pixmaps',
  '/usr/local/share/pixmaps',
  path.join(HOME, '.local/share/pixmaps')
])
