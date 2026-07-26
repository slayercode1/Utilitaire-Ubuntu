#!/bin/sh
# Maintainer script volontairement minimal : ne jamais déduire un utilisateur
# depuis SUDO_USER, modifier son HOME, ni lancer une application depuis dpkg.

set -eu

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

exit 0
