import { UserPaths } from './types';

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

// Cache for user paths to avoid repeated spawn calls
let cachedPaths: UserPaths | null = null;

/**
 * Detects user context and returns appropriate storage paths.
 * - Regular users: ~/.local/share/cockpit-plugin-demos/
 * - Superuser (UID 0): /var/lib/cockpit-plugin-demos/
 * - Collections: Always shared at /var/lib/cockpit-plugin-demos/collections/
 */
export async function getUserPaths(): Promise<UserPaths> {
  // Return cached paths if available
  if (cachedPaths) {
    return cachedPaths;
  }

  const cockpit = getCockpit();

  // Detect if running as superuser (UID 0)
  let uidOutput = '';
  const uidProcess = cockpit.spawn(['id', '-u'], { err: 'out' });
  uidProcess.stream((data: string) => {
    uidOutput += data;
  });

  await new Promise<void>((resolve, reject) => {
    if (typeof (uidProcess as any).done === 'function') {
      (uidProcess as any).done(() => {
        resolve();
      });
    } else {
      uidProcess.then(() => resolve()).catch(reject);
    }
  });

  const uid = parseInt(uidOutput.trim(), 10);
  const isSuperUser = uid === 0;

  if (isSuperUser) {
    // Superuser: use system-wide paths
    cachedPaths = {
      collections: '/var/lib/cockpit-plugin-demos/collections',
      instances: '/var/lib/cockpit-plugin-demos/instances',
      config: '/var/lib/cockpit-plugin-demos/config.json',
      artifacts: (instanceId: string) => `/var/lib/cockpit-plugin-demos/instances/${instanceId}/artifacts`
    };
  } else {
    // Regular user: get HOME directory and use per-user paths
    let homeOutput = '';
    const homeProcess = cockpit.spawn(['bash', '-c', 'echo $HOME'], { err: 'out' });
    homeProcess.stream((data: string) => {
      homeOutput += data;
    });

    await new Promise<void>((resolve, reject) => {
      if (typeof (homeProcess as any).done === 'function') {
        (homeProcess as any).done(() => {
          resolve();
        });
      } else {
        homeProcess.then(() => resolve()).catch(reject);
      }
    });

    const homeDir = homeOutput.trim() || '/root';
    const userDataDir = `${homeDir}/.local/share/cockpit-plugin-demos`;

    cachedPaths = {
      collections: '/var/lib/cockpit-plugin-demos/collections',
      instances: `${userDataDir}/instances`,
      config: `${userDataDir}/config.json`,
      artifacts: (instanceId: string) => `${userDataDir}/instances/${instanceId}/artifacts`
    };
  }

  return cachedPaths;
}

/**
 * Shared base path for collections (always system-wide)
 */
export const SHARED_BASE_PATH = '/var/lib/cockpit-plugin-demos';

/**
 * System-wide meta playbook path
 */
export const META_PLAYBOOK_PATH = '/usr/share/cockpit-plugin-demos/meta/meta_playbook.yml';

/**
 * System-wide ansible config path
 */
export const ANSIBLE_CFG_PATH = '/usr/share/cockpit-plugin-demos/meta/ansible.cfg';

