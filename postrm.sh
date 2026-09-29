#!/bin/sh
# Maintainer script : retire l'autostart de session posé par postinst.sh.
# Lors d'une mise à niveau, l'entrée est conservée : le postinst de la
# nouvelle version la réécrit aussitôt.

set -eu

case "${1:-}" in
    remove | purge)
        rm -f /etc/xdg/autostart/finder.desktop || true
        ;;
esac

exit 0
