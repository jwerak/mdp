import {
  Alert,
  Bullseye,
  Button,
  Flex,
  FlexItem,
  Page,
  PageSection,
  PageSectionTypes,
  Spinner,
  Title
} from '@patternfly/react-core';
import { CogIcon } from '@patternfly/react-icons';
import React, { Component, ErrorInfo, ReactNode, Suspense, lazy, useState } from 'react';

const CatalogGrid = lazy(() => import('./components/CatalogGrid').then(module => ({ default: module.CatalogGrid })));
const InstanceList = lazy(() => import('./components/InstanceList').then(module => ({ default: module.InstanceList })));
const InstanceDetail = lazy(() => import('./components/InstanceDetail').then(module => ({ default: module.InstanceDetail })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(module => ({ default: module.SettingsModal })));

const LoadingFallback: React.FC = () => (
  <Bullseye>
    <Spinner />
  </Bullseye>
);

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <PageSection type={PageSectionTypes.default}>
          <Alert variant="danger" title="An error occurred">
            {this.state.error?.message || 'Unknown error'}
          </Alert>
        </PageSection>
      );
    }

    return this.props.children;
  }
}

export const App: React.FC = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  // If an instance is selected, show detail view
  if (selectedInstanceId) {
    return (
      <Page className="pf-m-no-sidebar">
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <InstanceDetail
              instanceId={selectedInstanceId}
              onBack={() => setSelectedInstanceId(null)}
            />
          </Suspense>
        </ErrorBoundary>
      </Page>
    );
  }

  // Otherwise show main view with catalog and instance list
  return (
    <Page className="pf-m-no-sidebar">
      <PageSection type={PageSectionTypes.default} variant="default" hasBodyWrapper={true}>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Title headingLevel="h1" size="2xl">Demo Deployments</Title>
          </FlexItem>
          <FlexItem>
            <Button
              variant="secondary"
              icon={<CogIcon />}
              onClick={() => setSettingsOpen(true)}
            >
              Configure Catalog
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>
      <PageSection hasBodyWrapper={true}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <CatalogGrid onConfigureCatalog={() => setSettingsOpen(true)} />
          </Suspense>
        </ErrorBoundary>
      </PageSection>
      <PageSection hasBodyWrapper={true}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <InstanceList onViewInstance={setSelectedInstanceId} />
          </Suspense>
        </ErrorBoundary>
      </PageSection>
      {settingsOpen && (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <SettingsModal
              isOpen={settingsOpen}
              onClose={() => setSettingsOpen(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </Page>
  );
};

