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
    Title,
    List,
    ListItem
} from '@patternfly/react-core';
import React, { useEffect, useState } from 'react';
import { getInstance, getInstanceArtifact, AnsibleArtifact, AnsibleTask } from '../lib/instances';
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

// Simple JSON syntax highlighter
const highlightJSON = (json: string): string => {
  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
};

export const InstanceDetail: React.FC<InstanceDetailProps> = ({ instanceId, onBack }) => {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [logsExpanded, setLogsExpanded] = useState(true);
  const [artifact, setArtifact] = useState<AnsibleArtifact | null>(null);
  const [artifactExpanded, setArtifactExpanded] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadInstance = async () => {
      try {
        const inst = await getInstance(instanceId);
        setInstance(inst);

        // Load artifact if instance has completed or failed
        if (inst.status?.state === 'completed' || inst.status?.state === 'failed') {
          const art = await getInstanceArtifact(instanceId);
          setArtifact(art);
        }
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

        // Load artifact if instance has completed or failed
        if (updated.status?.state === 'completed' || updated.status?.state === 'failed') {
          const art = await getInstanceArtifact(instanceId);
          setArtifact(art);
        }
      } catch (err) {
        console.error('Failed to refresh instance:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [instanceId]);

  const toggleTask = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

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
      <style>
        {`
          .json-key { color: #9cdcfe; }
          .json-string { color: #ce9178; }
          .json-number { color: #b5cea8; }
          .json-boolean { color: #569cd6; }
          .json-null { color: #569cd6; }
        `}
      </style>
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

        {artifact && artifact.plays && artifact.plays.length > 0 && (
          <>
            <Divider style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }} />

            <ExpandableSection
              toggleText="Playbook Tasks"
              isExpanded={artifactExpanded}
              onToggle={() => setArtifactExpanded(!artifactExpanded)}
              displaySize="lg"
            >
              <div style={{ padding: '1rem', backgroundColor: 'var(--pf-v6-global--BackgroundColor--200)' }}>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Status</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Badge color={artifact.status === 'successful' ? 'green' : 'red'}>
                        {artifact.status}
                      </Badge>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>

                {artifact.plays.map((play, playIndex) => (
                  <div key={playIndex} style={{ marginTop: '1.5rem' }}>
                    <Title headingLevel="h4" size="md" style={{ marginBottom: '1rem' }}>
                      {play.name}
                    </Title>

                    {play.tasks && play.tasks.map((task, taskIndex) => {
                      const taskId = `${playIndex}-${taskIndex}`;
                      const isExpanded = expandedTasks.has(taskId);

                      // Determine task status badge color
                      let statusColor: 'default' | 'green' | 'orange' | 'blue' | 'red' = 'default';
                      if (task.__result === 'Ok') statusColor = 'green';
                      else if (task.__result === 'Changed') statusColor = 'orange';
                      else if (task.__result === 'Skipped') statusColor = 'blue';
                      else if (task.__result === 'Failed') statusColor = 'red';

                      return (
                        <div
                          key={taskId}
                          style={{
                            marginBottom: '0.75rem',
                            border: '1px solid var(--pf-v6-global--BorderColor--100)',
                            borderRadius: '4px',
                            backgroundColor: isExpanded ? 'var(--pf-v6-global--BackgroundColor--200)' : 'var(--pf-v6-global--BackgroundColor--100)',
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                          <div
                            style={{
                              padding: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              backgroundColor: isExpanded ? 'rgba(0, 123, 186, 0.08)' : 'transparent',
                              borderRadius: '4px',
                              transition: 'background-color 0.2s ease'
                            }}
                            onClick={() => toggleTask(taskId)}
                          >
                            <Badge color={statusColor}>{task.__result}</Badge>
                            <span style={{ fontWeight: 500 }}>{task.__number}.</span>
                            <span style={{ flex: 1 }}>{task.task}</span>
                            <span style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)' }}>
                              {task.duration.toFixed(3)}s
                            </span>
                            <span style={{ fontSize: '0.875rem' }}>
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </div>

                          {isExpanded && (
                            <div style={{
                              padding: '0.75rem',
                              borderTop: '1px solid var(--pf-v6-global--BorderColor--100)'
                            }}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '0.5rem',
                                fontSize: '0.875rem',
                                marginBottom: task.res ? '1rem' : 0
                              }}>
                                <div>
                                  <strong>Host:</strong> {task.host}
                                </div>
                                <div>
                                  <strong>Action:</strong> <code style={{ fontSize: '0.8rem' }}>{task.task_action}</code>
                                </div>
                                <div>
                                  <strong>Duration:</strong> {task.duration.toFixed(3)}s
                                </div>
                                <div>
                                  <strong>Started:</strong> {new Date(task.start).toLocaleTimeString()}
                                </div>
                                <div>
                                  <strong>Ended:</strong> {new Date(task.end).toLocaleTimeString()}
                                </div>
                                {task.__changed && (
                                  <div>
                                    <strong>Changed:</strong> <Badge color="orange">Yes</Badge>
                                  </div>
                                )}
                              </div>

                              {task.res && (
                                <div>
                                  <strong style={{ fontSize: '0.875rem' }}>Result:</strong>
                                  <pre
                                    style={{
                                      fontSize: '0.75rem',
                                      fontFamily: 'monospace',
                                      padding: '0.75rem',
                                      backgroundColor: '#1e1e1e',
                                      color: '#d4d4d4',
                                      borderRadius: '4px',
                                      maxHeight: '400px',
                                      overflow: 'auto',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      margin: '0.5rem 0 0 0'
                                    }}
                                    dangerouslySetInnerHTML={{
                                      __html: highlightJSON(JSON.stringify(task.res, null, 2))
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ExpandableSection>
          </>
        )}

        <div style={{ marginTop: '2rem' }}>
          <Button variant="secondary" onClick={onBack}>
            Back to Instances
          </Button>
        </div>
      </PageSection>
    </>
  );
};

