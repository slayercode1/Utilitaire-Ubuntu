/**
 * Finder - Settings Scanner
 *
 * Ce module scanne et détecte les paramètres système disponibles
 * et fournit des actions rapides (WiFi, Bluetooth, Son, etc.)
 */

import { execFile } from 'node:child_process'
import util from 'node:util'

import type { SettingDefinition } from '../services/setting-actions.js'
import type { SerializedSetting } from '../../shared/types.js'
const execFileAsync = util.promisify(execFile)

/**
 * Liste des paramètres système avec leurs actions rapides
 */
const SYSTEM_SETTINGS = [
  {
    id: 'wifi',
    name: 'WiFi',
    keywords: ['wifi', 'wi-fi', 'réseau', 'network', 'internet', 'connexion', 'sans fil', 'wireless'],
    icon: '📶',
    actions: [
      {
        id: 'toggle',
        name: 'Activer/Désactiver',
        icon: '🔄',
        command: async () => {
          // Vérifier l'état actuel du WiFi
          try {
            const { stdout } = await execFileAsync('nmcli', ['radio', 'wifi'])
            const isEnabled = stdout.trim() === 'enabled'

            // Inverser l'état
            if (isEnabled) {
              await execFileAsync('nmcli', ['radio', 'wifi', 'off'])
              return 'WiFi désactivé'
            } else {
              await execFileAsync('nmcli', ['radio', 'wifi', 'on'])
              return 'WiFi activé'
            }
          } catch (error) {
            throw new Error('Impossible de changer l\'état du WiFi')
          }
        }
      },
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center wifi',
        commandAlt: 'xfce4-settings-manager', // Fallback pour XFCE
        commandAlt2: 'systemsettings5' // Fallback pour KDE
      }
    ]
  },
  {
    id: 'bluetooth',
    name: 'Bluetooth',
    keywords: ['bluetooth', 'bt', 'sans fil', 'wireless', 'appareil', 'device'],
    icon: '🔵',
    actions: [
      {
        id: 'toggle',
        name: 'Activer/Désactiver',
        icon: '🔄',
        command: async () => {
          try {
            const { stdout } = await execFileAsync('rfkill', ['list', 'bluetooth'])
            const isBlocked = stdout.includes('Soft blocked: yes')

            if (isBlocked) {
              await execFileAsync('rfkill', ['unblock', 'bluetooth'])
              return 'Bluetooth activé'
            } else {
              await execFileAsync('rfkill', ['block', 'bluetooth'])
              return 'Bluetooth désactivé'
            }
          } catch (error) {
            throw new Error('Impossible de changer l\'état du Bluetooth')
          }
        }
      },
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center bluetooth',
        commandAlt: 'blueman-manager',
        commandAlt2: 'blueberry'
      }
    ]
  },
  {
    id: 'sound',
    name: 'Son / Audio',
    keywords: ['son', 'audio', 'sound', 'volume', 'haut-parleur', 'speaker', 'micro', 'microphone'],
    icon: '🔊',
    actions: [
      {
        id: 'mute',
        name: 'Couper/Rétablir le son',
        icon: '🔇',
        command: async () => {
          try {
            await execFileAsync('pactl', ['set-sink-mute', '@DEFAULT_SINK@', 'toggle'])
            const { stdout } = await execFileAsync('pactl', ['get-sink-mute', '@DEFAULT_SINK@'])
            const isMuted = stdout.includes('yes')
            return isMuted ? 'Son coupé' : 'Son rétabli'
          } catch (error) {
            throw new Error('Impossible de modifier le son')
          }
        }
      },
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center sound',
        commandAlt: 'pavucontrol',
        commandAlt2: 'xfce4-pulseaudio-plugin'
      }
    ]
  },
  {
    id: 'display',
    name: 'Affichage / Écran',
    keywords: ['affichage', 'écran', 'display', 'screen', 'moniteur', 'monitor', 'résolution', 'resolution'],
    icon: '🖥️',
    actions: [
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center display',
        commandAlt: 'xfce4-display-settings',
        commandAlt2: 'arandr'
      }
    ]
  },
  {
    id: 'power',
    name: 'Alimentation / Batterie',
    keywords: ['alimentation', 'batterie', 'power', 'battery', 'énergie', 'energy'],
    icon: '🔋',
    actions: [
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center power',
        commandAlt: 'xfce4-power-manager-settings',
        commandAlt2: 'mate-power-preferences'
      }
    ]
  },
  {
    id: 'keyboard',
    name: 'Clavier',
    keywords: ['clavier', 'keyboard', 'raccourci', 'shortcut', 'touche', 'key'],
    icon: '⌨️',
    actions: [
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center keyboard',
        commandAlt: 'xfce4-keyboard-settings',
        commandAlt2: 'systemsettings5 kcm_keys'
      }
    ]
  },
  {
    id: 'mouse',
    name: 'Souris / Touchpad',
    keywords: ['souris', 'mouse', 'touchpad', 'pavé', 'trackpad', 'pointeur', 'pointer'],
    icon: '🖱️',
    actions: [
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center mouse',
        commandAlt: 'xfce4-mouse-settings',
        commandAlt2: 'systemsettings5 kcm_touchpad'
      }
    ]
  },
  {
    id: 'printers',
    name: 'Imprimantes',
    keywords: ['imprimante', 'printer', 'imprimer', 'print', 'scanner'],
    icon: '🖨️',
    actions: [
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center printers',
        commandAlt: 'system-config-printer',
        commandAlt2: 'xfce4-settings-manager'
      }
    ]
  },
  {
    id: 'users',
    name: 'Utilisateurs / Comptes',
    keywords: ['utilisateur', 'user', 'compte', 'account', 'profil', 'profile'],
    icon: '👤',
    actions: [
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center user-accounts',
        commandAlt: 'users-admin',
        commandAlt2: 'systemsettings5 kcm_users'
      }
    ]
  },
  {
    id: 'datetime',
    name: 'Date et Heure',
    keywords: ['date', 'heure', 'time', 'clock', 'horloge', 'fuseau', 'timezone'],
    icon: '🕐',
    actions: [
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center datetime',
        commandAlt: 'time-admin',
        commandAlt2: 'systemsettings5 kcm_clock'
      }
    ]
  },
  {
    id: 'privacy',
    name: 'Confidentialité',
    keywords: ['confidentialité', 'privacy', 'sécurité', 'security', 'données', 'data'],
    icon: '🔒',
    actions: [
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center privacy',
        commandAlt: 'xfce4-settings-manager',
        commandAlt2: 'systemsettings5'
      }
    ]
  },
  {
    id: 'appearance',
    name: 'Apparence / Thème',
    keywords: ['apparence', 'appearance', 'thème', 'theme', 'couleur', 'color', 'style'],
    icon: '🎨',
    actions: [
      {
        id: 'settings',
        name: 'Ouvrir les paramètres',
        icon: '⚙️',
        command: 'gnome-control-center background',
        commandAlt: 'xfce4-appearance-settings',
        commandAlt2: 'systemsettings5 kcm_lookandfeel'
      }
    ]
  }
]

/**
 * Recherche dans les paramètres système
 * @param {string} query - Requête de recherche
 * @returns {object[]} Paramètres correspondants
 */
/**
 * Sérialise un paramètre pour l'envoyer via IPC (enlève les fonctions)
 */
function serializeSetting(
  setting: SettingDefinition & {
    id: string
    name: string
    keywords: string[]
    icon: string
  }
): Omit<SerializedSetting, 'score'> {
  return {
    id: setting.id,
    name: setting.name,
    keywords: setting.keywords,
    icon: setting.icon,
    resultType: 'setting',
    // Sérialiser les actions en enlevant les fonctions
    actions: (setting.actions ?? []).map((action) => ({
      id: action.id,
      // Le contrat IPC impose ces champs : un libellé absent deviendrait
      // "undefined" à l'affichage plutôt qu'une chaîne vide.
      name: action.name ?? '',
      icon: action.icon ?? ''
      // command est géré côté main process, pas besoin de l'envoyer
    }))
  }
}

/**
 * Index de recherche préparé une seule fois au chargement du module.
 *
 * searchSettings est appelée à chaque frappe de l'utilisateur ; refaire les
 * toLowerCase() et reconstruire les objets sérialisés à chaque appel est un
 * travail répété inutilement. Les formes minuscules et la version sérialisée
 * sont donc calculées d'avance.
 */
const SETTINGS_INDEX = SYSTEM_SETTINGS.map(setting => ({
  setting,
  serialized: serializeSetting(setting),
  lowerName: setting.name.toLowerCase(),
  lowerKeywords: setting.keywords.map(k => k.toLowerCase())
}))

/**
 * Recherche dans les paramètres système
 * @param {string} query - Requête de recherche
 * @returns {object[]} Paramètres correspondants, triés par pertinence
 */
function searchSettings(query: string): SerializedSetting[] {
  // Si pas de requête, retourner tous les paramètres
  if (!query || query.trim().length === 0) {
    return SETTINGS_INDEX.map(entry => ({ ...entry.serialized, score: 0 }))
  }

  const lowerQuery = query.toLowerCase().trim()
  const results = []

  for (const entry of SETTINGS_INDEX) {
    const matchesName = entry.lowerName.includes(lowerQuery)

    let matchesKeywords = false
    let matchesPrefix = false

    for (const keyword of entry.lowerKeywords) {
      if (keyword.startsWith(lowerQuery)) {
        matchesPrefix = true
        matchesKeywords = true
        break
      }

      if (!matchesKeywords &&
          (keyword.includes(lowerQuery) || lowerQuery.includes(keyword))) {
        matchesKeywords = true
      }
    }

    if (!matchesName && !matchesKeywords) continue

    // Calculer un score de pertinence
    let score = 0
    if (matchesName) score += 10
    if (matchesKeywords) score += 5

    // Bonus si la requête est exactement le début d'un mot-clé
    if (matchesPrefix) score += 15

    results.push({ ...entry.serialized, score })
  }

  // Trier par score de pertinence
  results.sort((a, b) => b.score - a.score)

  return results
}

/**
 * Récupère un paramètre par son ID
 * @param {string} settingId - ID du paramètre
 * @returns {Object|null} Paramètre trouvé ou null
 */
function getSettingById(settingId: string): SettingDefinition | null {
  return SYSTEM_SETTINGS.find(s => s.id === settingId) || null
}

/**
 * Vérifie l'état actuel d'un paramètre (pour les toggles)
 * @param {string} settingId - ID du paramètre
 * @returns {Promise<boolean>} true si activé, false sinon
 */
async function getSettingState(settingId: string): Promise<boolean> {
  try {
    switch (settingId) {
      case 'wifi':
        const { stdout: wifiState } = await execFileAsync('nmcli', ['radio', 'wifi'])
        return wifiState.trim() === 'enabled'

      case 'bluetooth':
        const { stdout: btState } = await execFileAsync('rfkill', ['list', 'bluetooth'])
        return !btState.includes('Soft blocked: yes')

      case 'sound':
        const { stdout: soundState } = await execFileAsync('pactl', ['get-sink-mute', '@DEFAULT_SINK@'])
        return !soundState.includes('yes') // true si pas muted

      default:
        return false
    }
  } catch (error) {
    console.error(`Error checking state for ${settingId}:`, error)
    return false
  }
}

export {
  searchSettings,
  getSettingById,
  getSettingState,
  SYSTEM_SETTINGS
}
