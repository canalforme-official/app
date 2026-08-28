# Planning HTML — minification + historique GitHub (plus tard)

**Statut :** `[ ]` planifié — **ne pas faire avant validation store 7.2.0**  
**Validation :** Yassine  
**Décision août 2026 :** minification oui · obfuscation agressive non · purge historique GitHub oui (même chantier)

**Index :** [frontend/README.md](./README.md) · [FUTURE_PLANNING_PRODUCT_PLAN.md](../backend/planning-service/FUTURE_PLANNING_PRODUCT_PLAN.md) · [FUTURE_SECURITY_AND_OPS_PLAN.md](../../../CanalFormeAPP/FUTURE_SECURITY_AND_OPS_PLAN.md) · [FUTURE_PRODUCT_BACKLOG.md](../../../CanalFormeAPP/FUTURE_PRODUCT_BACKLOG.md)

---

## Objectif

1. **Minifier** HTML / CSS / JS planning avant publication sur **github.io** (fichiers plus légers, WebView plus rapide).
2. **Purger l’historique Git** des dépôts publics pour qu’on ne puisse plus remonter aux **anciennes versions lisibles** du code (commits, diffs, « View file history »).
3. **(Lot associé, plus tard)** Servir `planning-v2.json` via l’API Cloud Run + App Check au lieu du raw GitHub public — voir palier 1 [FUTURE_PLANNING_PRODUCT_PLAN.md](../backend/planning-service/FUTURE_PLANNING_PRODUCT_PLAN.md) (`GET /api/planning/v2`).

> **Ce n’est pas une vraie protection.** Un utilisateur de l’app peut toujours lire le HTML/JSON en transit. L’objectif = **ralentir la copie casual** et **ne plus exposer tout l’historique** des sources.

---

## Ce qu’on ne fait PAS

| Mesure | Raison |
|--------|--------|
| Obfuscation JS (DOM reconstruit, `_0x…`, Base64 partout) | Bugs WebView, maintenance impossible, gain quasi nul |
| Minifier le JSON planning | Inutile ; la protection JSON = API + auth, pas compression |
| Minifier les SVG (`planning-icons.svg`) | Risque de casser les références `#id` |

Aligné [FUTURE_SECURITY_AND_OPS_PLAN.md](../../../CanalFormeAPP/FUTURE_SECURITY_AND_OPS_PLAN.md) § « Ce qu’on ne fait PAS ».

---

## Dépôts concernés

| Dépôt GitHub | Rôle | Purge historique ? |
|--------------|------|-------------------|
| `canalforme-official/app` | Pages HTML/CSS/JS → **github.io/app** | **Oui** — priorité |
| `canalforme-official/app-data` | JSON public (`planning-v2.json`, leaderboards…) | **Oui** si on garde GitHub ; **sinon** migrer vers CF + bucket privé et ne publier que le miroir minimal |
| Monorepo local `CanalForme-DB-API-APP` | Sources de travail (agents, app, backend) | **Non** — garder l’historique dev ici |

---

## Architecture cible (build)

```
Planning et Myzone/frontend/     ← sources lisibles (édition, agents)
        │
        │  npm run build:planning
        ▼
Planning et Myzone/frontend/dist/  ← artefact minifié (seul contenu poussé vers canalforme-official/app)
```

### Fichiers à minifier

| Type | Fichiers |
|------|----------|
| HTML | `daily.html`, `daily_grid.html`, `daily_matrix.html`, `weekly*.html`, `horaires.html`, `myzone-*.html`, `palmares-myzone.html`, `prayer-times.html`, `components/*.html` |
| CSS | `planning-tokens.css`, `planning-embedded.css` + blocs `<style>` inline dans les HTML |
| JS | `planning-resolve.js`, `weekly-vertical-inline.js`, `leaderboard-avatars.js` |

### Fichiers copiés tels quels (dist)

- `svg/planning-icons.svg`
- Assets images référencés
- **Ne pas** déployer de copie locale `Planning-v2.json` si prod = `app-data` (déjà le cas)

### Outils suggérés (au choix, une stack suffit)

- **HTML :** `html-minifier-terser` (ou `vite build` mode statique)
- **CSS :** `clean-css`
- **JS :** `terser` ou `esbuild` (**minify only**, pas `javascript-obfuscator`)

### Script npm (à créer au moment du chantier)

Emplacement proposé : `Planning et Myzone/frontend/package.json` + `scripts/build-planning.mjs`

Commande cible :

```bash
cd "Planning et Myzone/frontend" && npm run build:planning
```

Sortie : dossier `dist/` prêt à copier vers le dépôt `canalforme-official/app` (branche `main`).

### Workflow publication (après build)

1. Modifier les **sources** dans `frontend/` (monorepo).
2. Lancer `npm run build:planning`.
3. Tester `dist/` en local (thèmes Ramadan / été / férié, favoris injectés app, weekly filters `?filter=femmes`, etc.).
4. Pousser **uniquement** le contenu de `dist/` sur `canalforme-official/app`.
5. Incrémenter `?v=` / `cfv=` si cache agressif côté app.

**URLs publiques inchangées** (`daily_matrix.html`, etc.) — voir [frontend/README.md](./README.md) § stabilité des chemins.

---

## Purge historique GitHub

### Pourquoi

Même avec minification, l’**historique Git** de `canalforme-official/app` contient aujourd’hui des milliers de lignes HTML/CSS/JS **en clair**. N’importe qui peut :

- ouvrir un ancien commit sur GitHub ;
- comparer les diffs ;
- récupérer une version antérieure du planning.

### Méthode recommandée (simple, destructive)

**Orphan branch** — une seule commit « snapshot » minifié, sans parents :

```bash
# Dans un clone frais de canalforme-official/app
git checkout --orphan main-clean
# Copier le contenu de dist/ à la racine du repo app
git add -A
git commit -m "Planning minifié — snapshot initial (historique reset août 2026)"
git branch -M main
git push --force origin main
```

Alternative outil : **`git filter-repo`** ou **BFG** si on veut garder quelques commits récents — plus complexe, rarely needed ici.

### Avant la purge (checklist Yassine)

- [ ] Valider visuellement le `dist/` minifié (toutes les pages WebView + site).
- [ ] Sauvegarder une **archive zip** des sources lisibles (monorepo + tag git local) — ce repo reste la vérité dev.
- [ ] Vérifier qu’aucun **secret** n’a jamais été commité dans `app` / `app-data` (sinon purge + **rotation** des tokens).
- [ ] Prévenir toute personne avec un clone du dépôt public : `git fetch && git reset --hard origin/main`.
- [ ] Désactiver / supprimer les **forks** externes s’ils existent (sinon l’ancien historique reste ailleurs).
- [ ] Après force-push : contrôler github.io (cache CDN GitHub ~ quelques minutes).

### Limites (à connaître)

- **Wayback Machine**, miroirs, ou clones privés antérieurs peuvent garder d’anciennes copies.
- Les **SHAs** d’anciens commits deviennent orphelins sur GitHub (plus dans la branche `main`) — suffisant pour l’usage visé.
- Ne **pas** purger le monorepo principal : perte de traçabilité dev.

### `app-data`

Même logique si le JSON reste sur GitHub public : orphan + snapshot, ou mieux **arrêter le public raw** et servir via API (palier planning CF). Les JSON leaderboard contiennent des données membres agrégées — pas ultra sensibles, mais le raw public facilite le scraping.

---

## Tests obligatoires post-minify

| Zone | Vérifier |
|------|----------|
| App WebView | daily, grid, matrix, weekly, vertical, horaires, Myzone (4 vues) |
| Thèmes | régulier, Ramadan, été, férié |
| Site canalforme.fr | liens `weekly_vertical.html?filter=…` |
| Favoris | inject OTA app (`planningFavoritesInject.js`) |
| Stories IG | Puppeteer screenshot si HTML modifié |

Réutiliser cases [PHASE_C_VALIDATION.md](../../../docs/PHASE_C_VALIDATION.md) § *En parallèle*.

---

## Ordre recommandé (quand Yassine dira « go »)

| Étape | Action |
|-------|--------|
| 1 | Créer `package.json` + script `build:planning` |
| 2 | Premier build + tests locaux complets |
| 3 | Déployer `dist/` sur github.io (sans purge — essai) |
| 4 | Valider app preview 24–48 h |
| 5 | Purge historique `canalforme-official/app` (orphan + force-push) |
| 6 | (Optionnel même lot) JSON derrière API + purge ou réduction `app-data` |

**Version cible indicative :** **7.5.x / Phase D** — après 7.2.0 stable, pas en parallèle de la validation store.

---

## Références conversation août 2026

- Minification = oui (perf WebView).
- Obfuscation type Google/Gemini = non (théâtre, maintenance).
- Limiter JSON = oui, via API (pas urgent vs minify).
- Purge historique GitHub = oui, **dans le même chantier** que la minification.
