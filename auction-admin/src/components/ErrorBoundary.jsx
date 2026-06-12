import React from 'react';
import { AppProvider, Frame, Page, EmptyState } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Admin app crashed', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Render a self-contained recovery UI. We cannot rely on the surrounding
      // Polaris/I18n providers because the error may have originated above them.
      return (
        <AppProvider i18n={enTranslations}>
          <Frame>
            <Page>
              <EmptyState
                heading="Something went wrong"
                action={{ content: 'Reload', onAction: this.handleReload }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  The dashboard ran into an unexpected error. Reload the page to
                  try again. If the problem continues, please contact support.
                </p>
              </EmptyState>
            </Page>
          </Frame>
        </AppProvider>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
