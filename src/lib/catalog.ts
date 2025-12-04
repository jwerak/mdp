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

export async function ensureAnsibleCfg(): Promise<void> {
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

export interface GalaxyMetadata {
  namespace: string;
  collectionName: string;
}

export async function readManifestMetadata(collectionPath: string): Promise<GalaxyMetadata> {
  const cockpit = getCockpit();
  const manifestJsonPath = `${collectionPath}/MANIFEST.json`;

  // Retry mechanism for potential timing issues after installation
  const maxRetries = 3;
  const retryDelay = 500; // milliseconds

  console.log(`Attempting to read MANIFEST.json from: ${manifestJsonPath}`);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const content = await cockpit.file(manifestJsonPath).read();

      if (!content || content.trim() === '') {
        if (attempt < maxRetries - 1) {
          console.log(`MANIFEST.json appears empty at ${manifestJsonPath}, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        console.error(`MANIFEST.json file is empty at ${manifestJsonPath} after ${maxRetries} attempts`);
        throw new Error(`MANIFEST.json file is empty or could not be read at ${manifestJsonPath}`);
      }

      const manifest = JSON.parse(content);
      const collectionInfo = manifest.collection_info;

      if (!collectionInfo) {
        throw new Error(`MANIFEST.json missing collection_info object at ${manifestJsonPath}`);
      }

      const namespace = collectionInfo.namespace;
      const collectionName = collectionInfo.name;

      if (!namespace || !collectionName) {
        throw new Error(`Failed to extract namespace or name from MANIFEST.json at ${manifestJsonPath}. Found namespace: ${namespace}, name: ${collectionName}`);
      }

      return { namespace, collectionName };
    } catch (error: any) {
      if (attempt < maxRetries - 1 && (error.message?.includes('not found') || error.message?.includes('empty') || error.message?.includes('Unexpected token'))) {
        console.log(`Failed to read MANIFEST.json at ${manifestJsonPath}, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      throw new Error(`Failed to read MANIFEST.json at ${manifestJsonPath}: ${error.message || 'File not found'}`);
    }
  }

  throw new Error(`Failed to read MANIFEST.json at ${manifestJsonPath} after ${maxRetries} attempts`);
}

async function findInstalledCollection(collectionsDir: string): Promise<{ namespace: string; collectionName: string; path: string } | null> {
  const cockpit = getCockpit();
  const ansibleCollectionsPath = `${collectionsDir}/ansible_collections`;

  try {
    // List all namespaces
    const namespaces = await new Promise<string[]>((resolve, reject) => {
      const process = cockpit.spawn(['bash', '-c', `find "${ansibleCollectionsPath}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | xargs -n1 basename`], { err: 'out' });
      let output = '';
      process.stream((data: string) => {
        output += data;
      });
      if (typeof (process as any).done === 'function') {
        (process as any).done(() => {
          resolve(output.trim().split('\n').filter(n => n));
        });
      } else {
        process.then(() => resolve(output.trim().split('\n').filter(n => n))).catch(reject);
      }
      if (typeof (process as any).fail === 'function') {
        (process as any).fail(() => resolve([]));
      }
    });

    // For each namespace, find collections
    for (const namespace of namespaces) {
      const namespacePath = `${ansibleCollectionsPath}/${namespace}`;
      try {
        const collections = await new Promise<string[]>((resolve, reject) => {
          const process = cockpit.spawn(['bash', '-c', `find "${namespacePath}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | xargs -n1 basename`], { err: 'out' });
          let output = '';
          process.stream((data: string) => {
            output += data;
          });
          if (typeof (process as any).done === 'function') {
            (process as any).done(() => {
              resolve(output.trim().split('\n').filter(n => n));
            });
          } else {
            process.then(() => resolve(output.trim().split('\n').filter(n => n))).catch(reject);
          }
          if (typeof (process as any).fail === 'function') {
            (process as any).fail(() => resolve([]));
          }
        });

        for (const collectionName of collections) {
          const collectionPath = `${namespacePath}/${collectionName}`;
          try {
            // Check if MANIFEST.json exists
            await cockpit.file(`${collectionPath}/MANIFEST.json`).read();
            return { namespace, collectionName, path: collectionPath };
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // If listing fails, try a simpler approach: check if we have expected values
  }

  return null;
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
      const manifestJsonPath = `${path}/MANIFEST.json`;
      await cockpit.file(manifestJsonPath).read();
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
  namespace?: string;
  collectionName?: string;
}

async function extractCollectionMetadata(
  output: string,
  expectedNamespace: string | undefined,
  expectedCollectionName: string | undefined,
  collectionsDir: string,
  config: CatalogConfig
): Promise<{ namespace?: string; collectionName?: string }> {
  let finalNamespace = expectedNamespace;
  let finalCollectionName = expectedCollectionName;
  let collectionPath: string | null = null;

  // First, try to parse the installation path from ansible-galaxy output
  // Look for lines like "Installing 'namespace.collection:version' to '/path/to/collection'"
  const installPathMatch = output.match(/Installing\s+['"]([^'"]+)['"]\s+to\s+['"]([^'"]+)['"]/);
  if (installPathMatch && installPathMatch[2]) {
    collectionPath = installPathMatch[2];
    console.log(`Parsed installation path from output: ${collectionPath}`);
  }

  // Try to find the installed collection and read its MANIFEST.json
  if (expectedNamespace && expectedCollectionName) {
    // If we have expected values, try to find the collection path
    const foundPath = await findCollectionPath(expectedNamespace, expectedCollectionName);
    if (foundPath) {
      collectionPath = foundPath;
    }
  } else if (!collectionPath) {
    // For git+ URLs or when we don't have namespace/collectionName, search for installed collection
    const installed = await findInstalledCollection(collectionsDir);
    if (installed) {
      collectionPath = installed.path;
    }
  }

  // If we have a collection path, read its metadata
  if (collectionPath) {
    try {
      const metadata = await readManifestMetadata(collectionPath);
      finalNamespace = metadata.namespace;
      finalCollectionName = metadata.collectionName;
    } catch (metadataError: any) {
      console.warn(`Failed to read metadata from ${collectionPath}, trying fallback:`, metadataError);
      // If reading metadata fails, try to extract namespace/collection from path
      const pathMatch = collectionPath.match(/ansible_collections\/([^/]+)\/([^/]+)$/);
      if (pathMatch) {
        finalNamespace = pathMatch[1];
        finalCollectionName = pathMatch[2];
        console.log(`Extracted namespace/collection from path: ${finalNamespace}.${finalCollectionName}`);
      }
    }
  }

  // Only fall back to config values if we still don't have namespace/collection
  if (!finalNamespace || !finalCollectionName) {
    if (config.namespace && config.collectionName) {
      console.warn(`Using fallback config values: ${config.namespace}.${config.collectionName}`);
      finalNamespace = config.namespace;
      finalCollectionName = config.collectionName;
    }
  }

  return { namespace: finalNamespace, collectionName: finalCollectionName };
}

export async function syncCatalog(config: CatalogConfig): Promise<SyncCatalogResult> {
  if (config.useLocalCollection) {
    if (!config.namespace || !config.collectionName) {
      throw new Error('Namespace and collection name are required when using local collection. Please configure catalog first.');
    }
    const collectionPath = await findCollectionPath(config.namespace, config.collectionName);
    if (!collectionPath) {
      throw new Error(`Collection ${config.namespace}.${config.collectionName} not found in local Ansible collection paths`);
    }
    await ensureAnsibleCfg();

    const metadata = await readManifestMetadata(collectionPath);
    return {
      success: true,
      output: `Collection found at: ${collectionPath} (namespace: ${metadata.namespace}, collection: ${metadata.collectionName})`,
      warnings: [],
      namespace: metadata.namespace,
      collectionName: metadata.collectionName
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

  let collectionSpec: string;
  let expectedNamespace: string | undefined;
  let expectedCollectionName: string | undefined;

  if (config.collectionSource.startsWith('git+')) {
    collectionSpec = config.collectionSource;
  } else {
    const parts = config.collectionSource.split('.');
    if (parts.length === 2) {
      expectedNamespace = parts[0];
      expectedCollectionName = parts[1];
      collectionSpec = config.collectionSource;
    } else {
      if (!config.namespace || !config.collectionName) {
        throw new Error('Invalid collection source format. Expected "namespace.collection" or Git URL.');
      }
      collectionSpec = `${config.namespace}.${config.collectionName}`;
      expectedNamespace = config.namespace;
      expectedCollectionName = config.collectionName;
    }
  }

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

            if (hasSuccess || exitCode === 0) {
              // Installation succeeded - now read MANIFEST.json to get namespace and collection name
              (async () => {
                try {
                  const metadata = await extractCollectionMetadata(output, expectedNamespace, expectedCollectionName, collectionsDir, config);
                  resolve({
                    success: true,
                    output: output + (metadata.namespace && metadata.collectionName ? `\n\nDetected namespace: ${metadata.namespace}, collection: ${metadata.collectionName}` : ''),
                    warnings: warnings,
                    namespace: metadata.namespace,
                    collectionName: metadata.collectionName
                  });
                } catch (metadataError: any) {
                  // If we can't read metadata, still resolve as success since installation worked
                  console.warn('Failed to read MANIFEST.json metadata:', metadataError);
                  const fallbackMetadata = await extractCollectionMetadata(output, expectedNamespace, expectedCollectionName, collectionsDir, config).catch(() => ({
                    namespace: expectedNamespace || config.namespace,
                    collectionName: expectedCollectionName || config.collectionName
                  }));
                  resolve({
                    success: true,
                    output: output,
                    warnings: warnings,
                    namespace: fallbackMetadata.namespace,
                    collectionName: fallbackMetadata.collectionName
                  });
                }
              })();
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

            if (hasSuccess) {
              // Try to read MANIFEST.json metadata
              (async () => {
                try {
                  const metadata = await extractCollectionMetadata(output, expectedNamespace, expectedCollectionName, collectionsDir, config);
                  resolve({
                    success: true,
                    output: output + (metadata.namespace && metadata.collectionName ? `\n\nDetected namespace: ${metadata.namespace}, collection: ${metadata.collectionName}` : ''),
                    warnings: warnings,
                    namespace: metadata.namespace,
                    collectionName: metadata.collectionName
                  });
                } catch (metadataError: any) {
                  console.warn('Failed to read MANIFEST.json metadata:', metadataError);
                  const fallbackMetadata = await extractCollectionMetadata(output, expectedNamespace, expectedCollectionName, collectionsDir, config).catch(() => ({
                    namespace: expectedNamespace || config.namespace,
                    collectionName: expectedCollectionName || config.collectionName
                  }));
                  resolve({
                    success: true,
                    output: output,
                    warnings: warnings,
                    namespace: fallbackMetadata.namespace,
                    collectionName: fallbackMetadata.collectionName
                  });
                }
              })();
            } else {
              resolve({
                success: false,
                output: output,
                warnings: warnings,
                namespace: expectedNamespace || config.namespace,
                collectionName: expectedCollectionName || config.collectionName
              });
            }
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

            // Try to read MANIFEST.json metadata
            (async () => {
              try {
                const metadata = await extractCollectionMetadata(output, expectedNamespace, expectedCollectionName, collectionsDir, config);
                resolve({
                  success: true,
                  output: output + (metadata.namespace && metadata.collectionName ? `\n\nDetected namespace: ${metadata.namespace}, collection: ${metadata.collectionName}` : ''),
                  warnings: warnings,
                  namespace: metadata.namespace,
                  collectionName: metadata.collectionName
                });
              } catch (metadataError: any) {
                console.warn('Failed to read MANIFEST.json metadata:', metadataError);
                const fallbackMetadata = await extractCollectionMetadata(output, expectedNamespace, expectedCollectionName, collectionsDir, config).catch(() => ({
                  namespace: expectedNamespace || config.namespace,
                  collectionName: expectedCollectionName || config.collectionName
                }));
                resolve({
                  success: true,
                  output: output,
                  warnings: warnings,
                  namespace: fallbackMetadata.namespace,
                  collectionName: fallbackMetadata.collectionName
                });
              }
            })();
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
  if (!config.namespace || !config.collectionName) {
    throw new Error('Namespace and collection name are required. Please sync the catalog first to derive them from MANIFEST.json.');
  }

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
        const typeValue = typeMatch[1].trim().replace(/['"]/g, '');
        currentDemo.type = (typeValue === 'role' ? 'role' : 'playbook') as 'playbook' | 'role';
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
  if (!config.namespace || !config.collectionName) {
    throw new Error('Namespace and collection name are required. Please sync the catalog first to derive them from MANIFEST.json.');
  }

  const path = await findCollectionPath(config.namespace, config.collectionName);
  if (!path) {
    throw new Error(`Collection ${config.namespace}.${config.collectionName} not found`);
  }
  return path;
}

export async function getPlaybookPath(config: CatalogConfig, demoType: 'playbook' | 'role', path: string): Promise<string> {
  if (!config.namespace || !config.collectionName) {
    throw new Error('Namespace and collection name are required. Please sync the catalog first.');
  }

  if (demoType === 'role') {
    return `${config.namespace}.${config.collectionName}.${path}`;
  } else {
    // Strip .yml or .yaml extension from playbook name
    const playbookName = path.replace(/\.(yml|yaml)$/, '');
    return `${config.namespace}.${config.collectionName}.${playbookName}`;
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

