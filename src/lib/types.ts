export interface DemoParameter {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  default?: any;
}

export interface DemoDefinition {
  id: string;
  name: string;
  playbook: string;
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
  playbook_path: string;
  parameters: Record<string, any>;
  createdAt: string;
}

export interface InstanceStatus {
  state: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: string;
}

export interface Instance {
  id: string;
  spec: InstanceSpec;
  status: InstanceStatus;
}

