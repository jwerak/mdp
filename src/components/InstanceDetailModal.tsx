import React from 'react';
import {
  Modal,
  ModalVariant,
  ModalBody,
  ModalFooter,
  Button,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Badge
} from '@patternfly/react-core';
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
  if (!instance) return null;

  return (
    <Modal
      variant={ModalVariant.medium}
      title={`Instance Details: ${instance.id}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalBody>
        <DescriptionList columnModifier={{ default: '2Col' }}>
          <DescriptionListGroup>
            <DescriptionListTerm>ID</DescriptionListTerm>
            <DescriptionListDescription>{instance.id}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Demo Name</DescriptionListTerm>
            <DescriptionListDescription>{instance.spec.demoName}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Status</DescriptionListTerm>
            <DescriptionListDescription>
              <Badge isRead={false} color={stateColors[instance.status.state] || 'default'}>
                {instance.status.state}
              </Badge>
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Created</DescriptionListTerm>
            <DescriptionListDescription>
              {new Date(instance.spec.createdAt).toLocaleString()}
            </DescriptionListDescription>
          </DescriptionListGroup>
          {instance.status.startedAt && (
            <DescriptionListGroup>
              <DescriptionListTerm>Started</DescriptionListTerm>
              <DescriptionListDescription>
                {new Date(instance.status.startedAt).toLocaleString()}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
          {instance.status.completedAt && (
            <DescriptionListGroup>
              <DescriptionListTerm>Completed</DescriptionListTerm>
              <DescriptionListDescription>
                {new Date(instance.status.completedAt).toLocaleString()}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
          <DescriptionListGroup>
            <DescriptionListTerm>Playbook</DescriptionListTerm>
            <DescriptionListDescription>{instance.spec.playbook_path}</DescriptionListDescription>
          </DescriptionListGroup>
          {instance.status.message && (
            <DescriptionListGroup>
              <DescriptionListTerm>Message</DescriptionListTerm>
              <DescriptionListDescription>{instance.status.message}</DescriptionListDescription>
            </DescriptionListGroup>
          )}
          {instance.status.error && (
            <DescriptionListGroup>
              <DescriptionListTerm>Error</DescriptionListTerm>
              <DescriptionListDescription>
                <span style={{ color: 'var(--pf-v6-global--danger-color--100)' }}>
                  {instance.status.error}
                </span>
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
          <DescriptionListGroup>
            <DescriptionListTerm>Parameters</DescriptionListTerm>
            <DescriptionListDescription>
              <pre style={{ fontSize: '0.875rem', maxHeight: '200px', overflow: 'auto' }}>
                {JSON.stringify(instance.spec.parameters, null, 2)}
              </pre>
            </DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

