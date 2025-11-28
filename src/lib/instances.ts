import { InstanceSpec, InstanceStatus, Instance, DemoDefinition, CatalogConfig } from './types';
import { getPlaybookPath } from './catalog';

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

const BASE_PATH = '/var/lib/cockpit-plugin-demos';
const INSTANCES_PATH = `${BASE_PATH}/instances`;

function generateInstanceId(demoId: string): string {
  const randomStr = Math.random().toString(36).substring(2, 6).toLowerCase();
  return `${demoId}-${randomStr}`;
}

export async function createInstance(
  demo: DemoDefinition,
  formData: Record<string, any>,
  config: CatalogConfig
): Promise<string> {
  const instanceId = generateInstanceId(demo.id);
  const instancePath = `${INSTANCES_PATH}/${instanceId}`;
  const specPath = `${instancePath}/spec.json`;
  const statusPath = `${instancePath}/status.json`;

  const playbookPath = getPlaybookPath(config, demo.playbook);

  const spec: InstanceSpec = {
    demoId: demo.id,
    demoName: demo.name,
    playbook_path: playbookPath,
    parameters: formData,
    createdAt: new Date().toISOString()
  };

  const status: InstanceStatus = {
    state: 'pending',
    startedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const cockpit = getCockpit();
    cockpit.spawn(['mkdir', '-p', instancePath], { err: 'out' })
      .then(() => {
        return cockpit.file(specPath).replace(JSON.stringify(spec, null, 2));
      })
      .then(() => {
        return cockpit.file(statusPath).replace(JSON.stringify(status, null, 2));
      })
      .then(() => resolve(instanceId))
      .catch((error: any) => {
        console.error('Failed to create instance:', error);
        reject(new Error(`Failed to create instance: ${error.message}`));
      });
  });
}

export async function getInstance(instanceId: string): Promise<Instance> {
  const instancePath = `${INSTANCES_PATH}/${instanceId}`;
  const specPath = `${instancePath}/spec.json`;
  const statusPath = `${instancePath}/status.json`;

  return new Promise((resolve, reject) => {
    const cockpit = getCockpit();
    Promise.all([
      cockpit.file(specPath).read(),
      cockpit.file(statusPath).read()
    ])
      .then(([specContent, statusContent]) => {
        try {
          const spec: InstanceSpec = JSON.parse(specContent);
          const status: InstanceStatus = JSON.parse(statusContent);
          resolve({ id: instanceId, spec, status });
        } catch (error: any) {
          reject(new Error(`Failed to parse instance data: ${error.message}`));
        }
      })
      .catch((error: any) => {
        reject(new Error(`Failed to read instance: ${error.message}`));
      });
  });
}

export async function getAllInstances(): Promise<Instance[]> {
  return new Promise((resolve, reject) => {
    const cockpit = getCockpit();

    // Ensure the directory exists first
    cockpit.spawn(['mkdir', '-p', INSTANCES_PATH], { err: 'out' })
      .then(() => {
        const file = cockpit.file(INSTANCES_PATH);

        // Check if list() method exists before calling it
        if (typeof file.list !== 'function') {
          resolve([]);
          return;
        }

        return file.list();
      })
      .then((files: string[] | undefined) => {
        // If list() wasn't called (because it doesn't exist), resolve empty
        if (files === undefined) {
          resolve([]);
          return;
        }

        if (!files || files.length === 0) {
          resolve([]);
          return;
        }

        const instancePromises = files
          .filter(file => !file.startsWith('.'))
          .map(instanceId => getInstance(instanceId).catch(() => null));

        Promise.all(instancePromises)
          .then(instances => {
            resolve(instances.filter((i): i is Instance => i !== null));
          })
          .catch((err: any) => {
            // If there's an error loading instances, return empty array instead of rejecting
            console.error('Error loading instances:', err);
            resolve([]);
          });
      })
      .catch((error: any) => {
        // Any error (directory creation failed, list() not available, etc.) - return empty array
        console.error('Error in getAllInstances:', error);
        resolve([]);
      });
  });
}

export async function deleteInstance(instanceId: string): Promise<void> {
  const instancePath = `${INSTANCES_PATH}/${instanceId}`;

  return new Promise((resolve, reject) => {
    const cockpit = getCockpit();
    cockpit.spawn(['rm', '-rf', instancePath], { err: 'out' })
      .then(() => resolve())
      .catch((error: any) => {
        console.error('Failed to delete instance:', error);
        reject(new Error(`Failed to delete instance: ${error.message}`));
      });
  });
}

export async function reapplyInstance(instanceId: string): Promise<void> {
  const instance = await getInstance(instanceId);
  const statusPath = `${INSTANCES_PATH}/${instanceId}/status.json`;

  const newStatus: InstanceStatus = {
    state: 'pending',
    startedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const cockpit = getCockpit();
    cockpit.file(statusPath).replace(JSON.stringify(newStatus, null, 2))
      .then(() => resolve())
      .catch((error: any) => {
        console.error('Failed to reapply instance:', error);
        reject(new Error(`Failed to reapply instance: ${error.message}`));
      });
  });
}

