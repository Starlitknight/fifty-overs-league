/* sw.js — A WORKER WHOSE ONLY JOB IS TO REMOVE ITSELF.
 *
 * There was an app-shell worker here. It answered navigations from a cache so
 * that a reload had something to paint on its first frame, and it worked: the
 * document came back in 8ms. It did not fix the blink - measurement said the
 * blink was 690ms of parsing four and a half megabytes of program, which no
 * cache in front of the document can help - and it brought a fault of its own.
 * Its navigation handler ended in
 *
 *     return hit || (await live) || new Response('', { status: 504 });
 *
 * so a reader with no cached shell yet and one failed request got an empty 504,
 * which a browser renders as "this site can't be reached". On a connection that
 * drops even occasionally that is a front door that sometimes is not there. It
 * also answered EVERY navigation from './index.html', so client/game.html was
 * served the wrong document.
 *
 * A worker cannot be withdrawn by deleting it. Once installed it lives in the
 * browser and keeps serving; a 404 for its URL is treated as a network problem
 * and the old copy stays. The only way to take one back is to ship a new
 * version that stands down. So this file is kept and served, and it:
 *
 *   - claims immediately, so it replaces the old worker rather than waiting
 *     behind it for every tab to close,
 *   - deletes every cache the old one created,
 *   - unregisters itself,
 *   - and registers NO fetch handler at all, so from the moment it activates
 *     nothing on this origin is intercepted, cached, or answered from a copy.
 *
 * The page also unregisters any worker it finds on every load (see BOOT in
 * build.sh), which covers the reader whose browser never gets as far as
 * fetching this file. Belt and braces, because the failure it undoes is the
 * site not loading at all.
 *
 * Do not add caching back here. If the first frame needs pixels, that is a
 * question about the size of the program, not about where the document came
 * from.
 */
const BUILD = '20260818-1752-2ff772';

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.indexOf('fo-') === 0).map(k => caches.delete(k)));
    } catch (err) {}
    try { await self.registration.unregister(); } catch (err) {}
    try { await self.clients.claim(); } catch (err) {}
  })());
});

// NO fetch listener. Every request goes to the network exactly as it would
// with no worker installed at all.
