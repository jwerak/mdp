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
  const demosYamlPath = `${collectionPath}/demos.yaml`;

  return new Promise((resolve, reject) => {
    const cockpit = getCockpit();
    cockpit.file(collectionPath).access()
      .then(() => {
        cockpit.spawn(['git', '-C', collectionPath, 'pull'], { err: 'out' })
          .then(() => resolve())
          .catch((error: any) => {
            console.error('Git pull failed:', error);
            reject(new Error(`Failed to pull catalog: ${error.message}`));
          });
      })
      .catch(() => {
        const cockpit = getCockpit();
        cockpit.spawn(['mkdir', '-p', collectionPath], { err: 'out' })
          .then(() => {
            return cockpit.spawn(['git', 'clone', config.repoUrl, collectionPath], { err: 'out' });
          })
          .then(() => resolve())
          .catch((error: any) => {
            console.error('Git clone failed:', error);
            reject(new Error(`Failed to clone catalog: ${error.message}`));
          });
      });
  });
}

export async function getDemos(config: CatalogConfig): Promise<DemoDefinition[]> {
  const collectionPath = `${COLLECTIONS_PATH}/${config.namespace}/${config.collectionName}`;
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
        if (currentParameter && Object.keys(currentParameter).length > 0) {
          currentDemo.parameters!.push(currentParameter as DemoParameter);
        }
        demos.push(currentDemo as DemoDefinition);
      }
      const idMatch = trimmed.match(/id:\s*(.+)/);
      currentDemo = {
        id: idMatch ? idMatch[1].trim().replace(/['"]/g, '') : '',
        parameters: []
      };
      inParameters = false;
      currentParameter = null;
      parameterIndent = 0;
    } else if (currentDemo && !inParameters && trimmed.startsWith('name:')) {
      const nameMatch = trimmed.match(/name:\s*(.+)/);
      if (nameMatch) {
        currentDemo.name = nameMatch[1].trim().replace(/['"]/g, '');
      }
    } else if (currentDemo && !inParameters && trimmed.startsWith('playbook:')) {
      const playbookMatch = trimmed.match(/playbook:\s*(.+)/);
      if (playbookMatch) {
        currentDemo.playbook = playbookMatch[1].trim().replace(/['"]/g, '');
      }
    } else if (currentDemo && trimmed === 'parameters:' || trimmed.startsWith('parameters:')) {
      inParameters = true;
      parameterIndent = indent + 2;
    } else if (inParameters && (trimmed.startsWith('- name:') || trimmed.match(/^-\s*name:/))) {
      if (currentParameter && Object.keys(currentParameter).length > 0) {
        currentDemo?.parameters!.push(currentParameter as DemoParameter);
      }
      const nameMatch = trimmed.match(/name:\s*(.+)/);
      currentParameter = {
        name: nameMatch ? nameMatch[1].trim().replace(/['"]/g, '') : '',
        type: 'text',
        label: ''
      };
    } else if (currentParameter && inParameters && indent >= parameterIndent) {
      if (trimmed.startsWith('label:')) {
        const labelMatch = trimmed.match(/label:\s*(.+)/);
        if (labelMatch) {
          currentParameter.label = labelMatch[1].trim().replace(/['"]/g, '');
        }
      } else if (trimmed.startsWith('type:')) {
        const typeMatch = trimmed.match(/type:\s*(.+)/);
        if (typeMatch) {
          const typeValue = typeMatch[1].trim().replace(/['"]/g, '');
          currentParameter.type = typeValue as 'text' | 'number' | 'boolean' | 'select';
        }
      } else if (trimmed.startsWith('options:')) {
        const optionsMatch = trimmed.match(/options:\s*(.+)/);
        if (optionsMatch) {
          const optionsLine = optionsMatch[1].trim();
          if (optionsLine.startsWith('[')) {
            const optionsStr = optionsLine.replace(/[\[\]]/g, '');
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
    if (currentParameter && Object.keys(currentParameter).length > 0) {
      currentDemo.parameters!.push(currentParameter as DemoParameter);
    }
    if (currentDemo.id && currentDemo.name && currentDemo.playbook) {
      demos.push(currentDemo as DemoDefinition);
    }
  }

  return demos;
}

export function getCatalogPath(config: CatalogConfig): string {
  return `${COLLECTIONS_PATH}/${config.namespace}/${config.collectionName}`;
}

export function getPlaybookPath(config: CatalogConfig, playbook: string): string {
  const collectionPath = getCatalogPath(config);
  return `${collectionPath}/playbooks/${playbook}`;
}

