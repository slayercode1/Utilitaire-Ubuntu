# Finder - Application Launcher for Linux

<p align="center">
  <img src="https://img.shields.io/badge/Electron-38.4.0-blue" alt="Electron">
  <img src="https://img.shields.io/badge/Platform-Linux-orange" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

Une application de recherche type **Spotlight** pour Linux, construite avec Electron. Finder permet de rechercher et lancer rapidement des applications, fichiers, et effectuer des calculs, le tout avec un simple raccourci clavier.

![Finder Demo](screenshot.png)

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

### 📜 Historique des recherches
- Stockage persistant des 5 dernières recherches
- Clic pour relancer directement l'application/fichier
- Suppression individuelle des entrées

### ⚡ Autres fonctionnalités
- Interface moderne et fluide
- Masquage automatique de la fenêtre (blur)
- Compteur d'éléments indexés

## 📦 Installation

### Installation rapide (utilisateurs)

**Pour Ubuntu/Debian :**

1. **Télécharger le fichier `.deb`** depuis les [releases](https://github.com/votre-nom/finder/releases)

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
- Node.js (v16 ou supérieur)
- npm ou yarn
- Linux (Ubuntu, Debian, Fedora, Arch, etc.)

#### Étapes

1. **Cloner le dépôt**
```bash
git clone https://github.com/votre-nom/finder.git
cd finder
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
- ✅ Configuration autostart (lancement automatique)
- ✅ Fichier .desktop pour le menu d'applications
- ✅ Toutes les dépendances

## 🎮 Utilisation

### Raccourci clavier
Appuyez sur **`Alt + Space`** pour ouvrir/fermer Finder

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

```
finder/
├── main.js              # Processus principal Electron
├── renderer.js          # Logique de l'interface utilisateur
├── preload.js           # Script de sécurité (contextBridge)
├── index.html           # Interface HTML/CSS
├── appScanner.js        # Scanner d'applications (.desktop)
├── fileScanner.js       # Scanner de fichiers (HOME)
├── iconFinder.js        # Recherche d'icônes système
├── package.json         # Configuration npm
└── README.md            # Documentation
```

### Modules principaux

#### `main.js`
- Gère le cycle de vie de l'application
- Crée la fenêtre sans bordure
- Enregistre le raccourci global `Alt+Space`
- Gère la communication IPC avec le renderer

#### `renderer.js`
- Interface utilisateur et logique de recherche
- Filtrage et affichage des résultats
- Gestion de l'historique et de la calculatrice
- Gestion des événements clavier

#### `appScanner.js`
- Parse les fichiers `.desktop` des applications
- Scanne `/usr/share/applications`, Snap, Flatpak
- Déduplique et trie les applications

#### `fileScanner.js`
- Indexe récursivement le répertoire HOME
- Filtre les dossiers système et caches
- Limite la profondeur à 4 niveaux pour la performance

## ⚙️ Configuration

### Modifier le raccourci clavier

Dans `main.js`, ligne 25 :
```javascript
const GLOBAL_SHORTCUT = 'Alt+Space'  // Changez ici
```

### Ajuster la profondeur de scan des fichiers

Dans `fileScanner.js`, ligne 76 :
```javascript
const MAX_SCAN_DEPTH = 4  // Augmentez pour scanner plus profond
```

### Limiter l'historique

Dans `renderer.js`, ligne 56 :
```javascript
if (searchHistory.length > 5) {  // Changez le nombre ici
```

## 🎨 Personnalisation

### Thème
Modifiez les couleurs dans `index.html` :
- Fond : `rgba(30, 30, 30, 0.95)`
- Sélection : `#4a9eff`
- Texte : `#ffffff`

### Position de la fenêtre
Dans `main.js`, ligne 22 :
```javascript
const WINDOW_TOP_POSITION = 0.15  // 15% du haut (0.0 - 1.0)
```

## 🐛 Débogage

### Activer les DevTools
Ajoutez dans `main.js` après `createWindow()` :
```javascript
win.webContents.openDevTools()
```

### Voir les logs
Les logs s'affichent dans le terminal où vous avez lancé `npm start`

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

- Inspiré par Spotlight (macOS) et Albert (Linux)
- Construit avec [Electron](https://www.electronjs.org/)
- Icônes générées avec SVG

## 📧 Contact

Pour toute question ou suggestion :
- Ouvrir une issue sur GitHub
- Contribuer via Pull Request

---

**Fait avec ❤️ pour la communauté Linux**
