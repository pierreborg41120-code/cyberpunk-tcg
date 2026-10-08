// Cyberpunk TCG — fonctionnement hors connexion.
// Le jeu (un seul gros fichier) est gardé sur l'appareil ; publish.sh change VERSION à chaque mise à jour,
// ce qui fait télécharger la nouvelle version en arrière-plan.
const VERSION = 'fd63bd371a';
const CACHE = 'cptcg-' + VERSION;
const EXT = 'cptcg-ext';   // polices et PeerJS (sites externes)
const MUS = 'cptcg-musique';   // musiques et vidéo d'accueil : téléchargées au premier passage, gardées d'une version à l'autre
const CORE = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('cptcg-') && k !== CACHE && k !== EXT && k !== MUS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin && (u.pathname.includes('/musique/') || u.pathname.endsWith('/hero.webm'))) {
    e.respondWith(caches.open(MUS).then(async c => {
      const hit = await c.match(u.pathname);
      if (hit) return hit;
      const res = await fetch(u.pathname);
      if (res.ok) c.put(u.pathname, res.clone());
      return res;
    }));
    return;
  }
  if (u.origin === location.origin) {
    // Le jeu s'ouvre depuis l'appareil (instantané, même hors connexion).
    // La page de connexion vient toujours du réseau (elle a besoin du serveur de toute façon).
    if (r.mode === 'navigate' && u.pathname.endsWith('/connexion.html')) { e.respondWith(fetch(r).catch(() => caches.match(r))); return; }
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
