# Politique de sécurité

## Versions prises en charge

Seule la dernière version publiée reçoit les correctifs de sécurité.

## Signaler une vulnérabilité

N'ouvrez pas d'issue publique contenant une méthode d'exploitation ou des
données sensibles. Utilisez le formulaire **Security → Report a vulnerability**
du dépôt GitHub afin d'ouvrir un avis de sécurité privé.

Indiquez si possible la version, la distribution Linux, les prérequis, l'impact
observé et une reproduction minimale non destructive. Un accusé de réception
sera donné sous 72 heures. Les détails pourront être publiés après disponibilité
du correctif et coordination avec la personne ayant fait le signalement.

## Vérification d'une release

Les releases officielles sont produites exclusivement par le workflow
`.github/workflows/release.yml`. Elles comprennent `SHA256SUMS`, une signature
Sigstore sans clé longue durée et une attestation de provenance GitHub.

La clé privée n'est donc jamais stockée dans le dépôt : GitHub émet un jeton
OIDC à usage unique pour le workflow exécuté depuis `main`, et le certificat
est consigné dans le journal de transparence Sigstore.

Chaque push sur `main` produit une version Linux croissante, un AppImage, un
paquet Debian et `latest-linux.yml`. Finder vérifie périodiquement ces
métadonnées et l'empreinte SHA-512 de l'artefact avant de proposer son
installation.
