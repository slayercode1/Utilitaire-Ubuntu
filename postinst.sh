#!/bin/sh
# Maintainer script volontairement minimal : ne jamais déduire un utilisateur
# depuis SUDO_USER, modifier son HOME, ni lancer une application depuis dpkg.

set -eu

# Le sandbox Chromium exige son assistant setuid-root lorsque le noyau
# restreint les user namespaces non privilégiés (Ubuntu 24.04+). Ce fichier
# est installé par dpkg, appartient à root et vit dans un répertoire non
# modifiable par l'utilisateur : le setuid y est sûr et standard — c'est le
# réglage qu'appliquait le script post-installation par défaut
# d'electron-builder, que ce script remplace.
if [ -e /opt/Finder/chrome-sandbox ]; then
    chmod 4755 /opt/Finder/chrome-sandbox || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

exit 0
