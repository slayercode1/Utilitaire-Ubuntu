#!/bin/sh
# Ce script est conservé pour expliquer le changement aux anciens utilisateurs.
# Rendre setuid-root un binaire provenant de node_modules transformerait toute
# compromission du dépôt ou de npm en élévation locale de privilèges.

set -eu

echo "Aucune permission modifiée. Finder n'installe plus de binaire setuid depuis node_modules." >&2
echo "Utilisez les espaces de noms utilisateur du noyau ou un paquet Electron fourni par la distribution." >&2
exit 1
