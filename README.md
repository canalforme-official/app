# Canal Forme — Frontend (pages statiques)

## Description

Application web pour l’affichage des plannings de cours, classements Myzone et pages associées. Ce dossier est servi tel quel (HTML + JS + CSS) ; les données live viennent surtout du dépôt [`app-data`](https://github.com/canalforme-official/app-data) (JSON).

## Dépôts GitHub

### Frontend (pages)

- URL : https://github.com/canalforme-official/app  
- Branche principale : `main`  
- Les chemins des fichiers sous `frontend/` peuvent correspondre à des **URL publiques** déjà diffusées ; voir ci‑dessous.

### Données (JSON)

- URL : https://github.com/canalforme-official/app-data  
- Exemples : `planning-v2.json`, `leaderboard.json`, `alltime-leaderboard.json`, `prayer-times.json`

---

## Stabilité des chemins (URLs publiées)

Les pages listées sont souvent référencées par des **liens fixes** (site, réseaux, QR codes, intégrations).

**À respecter tant que ces liens ne sont pas tous migrés :**

- Ne pas **renommer** ni **déplacer** les fichiers `.html` à la racine de `frontend/` sans mettre à jour chaque URL publiée ou prévoir des redirections côté hébergement.
- Les **chemins relatifs** entre fichiers (`./planning-tokens.css`, `./planning-resolve.js`, etc.) supposent que ces ressources restent **au même niveau** que les pages qui les chargent (structure actuelle).

Une réorganisation future du dossier (sous‑dossiers `planning/`, etc.) reste possible, mais impose une passe sur toutes les URLs et les `href` / `src` / `fetch('./…')`.

---

## Fichiers à la racine de `frontend/`

| Fichier | Rôle |
|--------|------|
| `daily.html` | Planning **quotidien** (timeline). Thèmes Ramadan / férié / été ; charge `planning-tokens.css` ; données `./planning-v2.json` ou dépôt `app-data`. |
| `daily_grid.html` | Variante **grille** du jour. Idem tokens + fetch planning / horaires de prière. |
| `weekly.html` | Planning **hebdomadaire** (tableau). `planning-tokens.css`, `planning-resolve.js`, `weekly-vertical-inline.js`. |
| `weekly_vertical.html` | Hebdo **vertical** (scroll jours). Mêmes scripts partagés. |
| `weekly_vertical_fulldays.html` | Variante vertical **tous les jours** visibles. Mêmes scripts partagés. |
| `prayer-times.html` | Page horaires de prière (si utilisée seule). |
| `myzone-leaderboard.html` | Classement Myzone général ; utilise `planning-resolve.js` (helpers partagés). |
| `status-leaderboard.html` | Classement par statut ; `planning-resolve.js`. |
| `palmares-myzone.html` | Palmarès performances. |
| `planning-tokens.css` | Variables CSS des **thèmes** planning (Ramadan, férié, été). Détails : [PLANNING-CSS.md](./PLANNING-CSS.md). |
| `planning-resolve.js` | Résolution des périodes / clés planning (partagé par plusieurs pages). |
| `weekly-vertical-inline.js` | Logique hebdo (vertical + chargé aussi par `weekly.html`). |
| `Planning-v2.json` | Copie / fallback **local** du JSON planning (le déploiement peut s’appuyer sur `app-data` en priorité). Les pages font souvent `fetch('./planning-v2.json')` : le nom exact du fichier déployé doit rester aligné avec le code (sensible à la casse selon l’hébergeur). |
| `PLANNING-CSS.md` | Documentation des jetons CSS planning. |
| `images_to_import.txt` | Note interne (imports d’images), non servi comme page. |

## Sous-dossiers

| Chemin | Rôle |
|--------|------|
| `components/barre-objectif-meps.html` | Fragment / composant barre MEPS. |
| `svg/planning-icons.svg` | Sprite SVG (symboles référencés via `./svg/planning-icons.svg#…`), ex. depuis `daily.html`. |

---

## Ressources partagées et qui les charge

Chemins indiqués **depuis la racine `frontend/`** (même dossier que les `.html`).

| Ressource | Pages concernées (principales) |
|-----------|--------------------------------|
| `planning-tokens.css` | `daily.html`, `daily_grid.html`, `weekly.html`, `weekly_vertical.html`, `weekly_vertical_fulldays.html` |
| `planning-resolve.js` | `weekly.html`, `weekly_vertical.html`, `weekly_vertical_fulldays.html`, `myzone-leaderboard.html`, `status-leaderboard.html` |
| `weekly-vertical-inline.js` | `weekly.html`, `weekly_vertical.html`, `weekly_vertical_fulldays.html` |
| `svg/planning-icons.svg` | Au moins `daily.html` (badges / icônes) |

---

## URLs d’accès types (chemins relatifs au site)

Exemples si le site expose la racine du dépôt `frontend/` :

- Planning quotidien : `/daily.html`
- Planning grille : `/daily_grid.html`
- Planning hebdo : `/weekly.html`
- Hebdo vertical : `/weekly_vertical.html`
- Hebdo vertical (tous les jours) : `/weekly_vertical_fulldays.html`
- Classement Myzone : `/myzone-leaderboard.html`
- Classement par statut : `/status-leaderboard.html`
- Palmarès : `/palmares-myzone.html`
- Horaires de prière : `/prayer-times.html`

Adapter le préfixe selon l’URL réelle de déploiement (domaine, sous-chemin).

---

## Structure actuelle du dossier

```
frontend/
├── README.md
├── PLANNING-CSS.md
├── planning-tokens.css
├── planning-resolve.js
├── weekly-vertical-inline.js
├── Planning-v2.json
├── images_to_import.txt
├── components/
│   └── barre-objectif-meps.html
├── svg/
│   └── planning-icons.svg
├── daily.html
├── daily_grid.html
├── weekly.html
├── weekly_vertical.html
├── weekly_vertical_fulldays.html
├── prayer-times.html
├── myzone-leaderboard.html
├── status-leaderboard.html
└── palmares-myzone.html
```

---

## Mise à jour des données

- Plannings : flux via Google Sheets / backend ; JSON public dans `app-data` (`planning-v2.json`, etc.).
- Classements : API Myzone ; JSON dans `app-data` selon les pages.

---

## Maintenance

1. Tester en local après modification (chemins relatifs, fetch, thèmes).  
2. Si vous touchez aux thèmes couleur : privilégier `planning-tokens.css` et lire [PLANNING-CSS.md](./PLANNING-CSS.md).  
3. Mettre à jour ce README si vous ajoutez une page à la racine ou une ressource partagée.  
4. Avant tout renommage de `.html` : recenser les **liens publiés** et les redirections nécessaires.
