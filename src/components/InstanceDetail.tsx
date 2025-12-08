import {
    Badge,
    Breadcrumb,
    BreadcrumbItem,
    Button,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    Divider,
    ExpandableSection,
    PageSection,
    Title
} from '@patternfly/react-core';
import React, { useEffect, useState } from 'react';
import { getInstance } from '../lib/instances';
import { Instance } from '../lib/types';

interface InstanceDetailProps {
  instanceId: string;
  onBack: () => void;
}

const stateColors: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  running: 'default',
  completed: 'success',
  failed: 'danger'
};

export const InstanceDetail: React.FC<InstanceDetailProps> = ({ instanceId, onBack }) => {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [logsExpanded, setLogsExpanded] = useState(true);

  useEffect(() => {
    const loadInstance = async () => {
      try {
        const inst = await getInstance(instanceId);
        setInstance(inst);
      } catch (err) {
        console.error('Failed to load instance:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInstance();

    // Poll for updates
    const interval = setInterval(async () => {
      try {
        const updated = await getInstance(instanceId);
        setInstance(updated);
      } catch (err) {
        console.error('Failed to refresh instance:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [instanceId]);

  if (loading) {
    return (
      <PageSection>
        <div>Loading...</div>
      </PageSection>
    );
  }

  if (!instance) {
    return (
      <PageSection>
        <div>Instance not found</div>
        <Button variant="link" onClick={onBack} style={{ marginTop: '1rem' }}>
          Back to Instances
        </Button>
      </PageSection>
    );
  }

  return (
    <>
      <PageSection variant="secondary">
        <Breadcrumb>
          <BreadcrumbItem to="#" onClick={(e) => { e.preventDefault(); onBack(); }}>
            Instances
          </BreadcrumbItem>
          <BreadcrumbItem isActive>
            {instance.spec?.demoName || instance.spec?.demoId || instance.id}
          </BreadcrumbItem>
        </Breadcrumb>
      </PageSection>

      <PageSection>
        <Title headingLevel="h1" size="2xl" style={{ marginBottom: '1.5rem' }}>
          {instance.spec?.demoName || instance.spec?.demoId || instance.id}
        </Title>

        <DescriptionList columnModifier={{ default: '2Col' }}>
          <DescriptionListGroup>
            <DescriptionListTerm>ID</DescriptionListTerm>
            <DescriptionListDescription>{instance.id}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Status</DescriptionListTerm>
            <DescriptionListDescription>
              <Badge isRead={false} color={stateColors[instance.status?.state || 'pending'] || 'default'}>
                {instance.status?.state || 'pending'}
              </Badge>
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Created</DescriptionListTerm>
            <DescriptionListDescription>
              {new Date(instance.spec.createdAt).toLocaleString()}
            </DescriptionListDescription>
          </DescriptionListGroup>
          {instance.status?.startedAt && (
            <DescriptionListGroup>
              <DescriptionListTerm>Started</DescriptionListTerm>
              <DescriptionListDescription>
                {new Date(instance.status.startedAt).toLocaleString()}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
          {instance.status?.completedAt && (
            <DescriptionListGroup>
              <DescriptionListTerm>Completed</DescriptionListTerm>
              <DescriptionListDescription>
                {new Date(instance.status.completedAt).toLocaleString()}
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
          <DescriptionListGroup>
            <DescriptionListTerm>Type</DescriptionListTerm>
            <DescriptionListDescription>
              <Badge>{instance.spec.demoType}</Badge>
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Path</DescriptionListTerm>
            <DescriptionListDescription>{instance.spec.playbook_path}</DescriptionListDescription>
          </DescriptionListGroup>
          {instance.status?.message && (
            <DescriptionListGroup>
              <DescriptionListTerm>Message</DescriptionListTerm>
              <DescriptionListDescription>{instance.status.message}</DescriptionListDescription>
            </DescriptionListGroup>
          )}
          {instance.status?.error && (
            <DescriptionListGroup>
              <DescriptionListTerm>Error</DescriptionListTerm>
              <DescriptionListDescription>
                <span style={{ color: 'var(--pf-v6-global--danger-color--100)' }}>
                  {instance.status.error}
                </span>
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
        </DescriptionList>

        {instance.status?.summary && instance.status.summary.collected_info && instance.status.summary.collected_info.length > 0 && (
          <>
            <Divider style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }} />
            <Title headingLevel="h3" size="md" style={{ marginBottom: '1rem' }}>
              Execution Summary
            </Title>
            <DescriptionList>
              {instance.status.summary.collected_info.map((item, index) => (
                <DescriptionListGroup key={index}>
                  <DescriptionListTerm>{item.name}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {item.description && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)', marginBottom: '0.25rem' }}>
                        {item.description}
                      </div>
                    )}
                    <div>{item.value}</div>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              ))}
            </DescriptionList>
          </>
        )}

        <Divider style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }} />

        <ExpandableSection
          toggleText="Execution Logs"
          isExpanded={logsExpanded}
          onToggle={() => setLogsExpanded(!logsExpanded)}
          displaySize="lg"
        >
          {instance.status?.output ? (
            <pre style={{
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              padding: '1rem',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              borderRadius: '4px',
              maxHeight: '500px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {instance.status.output}
            </pre>
          ) : (
            <div style={{ padding: '1rem', color: 'var(--pf-v6-global--Color--200)' }}>
              No execution output available yet. Execute the instance to see output.
            </div>
          )}
        </ExpandableSection>

        <div style={{ marginTop: '2rem' }}>
          <Button variant="secondary" onClick={onBack}>
            Back to Instances
          </Button>
        </div>
      </PageSection>
    </>
  );
};

