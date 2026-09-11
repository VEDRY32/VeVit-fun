/**
 * Service worker portálu.
 *
 * Cíl: po první návštěvě musí singleplayer hry fungovat bez sítě.
 * Strategie se liší podle druhu požadavku, protože jeden přístup na všechno
 * buď servíruje starý kód, nebo zbytečně chodí na síť.
 *
 * - navigace → síť první, offline záloha je stránka s Běžcem
 * - hashované assety → cache první (obsah se pod hashem nikdy nemění)
 * - písma a ikony → cache první
 * - API → jen síť, nikdy se necachuje (skóre a denní výzvy musí být živé)
 */

/// <reference lib="webworker" />

export {};

/**
 * V modulu deklarovaném pro WebWorker je `self` typované jako
 * `WorkerGlobalScope`. Přetypování je jediný způsob, jak se dostat
 * k `skipWaiting` a `clients`, aniž bychom předefinovali globální `self`.
 */
const worker = self as unknown as ServiceWorkerGlobalScope;

const VERSION = __APP_VERSION__;
const SHELL_CACHE = `vevit-shell-${VERSION}`;
const ASSET_CACHE = `vevit-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';

/** Co je potřeba mít v cache hned po instalaci. */
const SHELL_FILES = [
  '/',
  '/cs/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon.svg',
];

worker.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // `allSettled`, aby jeden chybějící soubor neshodil celou instalaci.
      await Promise.allSettled(SHELL_FILES.map((url) => cache.add(url)));
      await worker.skipWaiting();
    })(),
  );
});

worker.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Cache starých verzí se smažou, jinak by disk rostl s každým nasazením.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('vevit-') && !key.endsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await worker.clients.claim();
    })(),
  );
});

const isAsset = (url: URL): boolean =>
  url.pathname.startsWith('/assets/')
  || url.pathname.startsWith('/fonts/')
  || url.pathname.startsWith('/covers/');

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirstNavigation(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Bez sítě: zkusíme uloženou verzi stránky, jinak offline hru.
    const cache = await caches.open(SHELL_CACHE);
    const cached = (await cache.match(request)) ?? (await cache.match('/cs/'));
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('Jsi offline a stránka není uložená.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}

worker.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Cizí origin neřešíme — CSP stejně žádný nepovoluje.
  if (url.origin !== worker.location.origin) return;

  // API musí být vždy živé: uložené skóre nebo denní výzva by lhaly.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
