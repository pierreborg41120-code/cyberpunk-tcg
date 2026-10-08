// Cyberpunk TCG — fonctionnement hors connexion.
// Le jeu (un seul gros fichier) est gardé sur l'appareil ; publish.sh change VERSION à chaque mise à jour,
// ce qui fait télécharger la nouvelle version en arrière-plan.
const VERSION = '95584fa292';
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
  // musique, vidéo d'accueil et grandes images des cartes : téléchargées au premier besoin, gardées d'une version à l'autre
  if (u.origin === location.origin && (u.pathname.includes('/musique/') || u.pathname.includes('/cartes/') || /\/hero[^/]*\.(webp|webm)$/.test(u.pathname))) {
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
    if (r.mode === 'navigate' && /\/(connexion|donnees)\.html$/.test(u.pathname)) { e.respondWith(fetch(r).catch(() => caches.match(r))); return; }
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

// ---------- notifications (envoyées par la fonction « notifier » du serveur) ----------
// Si le jeu est ouvert et regardé, il affiche déjà tout lui-même : pas de notification en double.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    if (cs.some(c => c.visibilityState === 'visible' && c.focused)) return;
    return self.registration.showNotification(d.title || 'Cyberpunk TCG', { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || './' } });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ t: 'notif', url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
