#!/bin/bash
# Script de post-installation pour Finder

# Détecter l'utilisateur réel
if [ -n "$SUDO_USER" ]; then
    REAL_USER="$SUDO_USER"
    USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
else
    REAL_USER="$USER"
    USER_HOME="$HOME"
fi

# Installer l'icône dans les emplacements système
ICON_SIZES="256x256 128x128 64x64 48x48 32x32 16x16"
ICON_SOURCE="/usr/lib/finder/resources/logo.png"

# Si l'icône existe dans le package, l'installer
if [ -f "$ICON_SOURCE" ]; then
    # Installer dans /usr/share/pixmaps pour compatibilité maximale
    cp "$ICON_SOURCE" /usr/share/pixmaps/finder.png 2>/dev/null || true

    # Installer dans hicolor theme (standard)
    for size in $ICON_SIZES; do
        ICON_DIR="/usr/share/icons/hicolor/$size/apps"
        mkdir -p "$ICON_DIR"
        convert "$ICON_SOURCE" -resize $size "$ICON_DIR/finder.png" 2>/dev/null || cp "$ICON_SOURCE" "$ICON_DIR/finder.png" 2>/dev/null || true
    done

    # Mettre à jour le cache des icônes
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor 2>/dev/null || true
fi

# Créer le répertoire autostart si nécessaire
AUTOSTART_DIR="$USER_HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"
chown -R "$REAL_USER:$REAL_USER" "$USER_HOME/.config" 2>/dev/null || true

# Créer le fichier .desktop pour autostart
cat > "$AUTOSTART_DIR/finder.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=Finder
Comment=Application de recherche type Spotlight pour Linux
Exec=/usr/bin/finder
Icon=finder
Terminal=false
Categories=Utility;
StartupNotify=false
X-GNOME-Autostart-enabled=true
Hidden=false
NoDisplay=false
EOF

chown "$REAL_USER:$REAL_USER" "$AUTOSTART_DIR/finder.desktop"
chmod 644 "$AUTOSTART_DIR/finder.desktop"

# Créer un script one-shot qui lance l'app une seule fois
ONETIME_SCRIPT="$AUTOSTART_DIR/finder-first-launch.desktop"
cat > "$ONETIME_SCRIPT" << 'EOF'
[Desktop Entry]
Type=Application
Name=Finder First Launch
Exec=sh -c '/usr/bin/finder & rm ~/.config/autostart/finder-first-launch.desktop'
Icon=finder
Terminal=false
Categories=Utility;
StartupNotify=false
X-GNOME-Autostart-enabled=true
Hidden=true
NoDisplay=true
EOF

chown "$REAL_USER:$REAL_USER" "$ONETIME_SCRIPT"
chmod 644 "$ONETIME_SCRIPT"

# Essayer de lancer l'application immédiatement via at (si disponible)
if command -v at >/dev/null 2>&1 && [ "$REAL_USER" != "root" ]; then
    # Trouver le DISPLAY actif
    USER_DISPLAY=$(ps aux | grep "$REAL_USER" | grep -E 'Xorg|X11' | grep -oP ":\d+" | head -1)
    if [ -z "$USER_DISPLAY" ]; then
        USER_DISPLAY=":0"
    fi

    # Créer une tâche at pour lancer l'app dans 5 secondes
    echo "DISPLAY=$USER_DISPLAY XAUTHORITY=$USER_HOME/.Xauthority /usr/bin/finder" | at now + 5 seconds 2>/dev/null || true
fi

echo ""
echo "✅ Finder installé avec succès!"
echo ""
echo "   Configuration:"
echo "   • Auto-démarrage: activé ✓"
echo "   • Raccourci clavier: Alt+Space"
echo "   • Lancement automatique: dans quelques secondes..."
echo ""
echo "   Si l'application ne démarre pas automatiquement:"
echo "   → Tapez: finder"
echo ""

exit 0
