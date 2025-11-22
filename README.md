# Canal Forme - Application Web

## Description
Application web pour la gestion et l'affichage des données Canal Forme, incluant les plannings de cours et les classements Myzone.

## Repositories GitHub
### Frontend (Pages HTML)
- URL : https://github.com/canalforme-official/app
- Branche principale : main

### Données (JSON)
- URL : https://github.com/canalforme-official/app-data
- Contenu : Fichiers JSON exportés depuis les backends
  - `planning.json` : Données du planning
  - `leaderboard.json` : Données du classement
  - `alltime-leaderboard.json` : Classement global

## Structure des Pages

### Planning
- `daily.html` : Planning quotidien des cours
- `weekly.html` : Planning hebdomadaire des cours

### Myzone
- `myzone-leaderboard.html` : Classement général Myzone
- `status-leaderboard.html` : Classement par statut
- `palmares-myzone.html` : Palmarès des performances

### Composants Réutilisables
- `components/barre-objectif-meps.html` : Barre de progression des objectifs MEPS

## URLs d'Accès
Les pages sont accessibles via les URLs suivantes :
- Planning quotidien : `/daily.html`
- Planning hebdomadaire : `/weekly.html`
- Classement Myzone : `/myzone-leaderboard.html`
- Classement par statut : `/status-leaderboard.html`
- Palmarès : `/palmares-myzone.html`

## Structure du Projet
```
frontend/
├── components/           # Composants réutilisables
│   └── barre-objectif-meps.html
├── daily.html           # Planning quotidien
├── weekly.html          # Planning hebdomadaire
├── myzone-leaderboard.html
├── status-leaderboard.html
└── palmares-myzone.html
```

## Mise à Jour
Les données sont mises à jour automatiquement via :
- Google Sheets pour les plannings
- API Myzone pour les classements
- Les données JSON sont stockées dans le repo `app-data`

## Dépendances
- Google Sheets API
- Myzone API
- Bootstrap (pour le style)
- jQuery (pour les interactions)

## Maintenance
Pour toute modification des pages, veuillez :
1. Tester les changements en local
2. Vérifier la compatibilité avec les APIs
3. Mettre à jour ce README si nécessaire