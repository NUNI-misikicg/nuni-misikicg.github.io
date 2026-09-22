// Service worker NUNI.
//
// AVANT : ne mettait rien en cache du tout (choix assumé, pour éviter le contenu périmé en
// dev et pour ne jamais casser les envois multipart vers Cloudinary qui passaient par erreur
// dans ce SW). MAINTENANT : vrai mode hors-ligne, sans revenir sur aucune des deux raisons —
// le réseau reste TOUJOURS prioritaire quand il est disponible (jamais de version périmée),
// le cache ne sert qu'en dernier recours (vraiment hors connexion), et les envois (POST/PUT
// cross-origin, ex. Cloudinary) restent toujours totalement ignorés par ce SW, exactement
// comme avant.
const CACHE_VERSION = 'nuni-v1'; // à changer manuellement (nuni-v2, ...) pour forcer un vrai nettoyage du cache de tout le monde après un déploiement majeur
const APP_SHELL_CACHE = CACHE_VERSION + '-shell';
const IMAGE_CACHE = CACHE_VERSION + '-images';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Nettoie les caches d'une ancienne version — évite que le stockage grossisse indéfiniment
  // à chaque déploiement.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== APP_SHELL_CACHE && k !== IMAGE_CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

// ---------- Notifications push réelles ----------
// Reçoit le vrai contenu envoyé par le serveur NUNI (titre, texte, lien) et affiche une vraie
// notification système — pas de contenu inventé ici, tout vient du payload envoyé par le
// serveur (voir sendPushToUser dans server.js). INCHANGÉ par cette migration.
self.addEventListener('push', (event) => {
  let data = { title: 'NUNI', body: 'Vous avez une nouvelle notification.', url: '/' };
  try { if (event.data) data = Object.assign(data, event.data.json()); } catch (e) { /* payload non-JSON, on garde les valeurs par défaut */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'assets/icons/icon-192.png',
      badge: 'assets/icons/icon-96.png',
      data: { url: data.url || '/' },
    })
  );
});

// Tap sur la notification : ramène sur un onglet NUNI déjà ouvert s'il y en a un, sinon en
// ouvre un nouveau — jamais une simple fermeture silencieuse sans action. INCHANGÉ.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    // Cross-origin (Cloudinary, l'API backend...) : la règle d'avant reste EXACTEMENT la
    // même pour tout ce qui n'est pas une image en lecture — jamais intercepté par ce SW,
    // pour ne jamais casser un envoi (POST/PUT multipart vers Cloudinary, appels à l'API).
    // Seule vraie nouveauté : les pochettes déjà vues (GET, destination "image") sont mises
    // en cache pour rester visibles hors connexion — jamais les fichiers audio (trop lourd
    // pour un cache automatique ; un vrai bouton "télécharger pour écouter hors ligne" est un
    // chantier séparé, pas fait ici).
    if (req.method === 'GET' && req.destination === 'image') {
      event.respondWith(
        caches.open(IMAGE_CACHE).then(async (cache) => {
          const cached = await cache.match(req);
          const networkFetch = fetch(req).then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          // Une image déjà en cache s'affiche immédiatement (rapide), pendant qu'une version
          // à jour se met en cache en arrière-plan pour la prochaine fois — jamais de version
          // cassée affichée : si rien n'est en cache, on attend simplement le réseau.
          return cached || networkFetch;
        })
      );
    }
    return; // tout le reste cross-origin : inchangé, jamais intercepté
  }

  // Fichiers critiques (JS/CSS/HTML) : toujours revérifiés sur le réseau EN PREMIER — jamais
  // de version périmée servie tant qu'il y a du réseau, exactement comme avant. Seule vraie
  // nouveauté : si le réseau échoue vraiment (hors connexion), on sert la dernière version
  // qui a réussi à charger, plutôt que de casser complètement l'application.
  const isCriticalAsset = /\.(js|css|html)$/.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');
  if (isCriticalAsset) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Pass-through pour tout le reste sur notre origine (polices, icônes locales...) : laisse le
  // réseau gérer, inchangé.
  event.respondWith(fetch(req));
});
