import {
  Alert,
  Badge,
  Bullseye,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Content,
  EmptyState,
  EmptyStateBody,
  ExpandableSection,
  Flex,
  Gallery,
  HelperText,
  HelperTextItem,
  Icon,
  Spinner,
  Title
} from '@patternfly/react-core';
import { CogIcon, CubeIcon, PlayIcon, PlusCircleIcon } from '@patternfly/react-icons';
import React, { useEffect, useState } from 'react';
import { getDemos } from '../lib/catalog';
import { loadConfig } from '../lib/config';
import { DemoDefinition } from '../lib/types';
import { LaunchModal } from './LaunchModal';

interface CatalogGridProps {
  onConfigureCatalog?: () => void;
}

export const CatalogGrid: React.FC<CatalogGridProps> = ({ onConfigureCatalog }) => {
  const [demos, setDemos] = useState<DemoDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDemo, setSelectedDemo] = useState<DemoDefinition | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await loadConfig();
      if (!config.useLocalCollection && !config.collectionSource) {
        setError('not_configured');
        setLoading(false);
        return;
      }
      if (!config.namespace || !config.collectionName) {
        setError('Catalog not synchronized. Please sync the catalog first to derive namespace and collection name from MANIFEST.json.');
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

  const renderContent = () => {
    if (loading) {
      return (
        <Bullseye style={{ padding: '2rem' }}>
          <Spinner />
        </Bullseye>
      );
    }

    if (error === 'not_configured') {
      return (
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
      );
    }

    if (error) {
      return <Alert variant="danger" title={error} isInline />;
    }

    if (demos.length === 0) {
      return (
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
      );
    }

    return (
      <Gallery hasGutter minWidths={{ default: '100%', md: '300px', lg: '300px' }} style={{ marginTop: '1rem' }}>
        {demos.map((demo) => (
          <Card
            key={demo.id}
            isClickable
            onClick={() => setSelectedDemo(demo)}
            style={{ cursor: 'pointer', border: '1px solid var(--pf-v6-global--BorderColor--100)' }}
          >
            <CardHeader>
              <Flex direction={{ default: 'row' }} alignItems={{ default: 'alignItemsCenter' }}>
                <Icon size="xl">
                  {demo.type === 'playbook' ? <PlayIcon /> : <CubeIcon />}
                </Icon>
                <div>
                  <Content>
                    <h2>{demo.name}</h2>
                    <Badge isRead>{demo.type}</Badge>
                  </Content>
                </div>
              </Flex>
            </CardHeader>
            <CardBody>
              {demo.description || 'A simple demo that prints variables and saves status with transformed values'}
            </CardBody>
            <CardFooter>
              <HelperText>
                <HelperTextItem className="pf-v6-u-mb-lg">
                  <div>
                    <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                      <strong>Path:</strong> {demo.path}
                    </div>
                    <div style={{ fontSize: '0.875rem' }}>
                      <strong>Parameters:</strong> {demo.parameters.length}
                    </div>
                  </div>
                </HelperTextItem>
              </HelperText>
            </CardFooter>
          </Card>
        ))}
      </Gallery>
    );
  };

  return (
    <>
      <ExpandableSection
        toggleText={`Available Demos (${demos.length})`}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        displaySize="lg"
      >
        {renderContent()}
      </ExpandableSection>
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

