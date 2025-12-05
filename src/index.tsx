// Set webpack public path BEFORE any imports
// This ensures chunks (JS and CSS) load correctly in Cockpit's routing system
(function() {
  const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
  const publicPath = basePath + 'dist/';
  (window as { __webpack_public_path__?: string }).__webpack_public_path__ = publicPath;
})();

import '@patternfly/patternfly/patternfly.css';
import "cockpit-dark-theme";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

document.addEventListener("DOMContentLoaded", function () {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

