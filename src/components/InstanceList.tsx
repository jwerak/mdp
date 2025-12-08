import {
  Alert,
  Badge,
  Bullseye,
  Button,
  Checkbox,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerPanelContent,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  ExpandableSection,
  Icon,
  MenuToggle,
  MenuToggleElement,
  Spinner,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem
} from '@patternfly/react-core';
import { EllipsisVIcon, SearchIcon } from '@patternfly/react-icons';
import {
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr
} from '@patternfly/react-table';
import React, { useEffect, useState } from 'react';
import { deleteInstance, executeInstance, getAllInstances, reapplyInstance } from '../lib/instances';
import { Instance } from '../lib/types';

const POLL_INTERVAL = 5000;

const stateColors: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  running: 'default',
  completed: 'success',
  failed: 'danger'
};

interface InstanceListProps {
  onViewInstance?: (instanceId: string) => void;
}

export const InstanceList: React.FC<InstanceListProps> = ({ onViewInstance }) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState<Record<string, boolean>>({});
  const [bulkActionDropdownOpen, setBulkActionDropdownOpen] = useState(false);

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

  const handleExecute = async (instanceId: string) => {
    try {
      await executeInstance(instanceId, (output) => {
        console.log('Execution output:', output);
      });
      await loadInstances();
    } catch (err: any) {
      alert(`Failed to execute instance: ${err.message}`);
    }
    setActionDropdownOpen({ ...actionDropdownOpen, [instanceId]: false });
  };

  const handleShowDetails = (instance: Instance) => {
    setSelectedInstance(instance);
    setIsDrawerExpanded(true);
    setActionDropdownOpen({ ...actionDropdownOpen, [instance.id]: false });
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedInstances(new Set(instances.map(i => i.id)));
    } else {
      setSelectedInstances(new Set());
    }
  };

  const handleSelectInstance = (instanceId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedInstances);
    if (isSelected) {
      newSelected.add(instanceId);
    } else {
      newSelected.delete(instanceId);
    }
    setSelectedInstances(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedInstances.size} instance(s)?`)) {
      return;
    }
    try {
      for (const instanceId of selectedInstances) {
        await deleteInstance(instanceId);
      }
      setSelectedInstances(new Set());
      await loadInstances();
    } catch (err: any) {
      alert(`Failed to delete instances: ${err.message}`);
    }
    setBulkActionDropdownOpen(false);
  };

  const handleBulkExecute = async () => {
    try {
      for (const instanceId of selectedInstances) {
        await executeInstance(instanceId, (output) => {
          console.log('Execution output:', output);
        });
      }
      setSelectedInstances(new Set());
      await loadInstances();
    } catch (err: any) {
      alert(`Failed to execute instances: ${err.message}`);
    }
    setBulkActionDropdownOpen(false);
  };

  const handleBulkReapply = async () => {
    try {
      for (const instanceId of selectedInstances) {
        await reapplyInstance(instanceId);
      }
      setSelectedInstances(new Set());
      await loadInstances();
    } catch (err: any) {
      alert(`Failed to reapply instances: ${err.message}`);
    }
    setBulkActionDropdownOpen(false);
  };

  const getDescription = (instance: Instance): string => {
    if (instance.status?.error) {
      return instance.status.error;
    }
    if (instance.status?.message) {
      return instance.status.message;
    }
    const demoName = instance.spec?.demoName || instance.spec?.demoId || 'Unknown';
    return `Demo: ${demoName}`;
  };

  const renderContent = () => {
    if (loading && instances.length === 0) {
      return (
        <Bullseye style={{ padding: '2rem' }}>
          <Spinner />
        </Bullseye>
      );
    }

    if (instances.length === 0) {
      return (
        <EmptyState>
          <Icon size="lg">
            <SearchIcon />
          </Icon>
          <Title headingLevel="h3" size="md">
            No services
          </Title>
          <EmptyStateBody>
            There are no running services yet. Select a demo from the available demos section to deploy a new service.
          </EmptyStateBody>
        </EmptyState>
      );
    }

    const allSelected = instances.length > 0 && selectedInstances.size === instances.length;
    const someSelected = selectedInstances.size > 0 && selectedInstances.size < instances.length;

    return (
      <div style={{ marginTop: '1rem' }}>
        {selectedInstances.size > 0 && (
          <Toolbar>
            <ToolbarContent>
              <ToolbarGroup>
                <ToolbarItem>
                  <strong>{selectedInstances.size}</strong> selected
                </ToolbarItem>
                <ToolbarItem>
                  <Dropdown
                    isOpen={bulkActionDropdownOpen}
                    onOpenChange={setBulkActionDropdownOpen}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setBulkActionDropdownOpen(!bulkActionDropdownOpen)}
                        aria-label="Bulk actions"
                      >
                        Bulk actions
                      </MenuToggle>
                    )}
                  >
                    <DropdownList>
                      <DropdownItem onClick={handleBulkExecute}>
                        Execute selected
                      </DropdownItem>
                      <DropdownItem onClick={handleBulkReapply}>
                        Re-apply selected
                      </DropdownItem>
                      <DropdownItem onClick={handleBulkDelete}>
                        Delete selected
                      </DropdownItem>
                    </DropdownList>
                  </Dropdown>
                </ToolbarItem>
                <ToolbarItem>
                  <Button variant="link" onClick={() => setSelectedInstances(new Set())}>
                    Clear selection
                  </Button>
                </ToolbarItem>
              </ToolbarGroup>
            </ToolbarContent>
          </Toolbar>
        )}
        <Table aria-label="Instances table">
          <Thead>
            <Tr>
              <Th>
                <Checkbox
                  id="select-all"
                  isChecked={allSelected}
                  onChange={(_, checked) => handleSelectAll(checked)}
                  aria-label="Select all instances"
                  {...(someSelected && { isIndeterminate: true })}
                />
              </Th>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Description</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {instances.map((instance) => (
              <Tr
                key={instance.id}
                isClickable
                onRowClick={() => onViewInstance ? onViewInstance(instance.id) : handleShowDetails(instance)}
              >
                <Td onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    id={`select-${instance.id}`}
                    isChecked={selectedInstances.has(instance.id)}
                    onChange={(_, checked) => handleSelectInstance(instance.id, checked)}
                    aria-label={`Select ${instance.id}`}
                  />
                </Td>
                <Td>
                  <div>
                    <strong>{instance.spec?.demoName || instance.spec?.demoId || instance.id}</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)' }}>
                      {instance.id}
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge isRead={false} color={stateColors[instance.status?.state || 'pending'] || 'default'}>
                    {instance.status?.state || 'pending'}
                  </Badge>
                </Td>
                <Td>
                  <div style={{ maxWidth: '400px' }}>
                    {getDescription(instance)}
                  </div>
                </Td>
                <Td onClick={(e) => e.stopPropagation()}>
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
                      <DropdownItem onClick={() => onViewInstance ? onViewInstance(instance.id) : handleShowDetails(instance)}>
                        Show details
                      </DropdownItem>
                      <DropdownItem onClick={() => handleExecute(instance.id)}>
                        Execute
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
      </div>
    );
  };

  const drawerContent = selectedInstance ? (
    <DrawerPanelContent widths={{ default: 'width_50' }}>
      <div style={{ padding: '1.5rem' }}>
        <Title headingLevel="h2" size="xl" style={{ marginBottom: '1rem' }}>
          Instance Details
        </Title>
        <div style={{ marginBottom: '1rem' }}>
          <strong>Instance ID:</strong> {selectedInstance.id}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <strong>Demo Name:</strong> {selectedInstance.spec?.demoName || selectedInstance.spec?.demoId || 'N/A'}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <strong>Demo Type:</strong> {selectedInstance.spec?.demoType}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <strong>Path:</strong> {selectedInstance.spec?.demoPath}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <strong>Status:</strong>{' '}
          <Badge isRead={false} color={stateColors[selectedInstance.status?.state || 'pending'] || 'default'}>
            {selectedInstance.status?.state || 'pending'}
          </Badge>
        </div>
        {selectedInstance.status?.message && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>Message:</strong>
            <div style={{ marginTop: '0.25rem' }}>{selectedInstance.status.message}</div>
          </div>
        )}
        {selectedInstance.status?.error && (
          <div style={{ marginBottom: '1rem' }}>
            <Alert variant="danger" title="Error" isInline>
              {selectedInstance.status.error}
            </Alert>
          </div>
        )}
        {selectedInstance.status?.summary?.collected_info && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>Collected Information:</strong>
            <div style={{ marginTop: '0.5rem' }}>
              {selectedInstance.status.summary.collected_info.map((info, idx) => (
                <div key={idx} style={{ marginBottom: '0.5rem' }}>
                  <strong>{info.name}:</strong> {info.value}
                  {info.description && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)' }}>
                      {info.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginTop: '2rem' }}>
          <Button variant="secondary" onClick={() => setIsDrawerExpanded(false)}>
            Close
          </Button>
        </div>
      </div>
    </DrawerPanelContent>
  ) : null;

  return (
    <ExpandableSection
      toggleText={`Running Services (${instances.length})`}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      displaySize="lg"
    >
      {error && (
        <Alert variant="danger" title={error} style={{ marginBottom: '1rem' }} isInline />
      )}
      <Drawer isExpanded={isDrawerExpanded} onExpand={() => setIsDrawerExpanded(true)}>
        <DrawerContent panelContent={drawerContent}>
          <DrawerContentBody>
            {renderContent()}
          </DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </ExpandableSection>
  );
};

