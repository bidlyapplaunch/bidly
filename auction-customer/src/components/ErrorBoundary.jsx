import React from 'react';
import { Banner, Text } from '@shopify/polaris';

/**
 * Generic error boundary so a single malformed auction (e.g. a partial socket
 * update missing fields) cannot blank the entire widget. Renders a fallback
 * banner instead of crashing the React tree.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Bidly marketplace render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <Banner status="warning">
          <Text variant="bodyMd">
            {this.props.message || 'Something went wrong displaying the auctions. Please refresh.'}
          </Text>
        </Banner>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
