import { getPlaybookPath, getVariableDefinitions } from './catalog';
import { loadConfig } from './config';
import { CatalogConfig, DemoDefinition, Instance, InstanceSpec, InstanceStatus } from './types';

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
const META_PLAYBOOK_PATH = `${BASE_PATH}/meta/meta_playbook.yml`;

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

  const playbookPath = getPlaybookPath(config, demo.type, demo.path);
  const variableDefinitions = getVariableDefinitions(demo.parameters);

  const spec: InstanceSpec = {
    demoId: demo.id,
    demoName: demo.name,
    demoType: demo.type,
    demoPath: demo.path,
    playbook_path: playbookPath,
    parameters: formData,
    variable_definitions: variableDefinitions,
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
  return new Promise((resolve) => {
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

export async function executeInstance(
  instanceId: string,
  onOutput?: (output: string) => void
): Promise<void> {
  const instance = await getInstance(instanceId);
  const config = await loadConfig();
  const statusPath = `${INSTANCES_PATH}/${instanceId}/status.json`;

  if (!config.executionEnvironment) {
    throw new Error('Execution environment is not configured. Please configure it in settings.');
  }

  const cockpit = getCockpit();
  let outputBuffer = '';

  const updateStatus = async (updates: Partial<InstanceStatus>) => {
    try {
      const currentStatusContent = await cockpit.file(statusPath).read();
      const currentStatus: InstanceStatus = JSON.parse(currentStatusContent);
      const newStatus: InstanceStatus = {
        ...currentStatus,
        ...updates
      };
      return cockpit.file(statusPath).replace(JSON.stringify(newStatus, null, 2));
    } catch (error: any) {
      // If reading fails, try to write anyway
      const newStatus: InstanceStatus = {
        state: 'running',
        ...updates
      };
      return cockpit.file(statusPath).replace(JSON.stringify(newStatus, null, 2));
    }
  };

  await updateStatus({
    state: 'running',
    startedAt: new Date().toISOString(),
    output: ''
  });

  // Prepare extra vars for meta playbook
  // For playbooks, demo_path should be the full playbook path
  // For roles, demo_path should be the role name
  const demoPath = instance.spec.demoType === 'playbook'
    ? instance.spec.playbook_path
    : instance.spec.demoPath;

  const extraVars = {
    instance_id: instanceId,
    demo_type: instance.spec.demoType,
    demo_path: demoPath,
    demo_vars: instance.spec.parameters,
    variable_definitions: instance.spec.variable_definitions
  };

  const ansibleNavigatorArgs = [
    'ansible-navigator',
    'run',
    META_PLAYBOOK_PATH,
    '--eei', config.executionEnvironment,
    '--extra-vars', JSON.stringify(extraVars),
    '--mode', 'stdout'
  ];

  const systemdRunArgs = [
    'systemd-run',
    '--user',
    '--unit', `cockpit-demo-${instanceId}`,
    '--collect',
    '--wait',
    '--',
    ...ansibleNavigatorArgs
  ];

  return new Promise((resolve, reject) => {
    const process = cockpit.spawn(systemdRunArgs, {
      err: 'out'
    });

    process.stream((data: string) => {
      outputBuffer += data;
      if (onOutput) {
        onOutput(data);
      }
    });

    process.done(async (exitCode: number) => {
      // Try to read status.json written by meta playbook
      let finalStatus: Partial<InstanceStatus> = {
        output: outputBuffer,
        completedAt: new Date().toISOString()
      };

      try {
        const statusContent = await cockpit.file(statusPath).read();
        const playbookStatus = JSON.parse(statusContent);
        if (playbookStatus.summary) {
          finalStatus.summary = playbookStatus.summary;
        }
        if (playbookStatus.message) {
          finalStatus.message = playbookStatus.message;
        }
        if (playbookStatus.completedAt) {
          finalStatus.completedAt = playbookStatus.completedAt;
        }
      } catch (error: any) {
        // If meta playbook didn't write status, use default
        console.warn('Could not read status from meta playbook:', error);
      }

      if (exitCode === 0) {
        finalStatus.state = 'completed';
        if (!finalStatus.message) {
          finalStatus.message = 'Playbook execution completed successfully';
        }
      } else {
        finalStatus.state = 'failed';
        if (!finalStatus.error) {
          finalStatus.error = `Playbook execution failed with exit code ${exitCode}`;
        }
      }

      updateStatus(finalStatus)
        .then(() => {
          if (exitCode === 0) {
            resolve();
          } else {
            reject(new Error(finalStatus.error || 'Execution failed'));
          }
        })
        .catch((error: any) => {
          console.error('Failed to update status:', error);
          reject(error);
        });
    });

    process.fail((error: any) => {
      updateStatus({
        state: 'failed',
        error: error.message || 'Failed to start execution',
        output: outputBuffer,
        completedAt: new Date().toISOString()
      }).catch(() => { });
      reject(error);
    });
  });
}

