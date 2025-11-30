import {
  Alert,
  Button,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalVariant,
  TextInput
} from '@patternfly/react-core';
import React, { useEffect, useState } from 'react';
import { syncCatalog } from '../lib/catalog';
import { loadConfig, saveConfig } from '../lib/config';
import { CatalogConfig } from '../lib/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<CatalogConfig>({
    repoUrl: '',
    namespace: 'local',
    collectionName: '',
    executionEnvironment: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig().then(setConfig);
      setMessage(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await saveConfig(config);
      await syncCatalog(config);
      setMessage({ type: 'success', text: 'Catalog synchronized successfully' });
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      setMessage({ type: 'danger', text: error.message || 'Failed to save configuration' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      variant={ModalVariant.medium}
      title="Configure Catalog"
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalBody>
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
          {message && (
            <Alert
              variant={message.type === 'success' ? 'success' : 'danger'}
              title={message.text}
              isInline
              style={{ marginBottom: '1rem' }}
            />
          )}
          <Form onSubmit={handleSubmit}>
          <FormGroup label="Git Repository URL" isRequired fieldId="repoUrl">
            <TextInput
              id="repoUrl"
              value={config.repoUrl}
              onChange={(_, value) => setConfig({ ...config, repoUrl: value })}
              isRequired
            />
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
          <FormGroup label="Execution Environment" fieldId="executionEnvironment">
            <TextInput
              id="executionEnvironment"
              value={config.executionEnvironment || ''}
              onChange={(_, value) => setConfig({ ...config, executionEnvironment: value })}
              placeholder="quay.io/ansible/ansible-navigator:latest"
            />
            <div style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)', marginTop: '0.25rem' }}>
              Container image name for ansible-navigator execution environment
            </div>
          </FormGroup>
        </Form>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isDisabled={loading}
        >
          {loading ? 'Saving...' : 'Save & Sync Catalog'}
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

