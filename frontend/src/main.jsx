import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { LanguageProvider } from './i18n.jsx';
import './fonts.css';
import './styles.css';

// Dev-only: ?dev=gallery renders the real views with fixture states (src/dev/Gallery.jsx).
// Stripped from prod builds.
const isGallery = import.meta.env.DEV && new URLSearchParams(location.search).get('dev') === 'gallery';
const Root = isGallery ? lazy(() => import('./dev/Gallery.jsx')) : App;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <Suspense fallback={null}>
        <Root />
      </Suspense>
    </LanguageProvider>
  </React.StrictMode>
);
