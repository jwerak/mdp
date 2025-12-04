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

  const playbookPath = await getPlaybookPath(config, demo.type, demo.path);
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
        // Use ls command directly as file.list() may not work reliably for directories
        let outputBuffer = '';
        const lsProcess = cockpit.spawn(['ls', '-1', INSTANCES_PATH], { err: 'out' });

        lsProcess.stream((data: string) => {
          outputBuffer += data;
          console.log('ls stream data:', data);
        });

        return new Promise<string[]>((resolveLs) => {
          let hasResolved = false;

          const resolveOnce = (result: string[]) => {
            if (!hasResolved) {
              hasResolved = true;
              resolveLs(result);
            }
          };

          // Handle done callback if available (preferred method)
          if (typeof (lsProcess as any).done === 'function') {
            (lsProcess as any).done((exitCode: number | undefined) => {
              console.log('ls done callback, exit code:', exitCode, 'outputBuffer length:', outputBuffer.length, 'content:', outputBuffer);
              // If we have output, use it regardless of exit code (exit code might be undefined in some cases)
              if (outputBuffer.trim()) {
                const fileList = outputBuffer.trim().split('\n').filter(f => f && !f.startsWith('.'));
                console.log('ls command found directories (via done):', fileList);
                resolveOnce(fileList);
              } else if (exitCode === 0 || exitCode === undefined) {
                // Exit code 0 or undefined with no output means empty directory
                console.log('ls command succeeded but output is empty (exit code:', exitCode, ')');
                resolveOnce([]);
              } else {
                // Non-zero exit code with no output - wait for promise chain as fallback
                console.log('ls command failed with exit code:', exitCode, '- waiting for promise chain');
              }
            });
          }

          // Handle fail callback if available
          if (typeof (lsProcess as any).fail === 'function') {
            (lsProcess as any).fail((error: any) => {
              console.error('ls command failed (via fail):', error);
              resolveOnce([]);
            });
          }

          // Also handle the promise chain as fallback
          lsProcess.then(() => {
            console.log('ls promise resolved, outputBuffer length:', outputBuffer.length, 'content:', outputBuffer);
            // Small delay to ensure stream has finished
            setTimeout(() => {
              if (outputBuffer.trim()) {
                const fileList = outputBuffer.trim().split('\n').filter(f => f && !f.startsWith('.'));
                console.log('ls command found directories (via promise):', fileList);
                resolveOnce(fileList);
              } else {
                console.log('ls command returned empty output (via promise)');
                resolveOnce([]);
              }
            }, 100);
          }).catch((error: any) => {
            console.error('ls promise rejected:', error);
            resolveOnce([]);
          });
        });
      })
      .then((files: string[]) => {
        if (!files || files.length === 0) {
          console.log('No instance directories found');
          resolve([]);
          return;
        }

        console.log(`Found ${files.length} instance directories:`, files);

        const instancePromises = files
          .filter(file => !file.startsWith('.'))
          .map(instanceId =>
            getInstance(instanceId)
              .then(instance => {
                console.log('Successfully loaded instance:', instanceId);
                return instance;
              })
              .catch((err: any) => {
                console.error(`Failed to load instance ${instanceId}:`, err);
                return null;
              })
          );

        Promise.all(instancePromises)
          .then(instances => {
            const validInstances = instances.filter((i): i is Instance => i !== null);
            console.log(`Loaded ${validInstances.length} instances out of ${files.length} directories`);
            resolve(validInstances);
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

export async function updateInstanceStatus(
  instanceId: string,
  updates: Partial<InstanceStatus>
): Promise<void> {
  const statusPath = `${INSTANCES_PATH}/${instanceId}/status.json`;
  const cockpit = getCockpit();

  return new Promise((resolve, reject) => {
    cockpit.file(statusPath).read()
      .then((content: string) => {
        try {
          const currentStatus: InstanceStatus = JSON.parse(content);
          const newStatus: InstanceStatus = {
            ...currentStatus,
            ...updates
          };
          return cockpit.file(statusPath).replace(JSON.stringify(newStatus, null, 2));
        } catch (error: any) {
          // If parsing fails, create new status
          const newStatus: InstanceStatus = {
            state: 'pending',
            ...updates
          };
          return cockpit.file(statusPath).replace(JSON.stringify(newStatus, null, 2));
        }
      })
      .then(() => resolve())
      .catch(() => {
        // If file doesn't exist, create it
        const newStatus: InstanceStatus = {
          state: 'pending',
          ...updates
        };
        cockpit.file(statusPath).replace(JSON.stringify(newStatus, null, 2))
          .then(() => resolve())
          .catch((err: any) => {
            reject(new Error(`Failed to update instance status: ${err.message}`));
          });
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
  const demoPath = instance.spec.playbook_path;

  const extraVars = {
    instance_id: instanceId,
    demo_type: instance.spec.demoType,
    demo_path: demoPath,
    demo_vars: instance.spec.parameters,
    variable_definitions: instance.spec.variable_definitions
  };

  // Build collections paths for ansible-navigator
  const collectionsPaths = [
    '/var/lib/cockpit-plugin-demos/collections',
    '~/.ansible/collections',
    '/usr/share/ansible/collections'
  ].join(',');

  // systemd-run --user doesn't inherit full PATH, so we wrap in bash with explicit PATH
  // This ensures ansible-navigator can be found in common installation locations
  const ansibleNavigatorCmd = [
    'bash', '-c',
    `export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:$HOME/.local/bin:$PATH" && ` +
    `ansible-navigator run "${META_PLAYBOOK_PATH}" ` +
    `--eei "${config.executionEnvironment}" ` +
    `--collections-path "${collectionsPaths}" ` +
    `--extra-vars '${JSON.stringify(extraVars)}' ` +
    `--mode stdout ` +
    `--pull-policy missing`
  ];

  const systemdRunArgs = [
    'systemd-run',
    '--user',
    '--unit', `cockpit-demo-${instanceId}`,
    '--collect',
    '--wait',
    '--',
    ...ansibleNavigatorCmd
  ];

  return new Promise((resolve, reject) => {
    let hasRejected = false;

    const handleError = async (error: any, errorMessage: string) => {
      if (hasRejected) return;
      hasRejected = true;

      const finalErrorMsg = errorMessage || error?.message || error?.toString() || 'Execution failed';

      try {
        await updateStatus({
          state: 'failed',
          error: finalErrorMsg,
          output: outputBuffer.trim() || finalErrorMsg,
          completedAt: new Date().toISOString()
        });
      } catch (statusErr: any) {
        console.error('Failed to update status to failed:', statusErr);
      }

      reject(new Error(finalErrorMsg));
    };

    let process;
    try {
      process = cockpit.spawn(systemdRunArgs, {
        err: 'out'
      });
    } catch (spawnError: any) {
      // If spawn fails immediately, update status and reject
      handleError(spawnError, `Failed to start execution: ${spawnError?.message || 'Unknown error'}`);
      return;
    }

    process.stream((data: string) => {
      outputBuffer += data;
      if (onOutput) {
        onOutput(data);
      }
    });

    process.done(async (exitCode: number) => {
      // Try to read status.json written by meta playbook
      const finalStatus: Partial<InstanceStatus> = {
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

    process.fail(async (error: any) => {
      let errorMsg = outputBuffer.trim();

      if (!errorMsg) {
        errorMsg = error?.message || error?.toString() || 'Failed to start execution';
      }

      // Extract error from output if available
      if (outputBuffer.includes('Failed to find executable') || outputBuffer.includes('No such file')) {
        errorMsg = outputBuffer.split('\n').find(line =>
          line.includes('Failed') || line.includes('No such file')
        ) || errorMsg;
      }

      try {
        await updateStatus({
          state: 'failed',
          error: errorMsg,
          output: outputBuffer || errorMsg,
          completedAt: new Date().toISOString()
        });
        console.log('Instance status updated to failed after process.fail');
      } catch (statusErr: any) {
        console.error('Failed to update status in process.fail:', statusErr);
      }

      reject(new Error(errorMsg));
    });
  });
}

