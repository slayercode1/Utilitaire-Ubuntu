#!/bin/sh
# Maintainer script : configure le sandbox, l'autostart de session et démarre
# l'application dans les sessions graphiques actives. Deux interdits demeurent :
# ne jamais déduire un utilisateur depuis SUDO_USER, ne jamais modifier un HOME.

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

# Autostart de session pour tous les utilisateurs, actif dès l'installation :
# le fichier appartient à root et vit dans /etc, aucun HOME n'est touché.
# L'entrée par utilisateur que l'application écrit à son premier lancement
# porte le même nom et prime sur celle-ci (résolution XDG) : pas de doublon.
install -d -m 0755 /etc/xdg/autostart
cat > /etc/xdg/autostart/finder.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=Finder
Comment=Application de recherche type Spotlight pour Linux
Exec=/opt/Finder/finder
Terminal=false
Categories=Utility;
StartupNotify=false
X-GNOME-Autostart-enabled=true
EOF
chmod 0644 /etc/xdg/autostart/finder.desktop

# Mise à niveau : l'instance déjà lancée exécute l'ancienne version, dont les
# fichiers viennent d'être remplacés sous ses pieds. Sans arrêt explicite, le
# lancement ci-dessous se heurterait à son verrou mono-instance et s'effacerait
# au profit de l'ancienne version, qui resterait active jusqu'au relog.
#
# Seuls les processus principaux sont visés (les processus Chromium portent
# --type=) et jamais un ancêtre de ce script : lorsque la mise à jour vient de
# l'updater intégré, c'est l'ancienne instance qui attend la fin de dpkg, et
# elle se relance d'elle-même une fois l'installation terminée.
is_ancestor() {
    current=$$
    while [ "$current" -gt 1 ] 2>/dev/null; do
        [ "$current" = "$1" ] && return 0
        # Champ 4 de /proc/PID/stat, lu après le nom de commande entre parenthèses
        current=$(sed 's/^.*) //' "/proc/$current/stat" 2>/dev/null | cut -d' ' -f2)
        [ -n "$current" ] || return 1
    done
    return 1
}

if [ "${1:-}" = "configure" ] && [ -n "${2:-}" ] && command -v pgrep >/dev/null 2>&1; then
    stopped=""
    for pid in $(pgrep -x finder 2>/dev/null || true); do
        case "$(readlink "/proc/$pid/exe" 2>/dev/null || true)" in
            /opt/Finder/finder | "/opt/Finder/finder (deleted)") ;;
            *) continue ;;
        esac
        if tr '\000' ' ' <"/proc/$pid/cmdline" 2>/dev/null | grep -q -- '--type='; then
            continue
        fi
        is_ancestor "$pid" && continue
        kill -TERM "$pid" 2>/dev/null && stopped="$stopped $pid"
    done

    # Le verrou mono-instance n'est libéré qu'à la sortie effective
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        alive=""
        for pid in $stopped; do
            kill -0 "$pid" 2>/dev/null && alive="$alive $pid"
        done
        [ -n "$alive" ] || break
        stopped=$alive
        sleep 0.5
    done
fi

# Démarrage immédiat dans chaque session graphique active, pour que le
# raccourci global réponde sans attendre un lancement manuel ni un relog.
# Le processus est confié au gestionnaire systemd de l'utilisateur concerné :
# il hérite du vrai environnement de session (DISPLAY, bus, type de session)
# et survit à la fin de dpkg. Si une instance tourne déjà (mise à niveau),
# le verrou mono-instance de l'application la réveille puis s'efface.
# Best-effort intégral : l'installation n'échoue jamais sur cette étape.
if command -v loginctl >/dev/null 2>&1 && command -v systemd-run >/dev/null 2>&1; then
    loginctl list-sessions --no-legend 2>/dev/null | while read -r session_id _uid user _rest; do
        [ -n "$user" ] || continue
        [ "$user" != "gdm" ] || continue
        [ "$user" != "root" ] || continue
        session_type=$(loginctl show-session "$session_id" --property Type --value 2>/dev/null || true)
        case "$session_type" in
            x11 | wayland)
                systemd-run --machine="$user"@.host --user --collect --no-block \
                    /opt/Finder/finder >/dev/null 2>&1 || true
                ;;
        esac
    done || true
fi

exit 0
