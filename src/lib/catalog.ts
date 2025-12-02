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
const CATALOG_PATH = `${BASE_PATH}/catalog`;
const COLLECTIONS_PATH = `${CATALOG_PATH}/ansible_collections`;

export async function syncCatalog(config: CatalogConfig): Promise<void> {
  const collectionPath = `${COLLECTIONS_PATH}/${config.namespace}/${config.collectionName}`;
  const gitDirPath = `${collectionPath}/.git`;

  return new Promise((resolve, reject) => {
    const cockpit = getCockpit();

    // Helper function to clone the repository
    const cloneRepository = () => {
      // Ensure the parent directory of collectionPath exists (mkdir -p creates all nested dirs)
      const parentDir = collectionPath.substring(0, collectionPath.lastIndexOf('/'));
      console.log('parentDir', parentDir);
      console.log('collectionPath', collectionPath);
      cockpit.spawn(['mkdir', '-p', parentDir], { err: 'out' })
        .then(() => {
          // Remove existing directory if it exists but isn't a git repo
          return cockpit.spawn(['rm', '-rf', collectionPath], { err: 'out' }).catch(() => {
            // Ignore errors if directory doesn't exist
          });
        })
        .then(() => {
          // Now clone the repository
          let outputBuffer = '';
          let hasResolved = false;
          const cloneProcess = cockpit.spawn(['git', 'clone', config.repoUrl, collectionPath], { err: 'out' });

          cloneProcess.stream((data: string) => {
            outputBuffer += data;
          });

          // Try to use done() callback if available
          if (typeof (cloneProcess as any).done === 'function') {
            (cloneProcess as any).done((exitCode: number) => {
              if (hasResolved) return;
              hasResolved = true;
              if (exitCode === 0) {
                resolve();
              } else {
                const errorMsg = outputBuffer.trim() || `Git clone failed with exit code ${exitCode}`;
                console.error('Git clone failed:', errorMsg, 'Exit code:', exitCode);
                reject(new Error(`Failed to clone catalog: ${errorMsg}`));
              }
            });

            (cloneProcess as any).fail((error: any) => {
              if (hasResolved) return;
              hasResolved = true;
              const exitStatus = error?.exit_status ?? error?.exitStatus;
              let errorMsg = outputBuffer.trim();

              if (!errorMsg && exitStatus !== undefined) {
                switch (exitStatus) {
                  case 128:
                    errorMsg = 'Git clone failed (exit code 128). This may indicate authentication failure, repository not found, or permission denied.';
                    break;
                  case 1:
                    errorMsg = 'Git clone failed (exit code 1). Check repository URL and permissions.';
                    break;
                  default:
                    errorMsg = `Git clone failed with exit code ${exitStatus}`;
                }
              }

              if (!errorMsg) {
                errorMsg = error?.message || error?.toString() || String(error) || 'Unknown error';
              }

              console.error('Git clone process failed:', error, 'Exit status:', exitStatus, 'Output:', outputBuffer);
              reject(new Error(`Failed to clone catalog: ${errorMsg}`));
            });
          }

          // Fallback to promise chain
          cloneProcess.then(() => {
            if (!hasResolved) {
              hasResolved = true;
              resolve();
            }
          }).catch((error: any) => {
            if (!hasResolved) {
              hasResolved = true;
              const exitStatus = error?.exit_status ?? error?.exitStatus;
              let errorMsg = outputBuffer.trim();

              if (!errorMsg && exitStatus !== undefined) {
                switch (exitStatus) {
                  case 128:
                    errorMsg = 'Git clone failed (exit code 128). This may indicate authentication failure, repository not found, or permission denied.';
                    break;
                  case 1:
                    errorMsg = 'Git clone failed (exit code 1). Check repository URL and permissions.';
                    break;
                  default:
                    errorMsg = `Git clone failed with exit code ${exitStatus}`;
                }
              }

              if (!errorMsg) {
                errorMsg = error?.message || error?.toString() || String(error) || 'Git clone failed';
              }

              console.error('Git clone failed:', error, 'Exit status:', exitStatus, 'Output:', outputBuffer);
              reject(new Error(`Failed to clone catalog: ${errorMsg}`));
            }
          });
        })
        .catch((error: any) => {
          const exitStatus = error?.exit_status ?? error?.exitStatus;
          let errorMsg = error?.message || error?.toString() || String(error);

          if (exitStatus !== undefined) {
            errorMsg = `Failed to create directory structure (exit code ${exitStatus}). ${errorMsg || 'Check permissions and disk space.'}`;
          } else if (!errorMsg) {
            errorMsg = 'Failed to create directory structure. Check permissions and disk space.';
          }

          console.error('Failed to create directory:', error, 'Exit status:', exitStatus);
          reject(new Error(`Failed to clone catalog: ${errorMsg}`));
        });
    };

    // Check if git repository exists by trying to read .git/HEAD file
    cockpit.file(`${gitDirPath}/HEAD`).read()
      .then(() => {
        // Git repository appears to exist, try to pull latest changes
        let outputBuffer = '';
        let hasResolved = false;
        const process = cockpit.spawn(['git', '-C', collectionPath, 'pull'], { err: 'out' });

        process.stream((data: string) => {
          outputBuffer += data;
        });

        // Try to use done() callback if available
        if (typeof (process as any).done === 'function') {
          (process as any).done((exitCode: number) => {
            if (hasResolved) return;
            hasResolved = true;
            if (exitCode === 0) {
              resolve();
            } else {
              const errorMsg = outputBuffer.trim() || `Git pull failed with exit code ${exitCode}`;
              console.error('Git pull failed:', errorMsg, 'Exit code:', exitCode);
              reject(new Error(`Failed to pull catalog: ${errorMsg}`));
            }
          });

          (process as any).fail((error: any) => {
            if (hasResolved) return;
            hasResolved = true;
            const exitStatus = error?.exit_status ?? error?.exitStatus;
            let errorMsg = outputBuffer.trim();

            // If directory doesn't exist, fall back to clone
            if (errorMsg.includes('cannot change to') || errorMsg.includes('No such file or directory')) {
              console.warn('Directory does not exist, falling back to clone');
              cloneRepository();
              return;
            }

            if (!errorMsg && exitStatus !== undefined) {
              // Provide meaningful messages for common git error codes
              switch (exitStatus) {
                case 128:
                  errorMsg = 'Git operation failed (exit code 128). This may indicate authentication failure, repository not found, or permission denied.';
                  break;
                case 1:
                  errorMsg = 'Git operation failed (exit code 1). Check repository URL and permissions.';
                  break;
                default:
                  errorMsg = `Git pull failed with exit code ${exitStatus}`;
              }
            }

            if (!errorMsg) {
              errorMsg = error?.message || error?.toString() || String(error) || 'Unknown error';
            }

            console.error('Git pull process failed:', error, 'Exit status:', exitStatus, 'Output:', outputBuffer);
            reject(new Error(`Failed to pull catalog: ${errorMsg}`));
          });
        }

        // Fallback to promise chain
        process.then(() => {
          if (!hasResolved) {
            hasResolved = true;
            resolve();
          }
        }).catch((error: any) => {
          if (!hasResolved) {
            hasResolved = true;
            const exitStatus = error?.exit_status ?? error?.exitStatus;
            let errorMsg = outputBuffer.trim();

            // If directory doesn't exist, fall back to clone
            if (errorMsg.includes('cannot change to') || errorMsg.includes('No such file or directory')) {
              console.warn('Directory does not exist, falling back to clone');
              cloneRepository();
              return;
            }

            if (!errorMsg && exitStatus !== undefined) {
              switch (exitStatus) {
                case 128: {
                  // Check if it's a directory issue - check both errorMsg and outputBuffer
                  const fullError = (errorMsg + ' ' + outputBuffer).toLowerCase();
                  if (fullError.includes('cannot change to') || fullError.includes('no such file or directory')) {
                    console.warn('Directory does not exist, falling back to clone');
                    cloneRepository();
                    return;
                  }
                  errorMsg = 'Git operation failed (exit code 128). This may indicate authentication failure, repository not found, or permission denied.';
                  break;
                }
                case 1:
                  errorMsg = 'Git operation failed (exit code 1). Check repository URL and permissions.';
                  break;
                default:
                  errorMsg = `Git pull failed with exit code ${exitStatus}`;
              }
            }

            if (!errorMsg) {
              errorMsg = error?.message || error?.toString() || String(error) || 'Git pull failed';
            }

            console.error('Git pull failed:', error, 'Exit status:', exitStatus, 'Output:', outputBuffer);
            reject(new Error(`Failed to pull catalog: ${errorMsg}`));
          }
        });
      })
      .catch(() => {
        // Git repository doesn't exist, clone the repo
        // Ensure the parent directory of collectionPath exists (mkdir -p creates all nested dirs)
        const parentDir = collectionPath.substring(0, collectionPath.lastIndexOf('/'));
        cockpit.spawn(['mkdir', '-p', parentDir], { err: 'out' })
          .then(() => {
            // Remove existing directory if it exists but isn't a git repo
            return cockpit.spawn(['rm', '-rf', collectionPath], { err: 'out' }).catch(() => {
              // Ignore errors if directory doesn't exist
            });
          })
          .then(() => {
            // Now clone the repository
            let outputBuffer = '';
            let hasResolved = false;
            const cloneProcess = cockpit.spawn(['git', 'clone', config.repoUrl, collectionPath], { err: 'out' });

            cloneProcess.stream((data: string) => {
              outputBuffer += data;
            });

            // Try to use done() callback if available
            if (typeof (cloneProcess as any).done === 'function') {
              (cloneProcess as any).done((exitCode: number) => {
                if (hasResolved) return;
                hasResolved = true;
                if (exitCode === 0) {
                  resolve();
                } else {
                  const errorMsg = outputBuffer.trim() || `Git clone failed with exit code ${exitCode}`;
                  console.error('Git clone failed:', errorMsg, 'Exit code:', exitCode);
                  reject(new Error(`Failed to clone catalog: ${errorMsg}`));
                }
              });

              (cloneProcess as any).fail((error: any) => {
                if (hasResolved) return;
                hasResolved = true;
                const exitStatus = error?.exit_status ?? error?.exitStatus;
                let errorMsg = outputBuffer.trim();

                if (!errorMsg && exitStatus !== undefined) {
                  switch (exitStatus) {
                    case 128:
                      errorMsg = 'Git clone failed (exit code 128). This may indicate authentication failure, repository not found, or permission denied.';
                      break;
                    case 1:
                      errorMsg = 'Git clone failed (exit code 1). Check repository URL and permissions.';
                      break;
                    default:
                      errorMsg = `Git clone failed with exit code ${exitStatus}`;
                  }
                }

                if (!errorMsg) {
                  errorMsg = error?.message || error?.toString() || String(error) || 'Unknown error';
                }

                console.error('Git clone process failed:', error, 'Exit status:', exitStatus, 'Output:', outputBuffer);
                reject(new Error(`Failed to clone catalog: ${errorMsg}`));
              });
            }

            // Fallback to promise chain
            cloneProcess.then(() => {
              if (!hasResolved) {
                hasResolved = true;
                resolve();
              }
            }).catch((error: any) => {
              if (!hasResolved) {
                hasResolved = true;
                const exitStatus = error?.exit_status ?? error?.exitStatus;
                let errorMsg = outputBuffer.trim();

                if (!errorMsg && exitStatus !== undefined) {
                  switch (exitStatus) {
                    case 128:
                      errorMsg = 'Git clone failed (exit code 128). This may indicate authentication failure, repository not found, or permission denied.';
                      break;
                    case 1:
                      errorMsg = 'Git clone failed (exit code 1). Check repository URL and permissions.';
                      break;
                    default:
                      errorMsg = `Git clone failed with exit code ${exitStatus}`;
                  }
                }

                if (!errorMsg) {
                  errorMsg = error?.message || error?.toString() || String(error) || 'Git clone failed';
                }

                console.error('Git clone failed:', error, 'Exit status:', exitStatus, 'Output:', outputBuffer);
                reject(new Error(`Failed to clone catalog: ${errorMsg}`));
              }
            });
          })
          .catch((error: any) => {
            const exitStatus = error?.exit_status ?? error?.exitStatus;
            let errorMsg = error?.message || error?.toString() || String(error);

            if (exitStatus !== undefined) {
              errorMsg = `Failed to create directory structure (exit code ${exitStatus}). ${errorMsg || 'Check permissions and disk space.'}`;
            } else if (!errorMsg) {
              errorMsg = 'Failed to create directory structure. Check permissions and disk space.';
            }

            console.error('Failed to create directory:', error, 'Exit status:', exitStatus);
            reject(new Error(`Failed to clone catalog: ${errorMsg}`));
          });
      });
  });
}

export async function getDemos(config: CatalogConfig): Promise<DemoDefinition[]> {
  const collectionPath = `${COLLECTIONS_PATH}/${config.namespace}/${config.collectionName}`;
  const demosYamlPath = `${collectionPath}/demos.yaml`;

  return new Promise((resolve, reject) => {
    getCockpit().file(demosYamlPath).read()
      .then(async (content: string) => {
        try {
          const demos = parseDemosYaml(content);

          // For role-based demos, discover and merge role variables
          const enrichedDemos = await Promise.all(
            demos.map(async (demo) => {
              if (demo.type === 'role') {
                try {
                  const roleVars = await discoverRoleVariables(config, demo.path);
                  demo.parameters = mergeRoleAndDemoParameters(roleVars, demo.parameters);
                } catch (error: any) {
                  console.warn(`Failed to discover role variables for ${demo.id}: ${error.message}`);
                  // Continue with demos.yaml parameters only
                }
              }
              return demo;
            })
          );

          resolve(enrichedDemos);
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
        const typeValue = typeMatch[1].trim().replace(/['"]/g, '');
        currentDemo.type = typeValue as 'playbook' | 'role';
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

interface RoleVariable {
  name: string;
  defaultValue: any;
  label?: string;
  description?: string;
}

async function discoverRoleVariables(config: CatalogConfig, roleName: string): Promise<RoleVariable[]> {
  const collectionPath = getCatalogPath(config);
  const roleDefaultsPath = `${collectionPath}/roles/${roleName}/defaults/main.yml`;

  return new Promise((resolve, reject) => {
    getCockpit().file(roleDefaultsPath).read()
      .then((content: string) => {
        try {
          if (!content || typeof content !== 'string') {
            // File exists but is empty or invalid, return empty array
            resolve([]);
            return;
          }
          const roleVars = parseRoleDefaults(content);
          resolve(roleVars);
        } catch (error: any) {
          reject(new Error(`Failed to parse role defaults: ${error.message}`));
        }
      })
      .catch((error: any) => {
        reject(new Error(`Failed to read role defaults: ${error.message || 'File not found'}`));
      });
  });
}

function parseRoleDefaults(content: string): RoleVariable[] {
  if (!content || typeof content !== 'string') {
    return [];
  }
  const lines = content.split('\n');
  const variables: Map<string, RoleVariable> = new Map();
  let currentVar: string | null = null;
  let inMultiline = false;
  let multilineValue: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') {
      continue;
    }

    // Match variable assignment: variable_name: value
    const varMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.+)$/);
    if (varMatch) {
      const varName = varMatch[1];
      const varValue = varMatch[2].trim();

      // Skip metadata keys (_label, _description)
      if (varName.endsWith('_label') || varName.endsWith('_description')) {
        const baseName = varName.replace(/_label$|_description$/, '');
        if (variables.has(baseName)) {
          const existing = variables.get(baseName)!;
          if (varName.endsWith('_label')) {
            existing.label = varValue.replace(/['"]/g, '');
          } else {
            existing.description = varValue.replace(/['"]/g, '');
          }
        }
        continue;
      }

      // Handle multiline strings
      if (varValue === '|' || varValue === '>') {
        inMultiline = true;
        multilineValue = [];
        currentVar = varName;
        continue;
      }

      // Parse value
      let parsedValue: any = varValue.replace(/['"]/g, '');
      if (parsedValue === 'true') parsedValue = true;
      else if (parsedValue === 'false') parsedValue = false;
      else if (!isNaN(Number(parsedValue)) && parsedValue !== '') parsedValue = Number(parsedValue);

      variables.set(varName, {
        name: varName,
        defaultValue: parsedValue
      });
      currentVar = null;
    } else if (inMultiline && currentVar) {
      // Handle multiline continuation
      if (trimmed === '' || trimmed.match(/^\s+/)) {
        multilineValue.push(line);
      } else {
        // End of multiline
        if (variables.has(currentVar)) {
          variables.get(currentVar)!.defaultValue = multilineValue.join('\n');
        }
        inMultiline = false;
        currentVar = null;
        multilineValue = [];
      }
    }
  }

  return Array.from(variables.values());
}

function mergeRoleAndDemoParameters(
  roleVars: RoleVariable[],
  demoParams: DemoParameter[]
): DemoParameter[] {
  const merged: DemoParameter[] = [];
  const demoParamMap = new Map<string, DemoParameter>();

  // Index demo parameters by name
  demoParams.forEach(param => {
    demoParamMap.set(param.name, param);
  });

  // Process variables that exist in both
  const processedVars = new Set<string>();
  demoParams.forEach(demoParam => {
    const roleVar = roleVars.find(rv => rv.name === demoParam.name);
    processedVars.add(demoParam.name);

    const mergedParam: DemoParameter = {
      name: demoParam.name,
      label: demoParam.label || roleVar?.label || demoParam.name,
      description: demoParam.description || roleVar?.description || '',
      type: demoParam.type,
      required: demoParam.required,
      default: demoParam.default !== undefined ? demoParam.default : roleVar?.defaultValue,
      options: demoParam.options
    };

    merged.push(mergedParam);
  });

  // Add variables only in role
  roleVars.forEach(roleVar => {
    if (!processedVars.has(roleVar.name)) {
      merged.push({
        name: roleVar.name,
        label: roleVar.label || roleVar.name,
        description: roleVar.description || '',
        type: 'text',
        required: false,
        default: roleVar.defaultValue
      });
    }
  });

  return merged;
}

export function getCatalogPath(config: CatalogConfig): string {
  return `${COLLECTIONS_PATH}/${config.namespace}/${config.collectionName}`;
}

export function getPlaybookPath(config: CatalogConfig, demoType: 'playbook' | 'role', path: string): string {
  const collectionPath = getCatalogPath(config);
  if (demoType === 'playbook') {
    return `${collectionPath}/playbooks/${path}`;
  } else {
    return path; // Role name, used directly
  }
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

