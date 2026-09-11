/**
 * Minimální router nad History API.
 *
 * Portál má pět typů cest a nepotřebuje kvůli tomu 40 kB knihovny —
 * rozpočet initial JS je 130 kB gzip celkem.
 */

import { useEffect, useState } from 'react';
import type { Locale } from '@vevit-games/engine';
import { DEFAULT_LOCALE, LOCALES } from './i18n.js';

export type Route =
  | { name: 'home'; locale: Locale }
  | { name: 'game'; locale: Locale; slug: string }
  | { name: 'category'; locale: Locale; category: string }
  | { name: 'search'; locale: Locale; query: string }
  | { name: 'settings'; locale: Locale }
  | { name: 'profile'; locale: Locale }
  | { name: 'notFound'; locale: Locale };

export function parseRoute(pathname: string, search: string): Route {
  const segments = pathname.split('/').filter(Boolean);
  const locale: Locale = LOCALES.includes(segments[0] as Locale)
    ? (segments[0] as Locale)
    : DEFAULT_LOCALE;
  const rest = LOCALES.includes(segments[0] as Locale) ? segments.slice(1) : segments;

  if (rest.length === 0) return { name: 'home', locale };
  if (rest[0] === 'kategorie' && rest[1]) return { name: 'category', locale, category: rest[1] };
  if (rest[0] === 'nastaveni') return { name: 'settings', locale };
  if (rest[0] === 'profil') return { name: 'profile', locale };
  if (rest[0] === 'hledat') {
    return { name: 'search', locale, query: new URLSearchParams(search).get('q') ?? '' };
  }
  if (rest.length === 1) return { name: 'game', locale, slug: rest[0]! };
  return { name: 'notFound', locale };
}

export const hrefFor = (route: Route): string => {
  switch (route.name) {
    case 'home': return `/${route.locale}/`;
    case 'game': return `/${route.locale}/${route.slug}`;
    case 'category': return `/${route.locale}/kategorie/${route.category}`;
    case 'search': return `/${route.locale}/hledat?q=${encodeURIComponent(route.query)}`;
    case 'settings': return `/${route.locale}/nastaveni`;
    case 'profile': return `/${route.locale}/profil`;
    case 'notFound': return `/${route.locale}/`;
  }
};

export function navigate(href: string): void {
  window.history.pushState(null, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.pathname, window.location.search),
  );

  useEffect(() => {
    const update = (): void => {
      setRoute(parseRoute(window.location.pathname, window.location.search));
      // Nová stránka musí začít nahoře, jinak přistane hráč v půlce.
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', update);

    // Odkazy uvnitř portálu se odbaví bez načtení celé stránky.
    const onClick = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/') || anchor.target === '_blank') return;
      event.preventDefault();
      navigate(href);
    };
    document.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('popstate', update);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return route;
}
