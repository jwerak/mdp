export interface DemoParameter {
  name: string;
  label?: string;
  description?: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  required: boolean;
  options?: string[];
  default?: any;
}

export interface DemoDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'playbook' | 'role';
  path: string;
  parameters: DemoParameter[];
}

export interface CatalogConfig {
  repoUrl: string;
  namespace: string;
  collectionName: string;
  executionEnvironment?: string;
}

export interface InstanceSpec {
  demoId: string;
  demoName: string;
  demoType: 'playbook' | 'role';
  demoPath: string;
  playbook_path: string;
  parameters: Record<string, any>;
  variable_definitions: DemoParameter[];
  createdAt: string;
}

export interface InstanceStatus {
  state: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: string;
  summary?: {
    collected_info: Array<{
      description: string;
      name: string;
      value: string;
    }>;
  };
}

export interface Instance {
  id: string;
  spec: InstanceSpec;
  status: InstanceStatus;
}

