# CSS planning public — organisation

## Objectif

Les pages `daily.html`, `daily_grid.html`, `weekly.html`, `weekly_vertical.html` et `weekly_vertical_fulldays.html` gardent la majeure partie des styles en `<style>` inline (historique, pas de refactor massif). Les **couleurs et motifs** des thèmes Ramadan / férié / été sont toutefois centralisés dans un seul fichier pour éviter les dérives entre vues.

## Fichier partagé

| Fichier | Rôle |
|---------|------|
| `planning-tokens.css` | Variables `:root` préfixées `--planning-*` : couleurs par thème, URLs des images de fond en mosaïque, dégradé d’en-tête « été » pour le tableau hebdo, voile `::after` férié (daily / grid). |

## Chargement

Chaque page concernée inclut dans le `<head>`, **après** les polices éventuelles et **avant** le bloc `<style>` principal :

```html
<link rel="stylesheet" href="planning-tokens.css">
```

Le chemin est relatif au dossier `frontend/` (même répertoire que les HTML).

## Utilisation dans les pages

Les règles `body.planning-ramadan`, `body.planning-ferie` et `body.planning-ete` **recopient** les jetons vers les variables déjà utilisées par le reste du CSS (`--primary-color`, `--primary-overlay`, etc.) via `var(--planning-…)`. Ainsi le layout existant ne change pas ; seule la source des valeurs est unique.

Les cellules d’en-tête hebdomadaires (`data-planning-key="ramadan"`, `ete`, `ferie` / `ferme`) utilisent `var(--planning-weekly-header-…)` pour rester alignées avec le corps de page.

## Modifier un thème

1. Éditer `planning-tokens.css` uniquement pour les paires couleur / transparence listées sous Ramadan, férié ou été.
2. Recharger les vues concernées. Les confettis ou assets JS qui listent des hex en dur (ex. palettes `ferie` / `ete` dans le JS) peuvent nécessiter une mise à jour **séparée** si vous changez radicalement une teinte — ce fichier ne les remplace pas.

## Évolution possible

Extraire d’autres blocs répétés (barre d’horaires, cartes « indéterminé ») dans des feuilles `planning-*.css` supplémentaires, en gardant le même ordre de chargement : jetons d’abord, puis styles spécifiques à la page.

## Voir aussi

- [README.md](./README.md) — inventaire des fichiers à la racine du frontend, tableau des ressources partagées, règles sur la **stabilité des URLs** publiées.
