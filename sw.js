// Service worker minimal pour NUNI.
// Ne met rien en cache pour l'instant (évite les soucis de contenu périmé en dev).
// Peut être enrichi plus tard pour un vrai fonctionnement hors-ligne.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne jamais intercepter les requêtes vers un autre domaine (Cloudinary, l'API backend...).
  // Avant : fetch(event.request) repassait TOUTE requête (même cross-origin) par ce service
  // worker, y compris les uploads volumineux en multipart/form-data vers Cloudinary — repasser
  // un tel corps de requête à travers le SW peut casser le flux et provoquait les erreurs
  // "Failed to fetch" / net::ERR_FAILED observées sur les envois de sons/clips.
  if (url.origin !== self.location.origin) {
    return; // laisse le navigateur gérer nativement, sans passer par ce SW
  }

  // Fichiers critiques (JS/CSS/HTML) : toujours revérifiés sur le réseau, jamais servis
  // depuis le cache HTTP normal du navigateur — évite d'avoir à vider le cache manuellement
  // après chaque déploiement pour voir la dernière version d'app.js.
  const isCriticalAsset = /\.(js|css|html)$/.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');
  if (isCriticalAsset) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => fetch(event.request))
    );
    return;
  }

  // Pass-through pour tout le reste (images, polices...) : laisse le réseau gérer.
  event.respondWith(fetch(event.request));
});
