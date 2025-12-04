import {
  ActionGroup,
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Form,
  FormGroup,
  TextInput
} from '@patternfly/react-core';
import React, { useEffect, useState } from 'react';
import { syncCatalog } from '../lib/catalog';
import { loadConfig, saveConfig } from '../lib/config';
import { CatalogConfig } from '../lib/types';

export const Settings: React.FC = () => {
  const [config, setConfig] = useState<CatalogConfig>({
    collectionSource: '',
    namespace: 'local',
    collectionName: '',
    useLocalCollection: false
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    loadConfig().then(setConfig);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await saveConfig(config);
      const result = await syncCatalog(config);
      if (result.success) {
        setMessage({
          type: 'success',
          text: result.warnings.length > 0
            ? 'Catalog synchronized successfully (with warnings)'
            : 'Catalog synchronized successfully'
        });
      } else {
        setMessage({ type: 'danger', text: 'Collection installation completed but may have issues' });
      }
    } catch (error: any) {
      setMessage({ type: 'danger', text: error.message || 'Failed to save configuration' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardTitle>Catalog Settings</CardTitle>
      <CardBody>
        {message && (
          <Alert
            variant={message.type === 'success' ? 'success' : 'danger'}
            title={message.text}
            isInline
            style={{ marginBottom: '1rem' }}
          />
        )}
        <Form onSubmit={handleSubmit}>
          <FormGroup label="Collection Source" isRequired fieldId="collectionSource">
            <TextInput
              id="collectionSource"
              value={config.collectionSource || ''}
              onChange={(_, value) => setConfig({ ...config, collectionSource: value })}
              placeholder="git+https://... or namespace.collection"
              isRequired={!config.useLocalCollection}
              isDisabled={config.useLocalCollection}
            />
            <div style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)', marginTop: '0.25rem' }}>
              Git repository URL (git+https://...) or Ansible Galaxy format (namespace.collection)
            </div>
          </FormGroup>
          <FormGroup label="Namespace" isRequired fieldId="namespace">
            <TextInput
              id="namespace"
              value={config.namespace}
              onChange={(_, value) => setConfig({ ...config, namespace: value })}
              isRequired
            />
          </FormGroup>
          <FormGroup label="Collection Name" isRequired fieldId="collectionName">
            <TextInput
              id="collectionName"
              value={config.collectionName}
              onChange={(_, value) => setConfig({ ...config, collectionName: value })}
              isRequired
            />
          </FormGroup>
          <ActionGroup>
            <Button type="submit" variant="primary" isDisabled={loading}>
              {loading ? 'Saving...' : 'Save & Sync Catalog'}
            </Button>
          </ActionGroup>
        </Form>
      </CardBody>
    </Card>
  );
};

