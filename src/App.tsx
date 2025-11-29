import React, { useState, Suspense, lazy, Component, ErrorInfo, ReactNode } from 'react';
import {
  Page,
  PageSection,
  PageSectionTypes,
  Spinner,
  Bullseye,
  Alert,
  Title,
  Button,
  Flex,
  FlexItem,
  Split,
  SplitItem
} from '@patternfly/react-core';
import { CogIcon } from '@patternfly/react-icons';

const DemoList = lazy(() => import('./components/DemoList').then(module => ({ default: module.DemoList })));
const InstanceList = lazy(() => import('./components/InstanceList').then(module => ({ default: module.InstanceList })));
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

  return (
    <Page className="pf-m-no-sidebar">
      <PageSection type={PageSectionTypes.default} variant="secondary">
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
      <PageSection type={PageSectionTypes.default}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Split hasGutter>
              <SplitItem isFilled={false} style={{ width: '300px', minWidth: '300px' }}>
                <DemoList />
              </SplitItem>
              <SplitItem isFilled>
                <InstanceList />
              </SplitItem>
            </Split>
            {settingsOpen && (
              <SettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
              />
            )}
          </Suspense>
        </ErrorBoundary>
      </PageSection>
    </Page>
  );
};

