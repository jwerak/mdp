import {
  Alert,
  Button,
  Checkbox,
  ExpandableSection,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalVariant,
  TextInput
} from '@patternfly/react-core';
import React, { useEffect, useState } from 'react';
import { syncCatalog, SyncCatalogResult } from '../lib/catalog';
import { loadConfig, saveConfig } from '../lib/config';
import { CatalogConfig } from '../lib/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<CatalogConfig>({
    collectionSource: '',
    executionEnvironment: '',
    useLocalCollection: false
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [syncResult, setSyncResult] = useState<SyncCatalogResult | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig().then(setConfig);
      setMessage(null);
      setSyncResult(null);
      setShowLogs(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setSyncResult(null);
    setShowLogs(false);

    try {
      await saveConfig(config);
      const result = await syncCatalog(config);
      setSyncResult(result);

      if (result.success) {
        // Update config with derived namespace and collectionName
        if (result.namespace && result.collectionName) {
          const updatedConfig = { ...config, namespace: result.namespace, collectionName: result.collectionName };
          await saveConfig(updatedConfig);
          setConfig(updatedConfig);
        }
        setMessage({
          type: 'success',
          text: result.warnings.length > 0
            ? 'Catalog synchronized successfully (with warnings)'
            : 'Catalog synchronized successfully'
        });
        if (result.warnings.length > 0 || result.output) {
          setShowLogs(true);
        }
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 2000);
      } else {
        setMessage({ type: 'danger', text: 'Collection installation completed but may have issues' });
        setShowLogs(true);
      }
    } catch (error: any) {
      setMessage({ type: 'danger', text: error.message || 'Failed to save configuration' });
      if (error.message && error.message.includes('Failed to install collection:')) {
        setSyncResult({
          success: false,
          output: error.message,
          warnings: []
        });
        setShowLogs(true);
      }
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
          {syncResult && (
            <ExpandableSection
              toggleText={showLogs ? 'Hide installation logs' : 'Show installation logs'}
              onToggle={(_, isExpanded) => setShowLogs(isExpanded)}
              isExpanded={showLogs}
              style={{ marginBottom: '1rem' }}
            >
              <div style={{
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                padding: '1rem',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                maxHeight: '400px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {syncResult.warnings.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ color: '#ffa500' }}>Warnings:</strong>
                    {syncResult.warnings.map((warning, idx) => (
                      <div key={idx} style={{ color: '#ffa500', marginTop: '0.5rem' }}>
                        {warning}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: syncResult.warnings.length > 0 ? '1rem' : '0' }}>
                  <strong>Output:</strong>
                  <div style={{ marginTop: '0.5rem' }}>
                    {syncResult.output || 'No output available'}
                  </div>
                </div>
              </div>
            </ExpandableSection>
          )}
          <Form onSubmit={handleSubmit}>
          <FormGroup label="Use Local Collection" fieldId="useLocalCollection">
            <Checkbox
              id="useLocalCollection"
              isChecked={config.useLocalCollection || false}
              onChange={(_, checked) => setConfig({ ...config, useLocalCollection: checked })}
              label="Load collection from locally installed Ansible collections"
            />
          </FormGroup>
          {!config.useLocalCollection && (
            <FormGroup label="Collection Source" isRequired fieldId="collectionSource">
              <TextInput
                id="collectionSource"
                value={config.collectionSource || ''}
                onChange={(_, value) => setConfig({ ...config, collectionSource: value })}
                placeholder="git+https://... or namespace.collection"
                isRequired
              />
              <div style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)', marginTop: '0.25rem' }}>
                Git repository URL (git+https://...) or Ansible Galaxy format (namespace.collection). Namespace and collection name will be automatically derived from MANIFEST.json.
              </div>
            </FormGroup>
          )}
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

