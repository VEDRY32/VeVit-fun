import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from './lib/router.js';
import { createI18n } from './lib/i18n.js';
import { loadSettings, saveSettings, type PortalSettings } from './lib/settings.js';
import { Header } from './components/Header.js';
import { HomePage } from './pages/HomePage.js';
import { GamePage } from './pages/GamePage.js';
import { CategoryPage } from './pages/CategoryPage.js';
import { SearchPage } from './pages/SearchPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

export function App(): JSX.Element {
  const route = useRoute();
  const [settings, setSettings] = useState<PortalSettings>(loadSettings);

  const i18n = useMemo(() => createI18n(route.locale), [route.locale]);

  const updateSettings = useCallback((patch: Partial<PortalSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = route.locale;
  }, [route.locale]);

  useEffect(() => {
    // Třída na kořeni umožní vypnout animace i v CSS, ne jen v JS.
    document.documentElement.classList.toggle('bez-pohybu', settings.reducedMotion);
    document.documentElement.classList.toggle('barvoslepost', settings.colorblind);
  }, [settings.reducedMotion, settings.colorblind]);

  // Stránka hry si řídí celou plochu sama (režim „zen").
  const chrome = route.name !== 'game';

  return (
    <>
      <a className="preskocit" href="#obsah">{i18n.t('app.skip')}</a>
      {chrome && <Header i18n={i18n} locale={route.locale} />}
      <main id="obsah" className={chrome ? 'obsah' : 'obsah obsah--hra'}>
        {route.name === 'home' && <HomePage i18n={i18n} settings={settings} />}
        {route.name === 'game' && (
          <GamePage
            slug={route.slug}
            i18n={i18n}
            settings={settings}
            onSettingsChange={updateSettings}
          />
        )}
        {route.name === 'category' && <CategoryPage category={route.category} i18n={i18n} />}
        {route.name === 'search' && <SearchPage query={route.query} i18n={i18n} />}
        {route.name === 'settings' && (
          <SettingsPage i18n={i18n} settings={settings} onChange={updateSettings} />
        )}
        {route.name === 'profile' && <ProfilePage i18n={i18n} />}
        {route.name === 'notFound' && <NotFoundPage i18n={i18n} />}
      </main>
      {chrome && (
        <footer className="pata">
          <p>VeVit Games · vlastní engine, vlastní grafika, žádné cizí assety.</p>
        </footer>
      )}
    </>
  );
}
