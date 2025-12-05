/**
 * Finder - Settings Scanner
 *
 * Ce module scanne et détecte les paramètres système disponibles
 * et fournit des actions rapides (WiFi, Bluetooth, Son, etc.)
 */

const { execFile } = require('child_process')
const util = require('util')
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
 * @returns {Array} Liste des paramètres correspondants
 */
/**
 * Sérialise un paramètre pour l'envoyer via IPC (enlève les fonctions)
 */
function serializeSetting(setting) {
  return {
    id: setting.id,
    name: setting.name,
    keywords: setting.keywords,
    icon: setting.icon,
    resultType: 'setting',
    // Sérialiser les actions en enlevant les fonctions
    actions: setting.actions.map(action => ({
      id: action.id,
      name: action.name,
      icon: action.icon
      // command est géré côté main process, pas besoin de l'envoyer
    }))
  }
}

function searchSettings(query) {
  // Si pas de requête, retourner tous les paramètres
  if (!query || query.trim().length === 0) {
    return SYSTEM_SETTINGS.map(setting => ({
      ...serializeSetting(setting),
      score: 0
    }))
  }

  const lowerQuery = query.toLowerCase().trim()
  const results = []

  for (const setting of SYSTEM_SETTINGS) {
    // Vérifier si la requête correspond au nom ou aux mots-clés
    const matchesName = setting.name.toLowerCase().includes(lowerQuery)
    const matchesKeywords = setting.keywords.some(keyword =>
      keyword.toLowerCase().includes(lowerQuery) ||
      lowerQuery.includes(keyword.toLowerCase())
    )

    if (matchesName || matchesKeywords) {
      // Calculer un score de pertinence
      let score = 0
      if (matchesName) score += 10
      if (matchesKeywords) score += 5

      // Bonus si la requête est exactement le début d'un mot-clé
      if (setting.keywords.some(kw => kw.toLowerCase().startsWith(lowerQuery))) {
        score += 15
      }

      results.push({
        ...serializeSetting(setting),
        score
      })
    }
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
function getSettingById(settingId) {
  return SYSTEM_SETTINGS.find(s => s.id === settingId) || null
}

/**
 * Vérifie l'état actuel d'un paramètre (pour les toggles)
 * @param {string} settingId - ID du paramètre
 * @returns {Promise<boolean>} true si activé, false sinon
 */
async function getSettingState(settingId) {
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

module.exports = {
  searchSettings,
  getSettingById,
  getSettingState,
  SYSTEM_SETTINGS
}
