import { getUserPaths } from './paths';
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

const DEFAULT_CONFIG: CatalogConfig = {
  collectionSource: '',
  executionEnvironment: '',
  useLocalCollection: false
};

export async function loadConfig(): Promise<CatalogConfig> {
  const paths = await getUserPaths();
  const configPath = paths.config;

  return new Promise((resolve) => {
    getCockpit().file(configPath).read()
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
  const paths = await getUserPaths();
  const configPath = paths.config;
  const configDir = configPath.substring(0, configPath.lastIndexOf('/'));

  const cockpit = getCockpit();

  // Ensure directory exists before writing config
  return new Promise((resolve, reject) => {
    cockpit.spawn(['bash', '-c', `umask 002 && install -d -m 755 "${configDir}"`], { err: 'out' })
      .then(() => {
        return cockpit.file(configPath).replace(JSON.stringify(config, null, 2));
      })
      .then(() => resolve())
      .catch((error: any) => {
        reject(new Error(`Failed to save config: ${error.message}`));
      });
  });
}

