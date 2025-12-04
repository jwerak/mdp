import {
  Alert,
  Badge,
  Bullseye,
  Button,
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  Icon,
  List,
  ListItem,
  Spinner,
  Title
} from '@patternfly/react-core';
import { CogIcon, PlusCircleIcon } from '@patternfly/react-icons';
import React, { useEffect, useState } from 'react';
import { getDemos } from '../lib/catalog';
import { loadConfig } from '../lib/config';
import { DemoDefinition } from '../lib/types';
import { LaunchModal } from './LaunchModal';

interface DemoListProps {
  onConfigureCatalog?: () => void;
}

export const DemoList: React.FC<DemoListProps> = ({ onConfigureCatalog }) => {
  const [demos, setDemos] = useState<DemoDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDemo, setSelectedDemo] = useState<DemoDefinition | null>(null);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await loadConfig();
      if ((!config.useLocalCollection && !config.collectionSource) || !config.collectionName) {
        setError('not_configured');
        setLoading(false);
        return;
      }
      const demosList = await getDemos(config);
      setDemos(demosList);
    } catch (err: any) {
      setError(err.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
            Available Demos
          </Title>
          {error === 'not_configured' ? (
            <EmptyState>
              <Icon size="lg">
                <CogIcon />
              </Icon>
              <Title headingLevel="h3" size="md">
                Catalog not configured
              </Title>
              <EmptyStateBody>
                Configure the catalog settings to load available demos.
              </EmptyStateBody>
              {onConfigureCatalog && (
                <Button
                  variant="primary"
                  icon={<CogIcon />}
                  onClick={onConfigureCatalog}
                  style={{ marginTop: '1rem' }}
                >
                  Configure Catalog
                </Button>
              )}
            </EmptyState>
          ) : error ? (
            <Alert variant="warning" title={error} isInline />
          ) : demos.length === 0 ? (
            <EmptyState>
              <Icon size="lg">
                <PlusCircleIcon />
              </Icon>
              <Title headingLevel="h3" size="md">
                No demos yet
              </Title>
              <EmptyStateBody>
                Configure the catalog to load available demos.
              </EmptyStateBody>
            </EmptyState>
          ) : (
            <List isPlain>
              {demos.map((demo) => (
                <ListItem
                  key={demo.id}
                  onClick={() => setSelectedDemo(demo)}
                  style={{
                    padding: '0.75rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--pf-v6-global--BorderColor--100)'
                  }}
                >
                  <div>
                    <strong>{demo.name}</strong>
                    <Badge style={{ marginLeft: '0.5rem' }}>{demo.type}</Badge>
                    {demo.description && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)', marginTop: '0.25rem' }}>
                        {demo.description}
                      </div>
                    )}
                    <div style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)', marginTop: '0.25rem' }}>
                      Path: {demo.path}
                    </div>
                  </div>
                </ListItem>
              ))}
            </List>
          )}
        </CardBody>
      </Card>
      {selectedDemo && (
        <LaunchModal
          demo={selectedDemo}
          isOpen={true}
          onClose={() => setSelectedDemo(null)}
        />
      )}
    </>
  );
};

