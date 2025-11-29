// Set webpack public path BEFORE any imports
// This ensures chunks (JS and CSS) load correctly in Cockpit's routing system
(function() {
  const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
  const publicPath = basePath + 'dist/';
  // @ts-ignore - webpack global variable
  (window as any).__webpack_public_path__ = publicPath;
})();

import '@patternfly/react-core/dist/styles/base.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

declare global {
  interface Window {
    cockpit: any;
  }
}

// Sync dark mode class from shell-page element to html element
// Cockpit sets pf-v6-theme-dark on the element with id "shell-page"
// We copy this class to the html element for PatternFly React CSS
function getShellPageElement(): HTMLElement | null {
  // Try current document first
  let shellPage = document.getElementById('shell-page');
  if (shellPage) {
    return shellPage;
  }

  // Try parent window (in case plugin is in iframe)
  try {
    if (window.parent && window.parent !== window) {
      shellPage = window.parent.document.getElementById('shell-page');
      if (shellPage) {
        return shellPage;
      }
    }
  } catch (e) {
    // Cross-origin or other access issues, ignore
  }

  // Try top window
  try {
    if (window.top && window.top !== window) {
      shellPage = window.top.document.getElementById('shell-page');
      if (shellPage) {
        return shellPage;
      }
    }
  } catch (e) {
    // Cross-origin or other access issues, ignore
  }

  return null;
}

function syncThemeFromShellPage() {
  const shellPage = getShellPageElement();
  const html = document.documentElement;

  let hasDarkClass = false;

  // Check shell-page element if available
  if (shellPage) {
    hasDarkClass = shellPage.classList.contains('pf-v6-theme-dark');
  } else {
    // Fallback: check parent window's html element
    try {
      if (window.parent && window.parent !== window) {
        hasDarkClass = window.parent.document.documentElement.classList.contains('pf-v6-theme-dark');
      } else if (window.top && window.top !== window) {
        hasDarkClass = window.top.document.documentElement.classList.contains('pf-v6-theme-dark');
      }
    } catch (e) {
      // Cross-origin or other access issues, ignore
    }
  }

  const htmlHasDarkClass = html.classList.contains('pf-v6-theme-dark');

  // Sync the class: add if shell-page has it, remove if it doesn't
  if (hasDarkClass && !htmlHasDarkClass) {
    html.classList.add('pf-v6-theme-dark');
  } else if (!hasDarkClass && htmlHasDarkClass) {
    html.classList.remove('pf-v6-theme-dark');
  }
}

function setupThemeSync() {
  // Wait for shell-page element to be available
  let retryCount = 0;
  const maxRetries = 50; // 5 seconds max wait time

  const checkAndSetup = () => {
    const shellPage = getShellPageElement();

    // Initial sync
    syncThemeFromShellPage();

    if (shellPage) {
      // Watch for changes to shell-page element's class attribute
      const observer = new MutationObserver(() => {
        syncThemeFromShellPage();
      });

      observer.observe(shellPage, {
        attributes: true,
        attributeFilter: ['class']
      });
    } else {
      // Fallback: watch parent window's html element
      try {
        let parentHtml: HTMLElement | null = null;
        if (window.parent && window.parent !== window) {
          parentHtml = window.parent.document.documentElement;
        } else if (window.top && window.top !== window) {
          parentHtml = window.top.document.documentElement;
        }

        if (parentHtml) {
          const observer = new MutationObserver(() => {
            syncThemeFromShellPage();
          });

          observer.observe(parentHtml, {
            attributes: true,
            attributeFilter: ['class']
          });
        } else {
          // Retry if neither shell-page nor parent html is available
          retryCount++;
          if (retryCount < maxRetries) {
            setTimeout(checkAndSetup, 100);
          }
        }
      } catch (e) {
        // Cross-origin or other access issues, retry
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(checkAndSetup, 100);
        }
      }
    }
  };

  checkAndSetup();
}

// Wait for DOM and cockpit to be ready
function initApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  // Set up dark mode synchronization
  setupThemeSync();

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

