import {
  Badge,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  Modal,
  ModalBody,
  ModalFooter,
  ModalVariant,
  Title
} from '@patternfly/react-core';
import React, { useEffect, useState } from 'react';
import { getInstance } from '../lib/instances';
import { Instance } from '../lib/types';

interface InstanceDetailModalProps {
  instance: Instance | null;
  isOpen: boolean;
  onClose: () => void;
}

const stateColors: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  running: 'default',
  completed: 'success',
  failed: 'danger'
};

export const InstanceDetailModal: React.FC<InstanceDetailModalProps> = ({ instance, isOpen, onClose }) => {
  const [currentInstance, setCurrentInstance] = useState<Instance | null>(instance);

  useEffect(() => {
    setCurrentInstance(instance);
  }, [instance]);

  useEffect(() => {
    if (!isOpen || !instance) return;

    const interval = setInterval(async () => {
      try {
        const updated = await getInstance(instance.id);
        setCurrentInstance(updated);
      } catch (err) {
        console.error('Failed to refresh instance:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, instance]);

  if (!currentInstance) return null;

  return (
    <Modal
      variant={ModalVariant.large}
      title={`Instance Details: ${currentInstance.id}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalBody>
        <DescriptionList columnModifier={{ default: '2Col' }}>
                  <DescriptionListGroup>
                    <DescriptionListTerm>ID</DescriptionListTerm>
                    <DescriptionListDescription>{currentInstance.id}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Demo Name</DescriptionListTerm>
                    <DescriptionListDescription>{currentInstance.spec.demoName}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Status</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Badge isRead={false} color={stateColors[currentInstance.status.state] || 'default'}>
                        {currentInstance.status.state}
                      </Badge>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Created</DescriptionListTerm>
                    <DescriptionListDescription>
                      {new Date(currentInstance.spec.createdAt).toLocaleString()}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  {currentInstance.status.startedAt && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>Started</DescriptionListTerm>
                      <DescriptionListDescription>
                        {new Date(currentInstance.status.startedAt).toLocaleString()}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  {currentInstance.status.completedAt && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>Completed</DescriptionListTerm>
                      <DescriptionListDescription>
                        {new Date(currentInstance.status.completedAt).toLocaleString()}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  <DescriptionListGroup>
                    <DescriptionListTerm>Playbook</DescriptionListTerm>
                    <DescriptionListDescription>{currentInstance.spec.playbook_path}</DescriptionListDescription>
                  </DescriptionListGroup>
                  {currentInstance.status.message && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>Message</DescriptionListTerm>
                      <DescriptionListDescription>{currentInstance.status.message}</DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  {currentInstance.status.error && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>Error</DescriptionListTerm>
                      <DescriptionListDescription>
                        <span style={{ color: 'var(--pf-v6-global--danger-color--100)' }}>
                          {currentInstance.status.error}
                        </span>
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  <DescriptionListGroup>
                    <DescriptionListTerm>Parameters</DescriptionListTerm>
                    <DescriptionListDescription>
                      <pre style={{ fontSize: '0.875rem', maxHeight: '200px', overflow: 'auto' }}>
                        {JSON.stringify(currentInstance.spec.parameters, null, 2)}
                      </pre>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
        <Divider style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }} />
        <Title headingLevel="h3" size="md" style={{ marginBottom: '1rem' }}>
          Execution Output
        </Title>
        {currentInstance.status.output ? (
          <pre style={{
            fontSize: '0.875rem',
            padding: '1rem',
            backgroundColor: 'var(--pf-v6-global--BackgroundColor--200)',
            borderRadius: '4px',
            maxHeight: '500px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {currentInstance.status.output}
          </pre>
        ) : (
          <div style={{ padding: '1rem', color: 'var(--pf-v6-global--Color--200)' }}>
            No execution output available yet. Execute the instance to see output.
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

