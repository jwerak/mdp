import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Grid,
  GridItem,
  Title,
  Alert,
  Spinner,
  Badge
} from '@patternfly/react-core';
import { getDemos } from '../lib/catalog';
import { loadConfig } from '../lib/config';
import { DemoDefinition } from '../lib/types';
import { LaunchModal } from './LaunchModal';

export const CatalogGrid: React.FC = () => {
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
      if (!config.repoUrl || !config.collectionName) {
        setError('Please configure catalog settings first');
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
          <Spinner />
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <Alert variant="danger" title={error} />
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardTitle>
          <Title headingLevel="h2">Available Demos</Title>
        </CardTitle>
        <CardBody>
          {demos.length === 0 ? (
            <Alert variant="info" title="No demos found in catalog" />
          ) : (
            <Grid hasGutter>
              {demos.map((demo) => (
                <GridItem key={demo.id} span={12} md={6} lg={4}>
                  <Card
                    onClick={() => setSelectedDemo(demo)}
                    style={{ height: '100%', cursor: 'pointer' }}
                    isClickable
                  >
                    <CardTitle>
                      {demo.name}
                      <Badge style={{ marginLeft: '0.5rem' }}>{demo.type}</Badge>
                    </CardTitle>
                    <CardBody>
                      {demo.description && <p style={{ marginBottom: '0.5rem' }}>{demo.description}</p>}
                      <p><strong>Path:</strong> {demo.path}</p>
                      <p><strong>Parameters:</strong> {demo.parameters.length}</p>
                    </CardBody>
                  </Card>
                </GridItem>
              ))}
            </Grid>
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

