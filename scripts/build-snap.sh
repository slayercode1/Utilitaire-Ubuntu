#!/bin/sh
# Construit le snap de Finder à partir du paquet durci produit par
# `npm run package` (electron-builder --dir, fuses vérifiées).
#
# Le template snap d'electron-builder n'est pas utilisé : pour la base core22,
# il copiait l'archive du template au lieu de l'extraire, et le snap produit
# appelait un script de démarrage absent. Ses scripts exportaient en outre
# XDG_CONFIG_HOME et consorts vers ~/snap/…, que chaque application lancée
# par Finder aurait hérités. Le snap est ici assemblé directement et empaqueté
# par `snap pack`, sans snapcraft ni conteneur de build.
#
# Usage : sh scripts/build-snap.sh   (SNAP_NAME=autre-nom pour un autre nom)

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
UNPACKED="$ROOT/out/builder/linux-unpacked"
OUT="$ROOT/out/snap"
PRIME="$OUT/prime"

NAME=${SNAP_NAME:-finder}
VERSION=$(node -p "require('$ROOT/package.json').version")

if [ ! -x "$UNPACKED/finder" ]; then
    echo "Paquet absent : lancez d'abord npm run package" >&2
    exit 1
fi

rm -rf "$PRIME"
mkdir -p "$PRIME/meta/gui" "$PRIME/bin"

# Application durcie. chrome-sandbox est retiré : un snap ne peut pas livrer
# de binaire setuid, et sans le bit setuid il ne sert à rien.
cp -a "$UNPACKED/." "$PRIME/"
rm -f "$PRIME/chrome-sandbox"
# Le Store distribue les mises à jour : le client intégré n'a rien à faire ici
rm -f "$PRIME/resources/app-update.yml"

# Lanceur. Ubuntu 23.10+ interdit les espaces de noms utilisateur aux
# processus sans profil AppArmor dédié : sans assistant setuid, Chromium n'a
# alors aucun sandbox utilisable et refuse de démarrer (« No usable
# sandbox »). --no-sandbox n'est passé que dans ce cas ; ailleurs, le sandbox
# par espaces de noms reste actif.
cat >"$PRIME/bin/launch" <<'EOF'
#!/bin/sh
restricted=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 0)
cloneable=$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1)
if [ "$restricted" = 1 ] || [ "$cloneable" = 0 ]; then
    exec "$SNAP/finder" --no-sandbox "$@"
fi
exec "$SNAP/finder" "$@"
EOF
chmod 0755 "$PRIME/bin/launch"

cat >"$PRIME/meta/snap.yaml" <<EOF
name: $NAME
version: '$VERSION'
title: Finder
summary: Recherche instantanée d'applications et de fichiers, façon Spotlight
description: |
  Finder est un lanceur de type Spotlight pour Linux. Alt+Espace ouvre une
  barre de recherche qui trouve instantanément applications, fichiers,
  dossiers et paramètres système.

  - Lance n'importe quelle application installée (deb, snap, Flatpak)
  - Retrouve fichiers et dossiers du répertoire personnel
  - Calculatrice et conversions d'unités intégrées
  - Bascule WiFi, Bluetooth et son en un geste
  - Exécute une commande dans un terminal, après confirmation

  Aucune donnée ne quitte la machine : pas de compte, pas de télémétrie.
license: Proprietary
base: core24
grade: stable
confinement: classic
architectures:
  - amd64
apps:
  $NAME:
    command: bin/launch
EOF

cp "$ROOT/icons/256x256.png" "$PRIME/meta/gui/icon.png"

cat >"$PRIME/meta/gui/$NAME.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Finder
Comment=Recherche instantanée d'applications et de fichiers
Exec=$NAME
Icon=\${SNAP}/meta/gui/icon.png
Terminal=false
Categories=Utility;
StartupWMClass=finder
EOF

snap pack "$PRIME" "$OUT" --filename="${NAME}_${VERSION}_amd64.snap"
