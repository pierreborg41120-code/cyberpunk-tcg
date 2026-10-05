// Cyberpunk TCG — fonctionnement hors connexion.
// Le jeu (un seul gros fichier) est gardé sur l'appareil ; publish.sh change VERSION à chaque mise à jour,
// ce qui fait télécharger la nouvelle version en arrière-plan.
const VERSION = 'a8dd55ea9b';
const CACHE = 'cptcg-' + VERSION;
const EXT = 'cptcg-ext';   // polices et PeerJS (sites externes)
const CORE = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('cptcg-') && k !== CACHE && k !== EXT).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    // Le jeu s'ouvre depuis l'appareil (instantané, même hors connexion).
    if (r.mode === 'navigate') { e.respondWith(caches.match('./').then(h => h || fetch(r))); return; }
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(h => h || fetch(r)));
    return;
  }
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$|(^|\.)cdnjs\.cloudflare\.com$/.test(u.hostname)) {
    e.respondWith(caches.open(EXT).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
