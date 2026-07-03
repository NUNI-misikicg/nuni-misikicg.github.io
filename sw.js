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
  // Pass-through: laisse le réseau gérer toutes les requêtes.
  event.respondWith(fetch(event.request));
});
