/**
 * Finder - Exécution des actions de paramètres système
 *
 * Une action est soit une fonction asynchrone (basculer le WiFi, couper le
 * son), soit une commande shell accompagnée de replis pour les environnements
 * de bureau autres que GNOME.
 *
 * Le lancement effectif est injecté, ce qui permet de vérifier la stratégie de
 * repli sans démarrer de processus.
 */

import type { RuntimeValue } from '../../shared/types.js'

/** Action attachée à un paramètre système. */
export interface SettingActionDefinition {
  id: string
  name?: string
  icon?: string
  /** Fonction à exécuter, ou commande shell principale. */
  command?: (() => Promise<RuntimeValue>) | string
  /** Repli pour un autre environnement de bureau. */
  commandAlt?: string
  /** Second repli. */
  commandAlt2?: string
}

/** Paramètre système et ses actions. */
export interface SettingDefinition {
  id?: string
  actions?: SettingActionDefinition[]
}

/** Dépendances nécessaires à l'exécution d'une action. */
export interface SettingActionDeps {
  parseArguments: (command: string) => string[]
  launch: (args: string[], description: string) => boolean
}

/** Motif d'échec d'une action. */
export type SettingActionFailure =
  | 'action-not-found'
  | 'action-failed'
  | 'no-command'
  | 'all-commands-failed'

/** Issue d'une exécution d'action. */
export type SettingActionOutcome =
  | { ok: true; result?: RuntimeValue }
  | { ok: false; reason: SettingActionFailure; result?: string }

/**
 * Sélectionne l'action demandée dans un paramètre.
 */
export function findAction(
  setting: SettingDefinition | null | undefined,
  actionId: string
): SettingActionDefinition | null {
  if (!setting || !Array.isArray(setting.actions)) return null

  return setting.actions.find((action) => action.id === actionId) ?? null
}

/**
 * Liste les commandes à tenter, de la principale aux replis.
 */
export function collectCommandCandidates(action: SettingActionDefinition): string[] {
  return [action.command, action.commandAlt, action.commandAlt2]
    .filter(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.trim().length > 0
    )
    .map((candidate) => candidate.trim())
}

/**
 * Exécute une action de paramètre système.
 *
 * Pour les commandes shell, les alternatives sont tentées jusqu'à ce qu'un
 * lancement aboutisse. Le résultat de `launch` est déterminant : sans lui, un
 * environnement dépourvu de gnome-control-center n'essaierait jamais les
 * variantes XFCE ou KDE.
 */
export async function executeSettingAction(
  setting: SettingDefinition | null | undefined,
  actionId: string,
  deps: SettingActionDeps
): Promise<SettingActionOutcome> {
  const action = findAction(setting, actionId)

  if (!action) {
    return { ok: false, reason: 'action-not-found' }
  }

  // Action programmée : bascule d'un état système
  if (typeof action.command === 'function') {
    try {
      const result = await action.command()
      return { ok: true, result }
    } catch {
      return {
        ok: false,
        reason: 'action-failed',
        result: 'Action programmée impossible'
      }
    }
  }

  const candidates = collectCommandCandidates(action)

  if (candidates.length === 0) {
    return { ok: false, reason: 'no-command' }
  }

  for (const command of candidates) {
    try {
      const args = deps.parseArguments(command)
      if (args.length === 0) continue

      if (deps.launch(args, 'Setting action')) {
        return { ok: true, result: command }
      }
    } catch {
      // Cette variante est indisponible : on passe à la suivante
    }
  }

  return { ok: false, reason: 'all-commands-failed' }
}
