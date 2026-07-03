# 🎵 NUNI — Site web (frontend)

Version complète du site NUNI (thème sombre/doré, mode clair/sombre, compteur d'auditeurs,
système de codes promo, écran d'inscription connecté au vrai backend). Ce dossier est prêt
à être ouvert dans Visual Studio Code et lancé en mode développement.

## 📁 Structure du projet

```
nuni-site/
├── index.html            → Page principale (structure HTML)
├── css/
│   └── style.css          → Tous les styles (thème clair/sombre, animations...)
├── js/
│   └── app.js               → Toute la logique (thème, promo, inscription, radio...)
├── assets/
│   ├── logo.png             → Logo NUNI (utilisé dans le header/hero)
│   └── logo-bg.png          → Logo NUNI (utilisé en variable CSS --nuni-logo-img)
├── icons/
│   ├── icon-192.png         → Icône PWA 192x192
│   └── icon-512.png         → Icône PWA 512x512
├── manifest.json            → Manifeste PWA (nom, icônes, couleurs)
├── sw.js                    → Service worker minimal (pass-through, pas de cache)
├── docs/                    → Documentation originale du projet (contexte, roadmap...)
├── package.json             → Config npm + script de dev
├── vite.config.js           → Config du serveur de développement (Vite)
└── .gitignore
```

Le fichier `nuni_19.html` d'origine (~1,3 Mo, à cause des images encodées en base64 dans
le code) a été séparé en fichiers distincts et les deux images du logo ont été extraites
en vrais fichiers PNG dans `assets/` — le comportement et le rendu visuel du site restent
strictement identiques, mais le code est maintenant lisible, modifiable dans VS Code, et
le fichier HTML est passé de 1,3 Mo à ~70 Ko.

## 🚀 Lancer le site en local (mode dev)

Prérequis : [Node.js](https://nodejs.org/) installé (version 18+ recommandée).

```bash
# 1. Installer les dépendances (une seule fois)
npm install

# 2. Lancer le serveur de développement
npm run dev
```

Le site s'ouvre automatiquement sur **http://localhost:5173** avec rechargement
automatique à chaque modification de fichier (hot reload).

### Autres commandes utiles

```bash
npm run build     # Génère une version optimisée dans /dist (pour la mise en prod)
npm run preview   # Prévisualise la version buildée localement
```

## 🔌 Backend

Le frontend communique avec une API backend hébergée sur Railway :

```
https://nuni-backend-production-cf8e.up.railway.app
```

Variable `NUNI_API_BASE`, tout en haut de `js/app.js`. C'est la seule ligne à modifier
si tu changes de backend (nouvelle URL, backend local, etc.).

Endpoints utilisés par le frontend :
- `POST /api/register`
- `POST /api/subscribe/request`
- `POST /api/login`
- `POST /api/subscribe/redeem`

## 🎛️ Fonctionnalités notables de cette version

- **Thème clair / sombre** avec bouton de bascule (persistant en session)
- **Messages d'accroche rotatifs** sur l'écran d'accueil
- **Codes promo** avec réduction en %, expiration et quota d'utilisation
- **Compteur d'auditeurs actifs** affiché sur la page d'accueil
- **Écran d'inscription réelle** connecté au backend Railway (Pass Consommateur / Artiste)
- **Assistant NUNI** (modale de fin de découverte) qui propose un Pass
- **Support PWA** (manifest + service worker + icônes) — installable sur mobile/desktop

## 🌐 Déploiement en production

Le site est déployé sur **GitHub Pages** :
- Repo : `https://github.com/NUNI-misikicg/nuni-misikicg.github.io`
- URL live : `https://nuni-misikicg.github.io/`

GitHub Pages sert des fichiers statiques bruts : `index.html`, `css/`, `js/`, `assets/`,
`icons/`, `manifest.json` et `sw.js` peuvent être uploadés tels quels, sans build. Si tu
veux profiter du build Vite (minification), utilise `npm run build` puis déploie le
contenu du dossier `dist/`.

## 📝 Notes

- Stockage utilisateur : `localStorage`, pas encore chiffré.
- Le catalogue musical, le vrai lecteur audio et NUNI Radio/DJ sont encore à intégrer
  (voir `docs/RESUME_COMPLET_NUNI.md` pour la roadmap complète).

---

**NUNI — La musique congolaise mérite son envol. Chaque écoute change une vie.**
