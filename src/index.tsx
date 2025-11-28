import '@patternfly/react-core/dist/styles/base.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

declare global {
  interface Window {
    cockpit: any;
  }
}

// Wait for DOM and cockpit to be ready
function initApp() {
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

