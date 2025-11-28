import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Title,
  Spinner,
  Alert,
  EmptyState,
  EmptyStateBody,
  Bullseye,
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggle,
  MenuToggleElement,
  Badge,
  Icon
} from '@patternfly/react-core';
import {
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td
} from '@patternfly/react-table';
import { SearchIcon, EllipsisVIcon } from '@patternfly/react-icons';
import { getAllInstances, deleteInstance, reapplyInstance } from '../lib/instances';
import { Instance } from '../lib/types';
import { InstanceDetailModal } from './InstanceDetailModal';

const POLL_INTERVAL = 5000;

const stateColors: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  running: 'default',
  completed: 'success',
  failed: 'danger'
};

export const InstanceList: React.FC = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadInstances();
    const interval = setInterval(loadInstances, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const loadInstances = async () => {
    try {
      const insts = await getAllInstances();
      setInstances(insts);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load instances');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (instanceId: string) => {
    if (!confirm(`Are you sure you want to delete instance ${instanceId}?`)) {
      return;
    }
    try {
      await deleteInstance(instanceId);
      await loadInstances();
    } catch (err: any) {
      alert(`Failed to delete instance: ${err.message}`);
    }
    setActionDropdownOpen({ ...actionDropdownOpen, [instanceId]: false });
  };

  const handleReapply = async (instanceId: string) => {
    try {
      await reapplyInstance(instanceId);
      await loadInstances();
    } catch (err: any) {
      alert(`Failed to reapply instance: ${err.message}`);
    }
    setActionDropdownOpen({ ...actionDropdownOpen, [instanceId]: false });
  };

  const handleShowDetails = (instance: Instance) => {
    setSelectedInstance(instance);
    setDetailModalOpen(true);
    setActionDropdownOpen({ ...actionDropdownOpen, [instance.id]: false });
  };

  const getDescription = (instance: Instance): string => {
    if (instance.status.error) {
      return instance.status.error;
    }
    if (instance.status.message) {
      return instance.status.message;
    }
    return `Demo: ${instance.spec.demoName}`;
  };

  if (loading && instances.length === 0) {
    return (
      <Card>
        <CardBody>
          <Bullseye>
            <Spinner />
          </Bullseye>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardBody>
          <Title headingLevel="h2" size="lg" style={{ marginBottom: '1rem' }}>
            Running Services
          </Title>
          {error && (
            <Alert variant="danger" title={error} style={{ marginBottom: '1rem' }} />
          )}
          {instances.length === 0 ? (
            <EmptyState>
              <Icon size="lg">
                <SearchIcon />
              </Icon>
              <Title headingLevel="h3" size="md">
                No services
              </Title>
              <EmptyStateBody>
                There are no running services yet. Select a demo from the left panel to deploy a new service.
              </EmptyStateBody>
            </EmptyState>
          ) : (
            <Table aria-label="Instances table">
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th>Description</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {instances.map((instance) => (
                  <Tr key={instance.id}>
                    <Td>
                      <div>
                        <strong>{instance.spec.demoName}</strong>
                        <div style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)' }}>
                          {instance.id}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge isRead={false} color={stateColors[instance.status.state] || 'default'}>
                        {instance.status.state}
                      </Badge>
                    </Td>
                    <Td>
                      <div style={{ maxWidth: '400px' }}>
                        {getDescription(instance)}
                      </div>
                    </Td>
                    <Td>
                      <Dropdown
                        isOpen={actionDropdownOpen[instance.id] || false}
                        onOpenChange={(isOpen) => {
                          setActionDropdownOpen({ ...actionDropdownOpen, [instance.id]: isOpen });
                        }}
                        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                          <MenuToggle
                            ref={toggleRef}
                            variant="plain"
                            onClick={() => {
                              setActionDropdownOpen({
                                ...actionDropdownOpen,
                                [instance.id]: !actionDropdownOpen[instance.id]
                              });
                            }}
                            aria-label="Actions"
                          >
                            <EllipsisVIcon />
                          </MenuToggle>
                        )}
                      >
                        <DropdownList>
                          <DropdownItem onClick={() => handleShowDetails(instance)}>
                            Show details
                          </DropdownItem>
                          <DropdownItem onClick={() => handleReapply(instance.id)}>
                            Re-apply
                          </DropdownItem>
                          <DropdownItem onClick={() => handleDelete(instance.id)}>
                            Delete
                          </DropdownItem>
                        </DropdownList>
                      </Dropdown>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>
      {selectedInstance && (
        <InstanceDetailModal
          instance={selectedInstance}
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedInstance(null);
          }}
        />
      )}
    </>
  );
};

