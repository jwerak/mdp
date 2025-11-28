import { CatalogConfig } from './types';

declare global {
  interface Window {
    cockpit: any;
  }
}

function getCockpit() {
  if (typeof window !== 'undefined' && window.cockpit) {
    return window.cockpit;
  }
  throw new Error('Cockpit API is not available');
}

const CONFIG_PATH = '/var/lib/cockpit-plugin-demos/config.json';

const DEFAULT_CONFIG: CatalogConfig = {
  repoUrl: '',
  namespace: 'local',
  collectionName: ''
};

export async function loadConfig(): Promise<CatalogConfig> {
  return new Promise((resolve, reject) => {
    getCockpit().file(CONFIG_PATH).read()
      .then((content: string) => {
        try {
          const config = JSON.parse(content);
          resolve({ ...DEFAULT_CONFIG, ...config });
        } catch (error: any) {
          resolve(DEFAULT_CONFIG);
        }
      })
      .catch(() => {
        resolve(DEFAULT_CONFIG);
      });
  });
}

export async function saveConfig(config: CatalogConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    getCockpit().file(CONFIG_PATH).replace(JSON.stringify(config, null, 2))
      .then(() => resolve())
      .catch((error: any) => {
        reject(new Error(`Failed to save config: ${error.message}`));
      });
  });
}

