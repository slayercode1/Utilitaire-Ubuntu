# Contribuer à Finder

Merci de votre intérêt ! Le code est **source disponible** : vous pouvez le
lire, le compiler et proposer des contributions au dépôt d'origine. La
redistribution et l'usage commercial restent réservés — voir [LICENSE](LICENSE).
En soumettant une contribution, vous acceptez la section 3 de la licence.

## Mise en route

```bash
npm install        # installe aussi les hooks git (husky) via "prepare"
npm start          # build + lancement de l'application
```

Prérequis : Node.js ≥ 23, une session Linux (X11 recommandé pour le
raccourci global).

**Sandbox Chromium (une fois par machine)** — Ubuntu 24.04+ restreint les
user namespaces non privilégiés ; sans réglage, `npm start` s'arrête sur
« The SUID sandbox helper binary was found, but is not configured
correctly ». Ne faites PAS de `chmod 4755` sur `node_modules` : installez le
profil AppArmor dédié, qui survit aux `npm install` :

```bash
sudo scripts/setup-dev-sandbox.sh
```

## Qualité : ce que les hooks vérifient pour vous

| Hook         | Ce qu'il fait                                                        |
| ------------ | -------------------------------------------------------------------- |
| `pre-commit` | Biome (format + lint) sur les fichiers indexés, via lint-staged       |
| `commit-msg` | Message au format [Conventional Commits](https://www.conventionalcommits.org/fr/) (`feat:`, `fix:`, `docs:`…) |
| `pre-push`   | `npm run typecheck` + `npm run test:unit`                             |

À lancer manuellement avant une PR conséquente :

```bash
npm run lint       # biome check .
npm run verify     # typecheck + tests unitaires + build
npm run test:all   # + E2E Playwright + régression visuelle
```

## Style

Le style est entièrement défini par [biome.json](biome.json) (2 espaces,
guillemets simples, pas de point-virgule) — `npm run lint:fix` applique tout.
Les commentaires expliquent le *pourquoi*, jamais le *quoi* ; ils sont en
français, comme le reste du projet.

## Tests

- **Unitaires** (`tests/unit`, Vitest) : logique pure uniquement, pas
  d'Electron ni de DOM. Tout nouveau service doit arriver testé.
- **E2E** (`tests/e2e`, Playwright) : lancent la vraie application avec un
  profil jetable. Aucun test ne doit déclencher d'effet de bord système
  (lancement d'app, bascule WiFi, commande shell).
- **Régression** (`npm run test:regression`) : les captures de référence ne
  se mettent à jour que volontairement via `test:regression:update`.

## Sécurité

Toute donnée traversant l'IPC est non fiable tant qu'elle n'a pas été
validée côté main. Ne contournez jamais `validation.ts`, la CSP, ni la
liste des ressources du protocole `finder-app://`. Vulnérabilité présumée :
signalez-la en privé à compte.professionel@outlook.com plutôt que par issue
publique.
