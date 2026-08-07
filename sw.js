/* sw.js — THE APP SHELL, SO A REFRESH HAS SOMETHING TO PAINT.
 *
 * THE PROBLEM THIS EXISTS FOR. On a reload the browser throws away the pixels
 * of the page you are looking at and shows whatever the new document paints
 * first. Measured on a screencast of this game: 180,032 bytes of painting, then
 * one frame of 16,408 bytes of nearly nothing, then 205,808 bytes of painting
 * again. That frame is the blink. It cannot be fixed by anything the page does
 * once it is running, because it happens before the page is running - the only
 * cure is for the document to arrive already painted, and the only way to do
 * that at zero latency is to answer the navigation from a local cache.
 *
 * THE DANGER, WHICH IS REAL AND HAS BITTEN THIS PROJECT BEFORE. build.sh says
 * it plainly: one self-contained page meant "every CDN cache hit was a chance
 * to serve a stale GAME, and nobody could say which build a stuck screen was
 * running". A service worker is another cache in front of the document, and a
 * careless one is exactly that bug with a longer memory. So the rules here are
 * narrow on purpose:
 *
 *   THE SHELL (index.html, client/game.html) is answered from cache so the
 *   first frame is instant - and then re-fetched in the background on every
 *   single navigation. A visitor is at most ONE load behind, and the game
 *   already polls version.json and offers a one-tap update, so being one load
 *   behind is a state it knows how to announce and repair.
 *
 *   THE PROGRAM (assets/fo-<build>.js) is safe to keep forever because its
 *   name contains its build. A new build is a new URL; there is no such thing
 *   as a stale hit.
 *
 *   THE PAINTINGS (client/art/**, client/fonts/**) are immutable by name too.
 *
 *   EVERYTHING ELSE - the World Service, auth, every API call - is not touched.
 *   No caching, no interception, no offline guesswork about live cricket.
 *
 * AND A KILL SWITCH. ?nosw=1 on any load unregisters this worker and empties
 * its caches, so a bad deploy is one URL away from being undone rather than
 * needing a fix shipped through the very thing that is broken.
 */
const BUILD = '20260807-2055-e6358d';
const SHELL = 'fo-shell-' + BUILD;
const LONG = 'fo-long-v1';
const SHELL_URLS = ['./', './index.html', './client/game.html'];

self.addEventListener('install', e => {
  // take the new shell down at once; the page decides when to use it
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.all(SHELL_URLS.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // every shell but this build's goes; the long cache is keyed by URL and
    // its entries are immutable, so it survives
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('fo-shell-') && k !== SHELL).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isLong = u =>
  /\/assets\/fo-[\w.-]+\.js$/.test(u.pathname) ||
  /\/client\/(art|fonts)\//.test(u.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let u;
  try { u = new URL(req.url); } catch (err) { return; }
  // OUR ORIGIN ONLY. The World Service, Supabase, auth and every other host go
  // straight to the network with this worker not in the conversation at all.
  if (u.origin !== self.location.origin) return;

  // THE NAVIGATION: cache first, so the document paints on the first frame,
  // then refresh the cached copy behind it for next time.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      const hit = await c.match('./index.html') || await c.match(req);
      const live = fetch(req).then(r => {
        if (r && r.ok) c.put('./index.html', r.clone()).catch(() => {});
        return r;
      }).catch(() => null);
      // a cached shell answers now; without one, wait for the network
      return hit || (await live) || new Response('', { status: 504 });
    })());
    return;
  }

  // THE PROGRAM AND THE PAINTINGS: named by build or immutable by nature.
  if (isLong(u)) {
    e.respondWith((async () => {
      const c = await caches.open(LONG);
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req).catch(() => null);
      if (r && r.ok) c.put(req, r.clone()).catch(() => {});
      return r || new Response('', { status: 504 });
    })());
    return;
  }
  // anything else on this origin: the network, untouched
});
