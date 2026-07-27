#!/bin/sh
# Autorise le sandbox Chromium en développement, sans binaire setuid.
#
# Ubuntu 24.04+ restreint la création d'espaces de noms utilisateur non
# privilégiés (kernel.apparmor_restrict_unprivileged_userns=1). Chromium ne
# peut alors ni utiliser son sandbox par namespaces, ni retomber sur le
# binaire chrome-sandbox de node_modules, qui n'est pas setuid — et ne doit
# pas l'être : un binaire setuid-root réécrit par npm à chaque installation
# transformerait toute compromission du dépôt ou de npm en élévation locale
# de privilèges (voir fix-sandbox.sh).
#
# Ce script installe la solution recommandée par Ubuntu : un profil AppArmor
# qui autorise les user namespaces pour le binaire Electron de CE dépôt
# uniquement. À relancer seulement si le dépôt change d'emplacement.
#
# Usage : sudo scripts/setup-dev-sandbox.sh

set -eu

if [ "$(id -u)" -ne 0 ]; then
    echo "Ce script doit être lancé avec sudo : sudo $0" >&2
    exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/node_modules/electron/dist/electron"

if [ ! -x "$BIN" ]; then
    echo "Binaire Electron introuvable : $BIN" >&2
    echo "Lancez d'abord : npm install" >&2
    exit 1
fi

PROFILE=/etc/apparmor.d/electron-dev-finder

cat > "$PROFILE" <<EOF
abi <abi/4.0>,
include <tunables/global>

# Généré par scripts/setup-dev-sandbox.sh — autorise le binaire Electron de
# développement de Finder à créer des espaces de noms utilisateur, afin que
# Chromium utilise son sandbox par namespaces plutôt qu'un binaire setuid.
profile electron-dev-finder "$BIN" flags=(unconfined) {
  userns,
}
EOF

apparmor_parser -r "$PROFILE"

echo "Profil AppArmor installé et chargé : $PROFILE"
echo "Le sandbox Chromium fonctionne désormais en développement (npm start)."
