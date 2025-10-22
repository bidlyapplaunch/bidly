import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Banner,
  Spinner
} from '@shopify/polaris';
import { useAppBridgeActions } from '../hooks/useAppBridge';

const OAuthSetup = ({ onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsOAuth, setNeedsOAuth] = useState(false);
  const { getShopInfo } = useAppBridgeActions();

  useEffect(() => {
    checkOAuthStatus();
  }, []);

  const checkOAuthStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get shop info from App Bridge
      const shopInfo = getShopInfo();
      if (!shopInfo || !shopInfo.shop) {
        throw new Error('Unable to get shop information');
      }

      console.log('🔍 OAuth Setup - Shop Info:', shopInfo);

      // Check if store has valid OAuth token by testing Shopify API
      const response = await fetch(`/api/shopify/status?shop=${shopInfo.shop}`);
      const data = await response.json();

      if (data.success && data.configured && data.hasAccessToken) {
        // OAuth is complete, proceed to dashboard
        onComplete();
      } else {
        // OAuth is needed
        setNeedsOAuth(true);
      }
    } catch (error) {
      console.error('OAuth check failed:', error);
      setError('Failed to check OAuth status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOAuth = () => {
    // Get shop info
    const shopInfo = getShopInfo();
    if (!shopInfo || !shopInfo.shop) {
      setError('Unable to get shop information');
      return;
    }

    console.log('🔍 OAuth Setup - Completing OAuth for shop:', shopInfo.shop);

    // Redirect to OAuth flow
    const oauthUrl = `/auth/shopify/install?shop=${shopInfo.shop}`;
    window.location.href = oauthUrl;
  };

  if (loading) {
    return (
      <Page>
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: '2rem',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <Spinner size="large" />
                <Text variant="bodyMd" as="p">
                  Checking app setup...
                </Text>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <Layout>
          <Layout.Section>
            <Card>
              <Banner status="critical">
                <Text variant="bodyMd" as="p">
                  {error}
                </Text>
              </Banner>
              <div style={{ marginTop: '1rem' }}>
                <Button onClick={checkOAuthStatus}>
                  Try Again
                </Button>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (needsOAuth) {
    return (
      <Page>
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <Text variant="headingMd" as="h2">
                      Complete App Setup
                    </Text>
                    <div style={{ marginTop: '0.5rem' }}>
                      <Text variant="bodyMd" as="p">
                        To use the auction features, you need to complete the app setup process. 
                        This will connect your store to the auction system and enable product search.
                      </Text>
                    </div>
                  </div>

                  <Banner status="info">
                    <Text variant="bodyMd" as="p">
                      <strong>Why is this needed?</strong><br />
                      The app needs permission to access your store's products to create auctions. 
                      This is a one-time setup process.
                    </Text>
                  </Banner>

                  <div>
                    <Button 
                      primary 
                      size="large"
                      onClick={handleCompleteOAuth}
                    >
                      Complete Setup
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // This shouldn't be reached, but just in case
  return null;
};

export default OAuthSetup;
