import { CatalogConfig, DemoDefinition, DemoParameter } from './types';

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
const COLLECTIONS_PATH = `${BASE_PATH}/collections/ansible_collections`;
const META_PATH = `${BASE_PATH}/meta`;
const ANSIBLE_CFG_PATH = `${META_PATH}/ansible.cfg`;

async function ensureAnsibleCfg(): Promise<void> {
  return new Promise((resolve, reject) => {
    const cockpit = getCockpit();
    cockpit.file(ANSIBLE_CFG_PATH).read()
      .then(() => resolve())
      .catch(() => {
        const ansibleCfgContent = `[defaults]
collections_paths = /var/lib/cockpit-plugin-demos/collections:~/.ansible/collections:/usr/share/ansible/collections
`;
        cockpit.spawn(['mkdir', '-p', META_PATH], { err: 'out' })
          .then(() => cockpit.file(ANSIBLE_CFG_PATH).replace(ansibleCfgContent))
          .then(() => resolve())
          .catch((error: any) => reject(error));
      });
  });
}

export async function findCollectionPath(namespace: string, collectionName: string): Promise<string | null> {
  const cockpit = getCockpit();
  const searchPaths = [
    `${COLLECTIONS_PATH}/${namespace}/${collectionName}`,
    `/usr/share/ansible/collections/ansible_collections/${namespace}/${collectionName}`
  ];

  // Try user-specific path (expand ~ if possible)
  try {
    const homeDirResult = await new Promise<string>((resolve, reject) => {
      const process = cockpit.spawn(['bash', '-c', 'echo $HOME'], { err: 'out' });
      let output = '';
      process.stream((data: string) => {
        output += data;
      });
      if (typeof (process as any).done === 'function') {
        (process as any).done(() => {
          resolve(output.trim() || '/root');
        });
      } else {
        process.then(() => resolve(output.trim() || '/root')).catch(reject);
      }
    });
    if (homeDirResult) {
      searchPaths.splice(1, 0, `${homeDirResult}/.ansible/collections/ansible_collections/${namespace}/${collectionName}`);
    }
  } catch {
    // If we can't get home directory, skip user-specific path
  }

  for (const path of searchPaths) {
    try {
      const galaxyYmlPath = `${path}/galaxy.yml`;
      await cockpit.file(galaxyYmlPath).read();
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

export interface SyncCatalogResult {
  success: boolean;
  output: string;
  warnings: string[];
}

export async function syncCatalog(config: CatalogConfig): Promise<SyncCatalogResult> {
  if (config.useLocalCollection) {
    const collectionPath = await findCollectionPath(config.namespace, config.collectionName);
    if (!collectionPath) {
      throw new Error(`Collection ${config.namespace}.${config.collectionName} not found in local Ansible collection paths`);
    }
    await ensureAnsibleCfg();
    return {
      success: true,
      output: `Collection found at: ${collectionPath}`,
      warnings: []
    };
  }

  if (!config.collectionSource) {
    throw new Error('Collection source is required when not using local collection');
  }

  if (!config.executionEnvironment) {
    throw new Error('Execution environment is required for collection installation');
  }

  await ensureAnsibleCfg();

  const collectionsDir = `${BASE_PATH}/collections`;
  const collectionSpec = config.collectionSource.startsWith('git+')
    ? config.collectionSource
    : `${config.namespace}.${config.collectionName}`;

  return new Promise((resolve, reject) => {
    const cockpit = getCockpit();

    // Ensure collections directory exists
    cockpit.spawn(['mkdir', '-p', collectionsDir], { err: 'out' })
      .then(() => {
        // Execute ansible-galaxy collection install in the execution environment
        let outputBuffer = '';
        let hasResolved = false;

        // Build ansible-galaxy command
        const ansibleGalaxyCmd = [
          'bash', '-c',
          `export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:$HOME/.local/bin:$PATH" && ` +
          `ansible-galaxy collection install "${collectionSpec}" ` +
          `--collections-path "${collectionsDir}" ` +
          `--force`
        ];

        // Execute in execution environment using podman/docker
        const installCmd = [
          'podman', 'run', '--rm',
          '-v', `${collectionsDir}:${collectionsDir}:Z`,
          '-v', `${META_PATH}:${META_PATH}:Z`,
          config.executionEnvironment!,
          ...ansibleGalaxyCmd
        ];

        const installProcess = cockpit.spawn(installCmd, { err: 'out' });

        installProcess.stream((data: string) => {
          outputBuffer += data;
          console.log('ansible-galaxy output:', data);
        });

        // Handle process completion
        if (typeof (installProcess as any).done === 'function') {
          (installProcess as any).done((exitCode: number) => {
            if (hasResolved) return;
            hasResolved = true;
            const output = outputBuffer.trim();

            // Parse warnings from output
            const warnings: string[] = [];
            const lines = output.split('\n');
            lines.forEach(line => {
              if (line.includes('[WARNING]') || line.includes('WARNING:')) {
                warnings.push(line.trim());
              }
            });

            // Check for success indicators in output first, regardless of exit code
            // ansible-galaxy may exit with non-zero code even on success if warnings are present
            const successIndicators = ['was installed successfully', 'Installed successfully'];
            const hasSuccess = successIndicators.some(indicator => output.includes(indicator));

            if (hasSuccess) {
              // Installation succeeded, even if exit code is non-zero
              resolve({
                success: true,
                output: output,
                warnings: warnings
              });
            } else if (exitCode === 0) {
              // Exit code is 0 but no clear success indicator - still treat as success
              resolve({
                success: true,
                output: output,
                warnings: warnings
              });
            } else {
              // No success indicators and non-zero exit code - treat as failure
              const errorMsg = output || `Collection installation failed with exit code ${exitCode}`;
              console.error('ansible-galaxy install failed:', errorMsg, 'Exit code:', exitCode);
              reject(new Error(`Failed to install collection: ${errorMsg}`));
            }
          });

          (installProcess as any).fail((error: any) => {
            if (hasResolved) return;
            hasResolved = true;
            const exitStatus = error?.exit_status ?? error?.exitStatus;
            let errorMsg = outputBuffer.trim();

            if (!errorMsg && exitStatus !== undefined) {
              switch (exitStatus) {
                case 1:
                  errorMsg = 'Collection installation failed. Check collection source and execution environment.';
                  break;
                case 125:
                  errorMsg = 'Container execution failed. Check execution environment configuration.';
                  break;
                default:
                  errorMsg = `Collection installation failed with exit code ${exitStatus}`;
              }
            }

            if (!errorMsg) {
              errorMsg = error?.message || error?.toString() || String(error) || 'Unknown error';
            }

            console.error('ansible-galaxy install process failed:', error, 'Exit status:', exitStatus, 'Output:', outputBuffer);
            reject(new Error(`Failed to install collection: ${errorMsg}`));
          });
        }

        // Fallback to promise chain
        installProcess.then(() => {
          if (!hasResolved) {
            hasResolved = true;
            const output = outputBuffer.trim();
            const warnings: string[] = [];
            const lines = output.split('\n');
            lines.forEach(line => {
              if (line.includes('[WARNING]') || line.includes('WARNING:')) {
                warnings.push(line.trim());
              }
            });

            // Check for success indicators in output
            const successIndicators = ['was installed successfully', 'Installed successfully'];
            const hasSuccess = successIndicators.some(indicator => output.includes(indicator));

            resolve({
              success: hasSuccess,
              output: output,
              warnings: warnings
            });
          }
        }).catch((error: any) => {
          // Even if promise rejects, check output for success indicators
          const output = outputBuffer.trim();
          const successIndicators = ['was installed successfully', 'Installed successfully'];
          const hasSuccess = successIndicators.some(indicator => output.includes(indicator));

          if (hasSuccess && !hasResolved) {
            hasResolved = true;
            const warnings: string[] = [];
            const lines = output.split('\n');
            lines.forEach(line => {
              if (line.includes('[WARNING]') || line.includes('WARNING:')) {
                warnings.push(line.trim());
              }
            });
            resolve({
              success: true,
              output: output,
              warnings: warnings
            });
            return;
          }

          if (!hasResolved) {
            hasResolved = true;
            const exitStatus = error?.exit_status ?? error?.exitStatus;
            let errorMsg = outputBuffer.trim();

            if (!errorMsg && exitStatus !== undefined) {
              switch (exitStatus) {
                case 1:
                  errorMsg = 'Collection installation failed. Check collection source and execution environment.';
                  break;
                case 125:
                  errorMsg = 'Container execution failed. Check execution environment configuration.';
                  break;
                default:
                  errorMsg = `Collection installation failed with exit code ${exitStatus}`;
              }
            }

            if (!errorMsg) {
              errorMsg = error?.message || error?.toString() || String(error) || 'Collection installation failed';
            }

            console.error('ansible-galaxy install failed:', error, 'Exit status:', exitStatus, 'Output:', outputBuffer);
            reject(new Error(`Failed to install collection: ${errorMsg}`));
          }
        });
      })
      .catch((error: any) => {
        const exitStatus = error?.exit_status ?? error?.exitStatus;
        let errorMsg = error?.message || error?.toString() || String(error);

        if (exitStatus !== undefined) {
          errorMsg = `Failed to create collections directory (exit code ${exitStatus}). ${errorMsg || 'Check permissions and disk space.'}`;
        } else if (!errorMsg) {
          errorMsg = 'Failed to create collections directory. Check permissions and disk space.';
        }

        console.error('Failed to create collections directory:', error, 'Exit status:', exitStatus);
        reject(new Error(`Failed to install collection: ${errorMsg}`));
      });
  });
}

export async function getDemos(config: CatalogConfig): Promise<DemoDefinition[]> {
  const collectionPath = await findCollectionPath(config.namespace, config.collectionName);

  if (!collectionPath) {
    throw new Error(`Collection ${config.namespace}.${config.collectionName} not found. Please sync the catalog first.`);
  }

  const demosYamlPath = `${collectionPath}/demos.yaml`;

  return new Promise((resolve, reject) => {
    getCockpit().file(demosYamlPath).read()
      .then((content: string) => {
        try {
          const demos = parseDemosYaml(content);
          resolve(demos);
        } catch (error: any) {
          reject(new Error(`Failed to parse demos.yaml: ${error.message}`));
        }
      })
      .catch((error: any) => {
        reject(new Error(`Failed to read demos.yaml: ${error.message || 'File not found'}`));
      });
  });
}

function parseDemosYaml(content: string): DemoDefinition[] {
  const lines = content.split('\n');
  const demos: DemoDefinition[] = [];
  let currentDemo: Partial<DemoDefinition> | null = null;
  let currentParameter: Partial<DemoParameter> | null = null;
  let inParameters = false;
  let parameterIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    if (trimmed.startsWith('- id:') || trimmed.match(/^-\s*id:/)) {
      if (currentDemo) {
        if (currentParameter && currentParameter.name) {
          currentDemo.parameters!.push(currentParameter as DemoParameter);
        }
        if (currentDemo.id && currentDemo.name && currentDemo.type && currentDemo.path) {
          demos.push(currentDemo as DemoDefinition);
        }
      }
      const idMatch = trimmed.match(/id:\s*(.+)/);
      currentDemo = {
        id: idMatch ? idMatch[1].trim().replace(/['"]/g, '') : '',
        parameters: [],
        type: 'playbook'
      };
      inParameters = false;
      currentParameter = null;
      parameterIndent = 0;
    } else if (currentDemo && !inParameters && trimmed.startsWith('name:')) {
      const nameMatch = trimmed.match(/name:\s*(.+)/);
      if (nameMatch) {
        currentDemo.name = nameMatch[1].trim().replace(/['"]/g, '');
      }
    } else if (currentDemo && !inParameters && trimmed.startsWith('description:')) {
      const descMatch = trimmed.match(/description:\s*(.+)/);
      if (descMatch) {
        currentDemo.description = descMatch[1].trim().replace(/['"]/g, '');
      }
    } else if (currentDemo && !inParameters && trimmed.startsWith('type:')) {
      const typeMatch = trimmed.match(/type:\s*(.+)/);
      if (typeMatch) {
        currentDemo.type = 'playbook';
      }
    } else if (currentDemo && !inParameters && (trimmed.startsWith('path:') || trimmed.startsWith('playbook:'))) {
      const pathMatch = trimmed.match(/(?:path|playbook):\s*(.+)/);
      if (pathMatch) {
        currentDemo.path = pathMatch[1].trim().replace(/['"]/g, '');
      }
    } else if (currentDemo && trimmed === 'parameters:' || trimmed.startsWith('parameters:')) {
      inParameters = true;
      parameterIndent = indent + 2;
    } else if (inParameters && (trimmed.startsWith('- name:') || trimmed.match(/^-\s*name:/))) {
      if (currentParameter && currentParameter.name) {
        currentDemo?.parameters!.push(currentParameter as DemoParameter);
      }
      const nameMatch = trimmed.match(/name:\s*(.+)/);
      currentParameter = {
        name: nameMatch ? nameMatch[1].trim().replace(/['"]/g, '') : '',
        type: 'text',
        required: false
      };
    } else if (currentParameter && inParameters && indent >= parameterIndent) {
      if (trimmed.startsWith('label:')) {
        const labelMatch = trimmed.match(/label:\s*(.+)/);
        if (labelMatch) {
          currentParameter.label = labelMatch[1].trim().replace(/['"]/g, '');
        }
      } else if (trimmed.startsWith('description:')) {
        const descMatch = trimmed.match(/description:\s*(.+)/);
        if (descMatch) {
          currentParameter.description = descMatch[1].trim().replace(/['"]/g, '');
        }
      } else if (trimmed.startsWith('type:')) {
        const typeMatch = trimmed.match(/type:\s*(.+)/);
        if (typeMatch) {
          const typeValue = typeMatch[1].trim().replace(/['"]/g, '');
          currentParameter.type = typeValue as 'text' | 'number' | 'boolean' | 'select';
        }
      } else if (trimmed.startsWith('required:')) {
        const requiredMatch = trimmed.match(/required:\s*(.+)/);
        if (requiredMatch) {
          const requiredValue = requiredMatch[1].trim().replace(/['"]/g, '');
          currentParameter.required = requiredValue === 'true';
        }
      } else if (trimmed.startsWith('options:')) {
        const optionsMatch = trimmed.match(/options:\s*(.+)/);
        if (optionsMatch) {
          const optionsLine = optionsMatch[1].trim();
          if (optionsLine.startsWith('[')) {
            const optionsStr = optionsLine.replace(/[[\]]/g, '');
            currentParameter.options = optionsStr.split(',').map(opt => opt.trim().replace(/['"]/g, ''));
          } else {
            let j = i + 1;
            const options: string[] = [];
            while (j < lines.length && lines[j].trim().startsWith('-')) {
              const optLine = lines[j].trim();
              const optMatch = optLine.match(/^-\s*(.+)/);
              if (optMatch) {
                options.push(optMatch[1].trim().replace(/['"]/g, ''));
              }
              j++;
            }
            if (options.length > 0) {
              currentParameter.options = options;
            }
          }
        } else {
          // Handle case where options: is on its own line, followed by list items
          let j = i + 1;
          const options: string[] = [];
          const optionsIndent = indent;
          while (j < lines.length) {
            const optLine = lines[j];
            const optIndent = optLine.length - optLine.trimStart().length;
            const optTrimmed = optLine.trim();

            // Stop if we hit a line with same or less indentation than options: (another property or end of parameter)
            if (optIndent <= optionsIndent && optTrimmed !== '' && !optTrimmed.startsWith('-')) {
              break;
            }

            // Only parse lines that start with '-' and are more indented than options:
            if (optTrimmed.startsWith('-') && optIndent > optionsIndent) {
              const optMatch = optTrimmed.match(/^-\s*(.+)/);
              if (optMatch) {
                options.push(optMatch[1].trim().replace(/['"]/g, ''));
              }
            }
            j++;
          }
          if (options.length > 0) {
            currentParameter.options = options;
          }
        }
      } else if (trimmed.startsWith('default:')) {
        const defaultMatch = trimmed.match(/default:\s*(.+)/);
        if (defaultMatch) {
          const defaultValue = defaultMatch[1].trim().replace(/['"]/g, '');
          if (defaultValue === 'true' || defaultValue === 'false') {
            currentParameter.default = defaultValue === 'true';
          } else if (!isNaN(Number(defaultValue)) && defaultValue !== '') {
            currentParameter.default = Number(defaultValue);
          } else {
            currentParameter.default = defaultValue;
          }
        }
      }
    } else if (inParameters && indent < parameterIndent && trimmed !== '') {
      inParameters = false;
    }
  }

  if (currentDemo) {
    if (currentParameter && currentParameter.name) {
      currentDemo.parameters!.push(currentParameter as DemoParameter);
    }
    if (currentDemo.id && currentDemo.name && currentDemo.type && currentDemo.path) {
      demos.push(currentDemo as DemoDefinition);
    }
  }

  return demos;
}

export async function getCatalogPath(config: CatalogConfig): Promise<string> {
  const path = await findCollectionPath(config.namespace, config.collectionName);
  if (!path) {
    throw new Error(`Collection ${config.namespace}.${config.collectionName} not found`);
  }
  return path;
}

export async function getPlaybookPath(config: CatalogConfig, demoType: 'playbook', path: string): Promise<string> {
  const collectionPath = await getCatalogPath(config);
  return `${collectionPath}/playbooks/${path}`;
}

export function getVariableDefinitions(parameters: DemoParameter[]): DemoParameter[] {
  return parameters.map(param => ({
    name: param.name,
    label: param.label,
    description: param.description,
    type: param.type,
    required: param.required,
    options: param.options
  }));
}

