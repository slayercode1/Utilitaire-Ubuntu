# Site vitrine de Finder

Le site est statique et ne nécessite aucune étape de compilation.

## Prévisualisation locale

Depuis la racine du dépôt :

```bash
python3 -m http.server 4173 --directory docs
```

Puis ouvrir `http://localhost:4173`.

## Publication automatique

Le workflow `.github/workflows/pages.yml` publie automatiquement ce dossier sur
GitHub Pages à chaque modification de `docs/` poussée sur `main`. Il peut aussi
être lancé manuellement depuis l’onglet Actions.

Une seule activation est nécessaire dans le dépôt GitHub : dans **Settings →
Pages → Build and deployment**, sélectionner **GitHub Actions** comme source.

Les boutons de téléchargement interrogent l’API publique GitHub au chargement
pour cibler les artefacts `.deb` et `.AppImage` de la dernière release. Si l’API
n’est pas disponible, ils redirigent vers la page de la dernière release.
