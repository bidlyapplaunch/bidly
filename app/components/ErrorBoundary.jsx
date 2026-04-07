import { Component } from 'react';
import { Card, Page, Banner, Button } from '@shopify/polaris';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Page>
          <Card>
            <Banner tone="critical" title="Something went wrong">
              <p>An unexpected error occurred. Please try refreshing the page.</p>
            </Banner>
            <div style={{ marginTop: '16px' }}>
              <Button onClick={() => window.location.reload()}>Refresh page</Button>
            </div>
          </Card>
        </Page>
      );
    }
    return this.props.children;
  }
}
