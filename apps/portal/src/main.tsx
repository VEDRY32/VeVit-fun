import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@vevit-games/ui/styles.css';
import './styles/app.css';
import { App } from './App.js';

const container = document.getElementById('root');
if (!container) throw new Error('Chybí #root — index.html je poškozený.');

// Kořen cesty bez jazyka přesměrujeme na výchozí lokalizaci, ať má
// každá stránka jednu kanonickou URL kvůli SEO.
if (window.location.pathname === '/') {
  window.history.replaceState(null, '', '/cs/');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Service worker se registruje až po načtení stránky, aby nesoutěžil
 * o pásmo s prvním vykreslením. Ve vývoji ho neregistrujeme vůbec —
 * jinak by cachoval kód, který se za minutu změní.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Bez service workeru portál funguje dál, jen nebude offline.
    });
  });
}
