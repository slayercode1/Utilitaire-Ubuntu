# Finder - Application Launcher for Linux

<p align="center">
  <img src="https://img.shields.io/badge/Electron-43.2.0-blue" alt="Electron">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6" alt="TypeScript">
  <img src="https://img.shields.io/badge/Platform-Linux-orange" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

Une application de recherche type **Spotlight** pour Linux, construite avec Electron. Finder permet de rechercher et lancer rapidement des applications, fichiers, et effectuer des calculs, le tout avec un simple raccourci clavier.

## 📸 Preview

<p align="center">
  <img src="preview.png" alt="Finder Preview" width="600">
</p>

## ✨ Fonctionnalités

### 🚀 Recherche d'applications
- Recherche instantanée dans toutes les applications installées
- Support des applications système, Snap et Flatpak
- Icônes natives des applications

### 📁 Recherche de fichiers
- Indexation du répertoire HOME (profondeur: 4 niveaux)
- Icônes personnalisées par type de fichier
- Preview des images directement dans les résultats
- Support de plus de 40 types de fichiers

### 🧮 Calculatrice intégrée
- Détection automatique des expressions mathématiques
- Support des opérations: `+`, `-`, `*`, `/`, `%`, `^` (puissance)
- Support des parenthèses pour l'ordre des opérations
- Copie automatique du résultat dans le presse-papier

### 🌐 Recherche Google
- Fallback automatique vers Google si aucun résultat local
- Ouverture dans le navigateur par défaut

### 🔎 Snippets de recherche avancée
- **`.`** : Rechercher uniquement les applications (ex: `.firefox`)
- **`?`** : Rechercher uniquement les fichiers et dossiers (ex: `?document`)
- **`??`** : Recherche directe sur Google (ex: `??recette de crêpes`)
- **`>`** : Exécuter une commande shell (ex: `>ls -la`)
- **`to`** : Conversions d'unités et devises (ex: `10$ to eur`, `100m to ft`)

### 📜 Historique des recherches
- Stockage persistant des 5 dernières recherches
- Clic pour relancer directement l'application/fichier
- Suppression individuelle des entrées

### ⚡ Autres fonctionnalités
- **Auto-démarrage** : Se lance automatiquement au démarrage de la session
- Interface moderne et fluide
- Masquage automatique de la fenêtre (blur)
- Compteur d'éléments indexés

## 📦 Installation

### Installation rapide (utilisateurs)

**Pour Ubuntu/Debian :**

1. **Télécharger le fichier `.deb`** depuis les [releases](https://github.com/slayercode1/Utilitaire-Ubuntu/releases)

2. **Installer le package** :
```bash
sudo dpkg -i finder_1.0.0_amd64.deb
```

3. **C'est tout !** 🎉
   - L'application se lance automatiquement en arrière-plan
   - Appuyez sur **`Alt + Space`** pour l'utiliser

**Désinstallation :**
```bash
sudo apt remove finder
```

---

### Installation pour développeurs

#### Prérequis
- Node.js (v20 ou supérieur)
- npm ou yarn
- Linux (Ubuntu, Debian, Fedora, Arch, etc.)

#### Étapes

1. **Cloner le dépôt**
```bash
git clone https://github.com/slayercode1/Utilitaire-Ubuntu.git
cd Utilitaire-Ubuntu
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Lancer en mode développement**
```bash
npm start
```

#### Construction de l'application

Pour créer un package distribuable :

```bash
# Créer un .deb (Debian/Ubuntu)
npm run make

# Les fichiers seront dans ./out/make/deb/x64/
```

**Le package .deb inclut :**
- ✅ L'application Finder
- ✅ Configuration autostart (lancement automatique au démarrage)
- ✅ Fichier .desktop pour le menu d'applications
- ✅ Toutes les dépendances

**Note sur l'auto-démarrage :**
L'application se configure automatiquement pour démarrer avec votre session Linux. Elle utilise le package `auto-launch` qui crée une entrée dans `~/.config/autostart/`. Aucune configuration manuelle n'est nécessaire.

## 🎮 Utilisation

### Raccourci clavier
Appuyez sur **`Alt + Space`** pour ouvrir/fermer Finder

En configuration multi-écrans, Finder s'ouvre sur l'écran où se trouve le
curseur, comme Spotlight sur macOS.

### Snippets de recherche

#### Applications uniquement (`.`)
```
.firefox     → Cherche uniquement dans les applications
.chrome
.code
```

#### Fichiers uniquement (`?`)
```
?document    → Cherche uniquement dans les fichiers/dossiers
?image
?projet
```

#### Recherche web (`??`)
```
??météo paris     → Recherche directement sur Google
??traduction bonjour en anglais
```

#### Commandes shell (`>`)
```
>ls -la           → Exécute la commande dans un terminal
>htop
>git status
```

#### Conversions (`to`)
```
# Devises
10$ to eur        → Convertit 10 dollars en euros
100€ to usd
50£ to eur

# Longueurs
100m to ft        → Convertit 100 mètres en pieds
5km to mi
10in to cm

# Poids
5kg to lb         → Convertit 5 kilos en livres
100g to oz

# Températures
20c to f          → Convertit 20°C en Fahrenheit
100f to c

# Volumes
5l to gal         → Convertit 5 litres en gallons
```

**Note :** Le résultat des conversions est automatiquement copié dans le presse-papier.

### Recherche
1. Tapez le nom d'une application, fichier, ou une expression mathématique
2. Utilisez les flèches **↑** et **↓** pour naviguer
3. Appuyez sur **Entrée** pour ouvrir/lancer
4. Appuyez sur **Échap** pour fermer

### Exemples

**Recherche d'applications :**
```
firefox
chrome
code
```

**Recherche de fichiers :**
```
document.pdf
photo.jpg
script.sh
```

**Calculs mathématiques :**
```
2+2           → 4
10*5          → 50
(5+3)*2       → 16
2^8           → 256
100/4         → 25
15%4          → 3
```

## 🏗️ Architecture du projet

Le projet est écrit intégralement en TypeScript. Les sources vivent dans `src/`
et sont compilées vers `dist/`, d'où Electron les charge.

```
finder/
├── src/
│   ├── main/                   # Processus principal
│   │   ├── index.ts            # Point d'entrée
│   │   ├── config.ts           # Constantes et chemins
│   │   ├── window.ts           # Fenêtre et positionnement multi-écrans
│   │   ├── lifecycle.ts        # Instance unique, démarrage automatique
│   │   ├── ipc/                # Handlers IPC (transport uniquement)
│   │   ├── services/           # Logique métier, sans Electron
│   │   └── scanners/           # Accès au système
│   ├── preload/index.ts        # Pont contextBridge
│   ├── renderer/               # Interface
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── features/conversion/
│   └── shared/                 # Contrats IPC, types, chemins
├── tests/unit/                 # 91 tests (Vitest)
└── scripts/                    # Outillage de build
```

### Frontières

Le renderer n'a accès à aucune API Node : sa configuration TypeScript ne déclare
aucun type Node, ce qui rend un `import fs` impossible à compiler. Tous les
échanges passent par `window.electronAPI`, défini par le preload.

Les scanners et les services ne dépendent pas d'Electron : ils sont vérifiables
sans lancer l'application.

## ⚙️ Configuration

### Raccourci clavier et dimensions

Dans `src/main/config.ts` :
```typescript
export const GLOBAL_SHORTCUT = 'Alt+Space'
export const WINDOW_TOP_POSITION = 0.15   // 15 % depuis le haut
```

### Profondeur de scan des fichiers

Dans `src/main/scanners/file-scanner.ts` :
```typescript
const MAX_SCAN_DEPTH = 4
```

### Emplacements système

Dans `src/shared/paths.ts` : répertoires `.desktop`, thèmes d'icônes et racines
autorisées, partagés par tous les scanners.

## 🎨 Personnalisation

Les couleurs, espacements et durées d'animation sont regroupés en variables CSS
au début de `src/renderer/index.html`.

## 🧪 Développement

```bash
npm start        # compile puis lance l'application
npm test         # 91 tests unitaires
npm run typecheck  # vérification de types (mode strict)
npm run verify   # typecheck + tests + build
npm run make     # paquets .deb et .zip
```

### Activer les DevTools

Dans `src/main/window.ts`, après la création de la fenêtre :
```typescript
win.webContents.openDevTools({ mode: 'detach' })
```

## 🔒 Confidentialité des données

Finder fonctionne **entièrement en local**. L'application ne comporte ni compte
utilisateur, ni serveur, ni télémétrie, ni collecteur de plantages, ni service
d'analyse d'usage. Aucune dépendance tierce de collecte n'est embarquée.

### Données conservées

| Donnée | Emplacement | Durée | Finalité |
|---|---|---|---|
| Historique de recherche (5 entrées) | Stockage local du navigateur | Jusqu'à effacement | Proposer les recherches récentes |
| Index des applications et fichiers | Mémoire vive uniquement | Durée de la session | Répondre aux recherches |
| Position du curseur | Non conservée | Instantanée | Ouvrir sur le bon écran |

L'index des fichiers ne quitte jamais la mémoire : il n'est écrit sur aucun
disque et disparaît à la fermeture.

### Seul flux sortant

La recherche web (préfixe `??`, ou absence de résultat local) ouvre votre
navigateur par défaut sur Google avec la requête saisie. **Elle n'est déclenchée
que par une action explicite.** L'URL est construite par le processus principal
à partir de la seule requête, jamais par l'interface.

Aucune autre donnée ne sort de votre poste.

### Effacer vos données

Appuyez sur **`Ctrl + Suppr`** dans la fenêtre de recherche. Après confirmation,
l'application supprime :

- l'historique de recherche ;
- les caches du moteur de rendu ;
- les artefacts créés par Chromium.

Vos fichiers personnels ne sont pas touchés.

À la fermeture, Finder retire par ailleurs les fichiers que Chromium crée sans
finalité pour cette application, dont un identifiant persistant du poste
(`Crashpad/client_id`).

### Journaux

Les messages affichés dans la console ne contiennent ni chemin de fichier, ni
requête, ni contenu de document. Ils ne sont écrits dans aucun fichier et ne
sont transmis nulle part.

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment contribuer :

1. Fork le projet
2. Créez votre branche (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

### Guidelines
- Code bien commenté et documenté
- Suivre les conventions de nommage existantes
- Tester sur différentes distributions Linux

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🙏 Remerciements

- Inspiré par Spotlight (macOS)
- Construit avec [Electron](https://www.electronjs.org/)
- Icônes générées avec SVG

## 📧 Contact

Pour toute question ou suggestion :
- Ouvrir une issue sur GitHub
- Contribuer via Pull Request

---

**Fait avec ❤️ pour la communauté Linux**
