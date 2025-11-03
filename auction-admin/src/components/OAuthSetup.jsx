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
  const [shopDomain, setShopDomain] = useState(null);
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
      console.log('🔍 OAuth Setup - Shop Info:', shopInfo);
      console.log('🔍 OAuth Setup - Full URL:', window.location.href);
      console.log('🔍 OAuth Setup - Search Params:', window.location.search);
      
      if (!shopInfo || !shopInfo.shop) {
        // Try additional methods to get shop
        let shop = null;
        
        // Method 1: Try parent window if in iframe (for embedded apps)
        try {
          if (window.self !== window.top) {
            const parentUrl = new URL(window.top.location.href);
            shop = parentUrl.searchParams.get('shop');
            console.log('🔍 Tried parent window, found shop:', shop);
          }
        } catch (e) {
          console.log('🔍 Cannot access parent window (cross-origin):', e.message);
        }
        
        // Method 2: Try document.referrer
        if (!shop && document.referrer) {
          try {
            const referrerUrl = new URL(document.referrer);
            shop = referrerUrl.searchParams.get('shop');
            console.log('🔍 Tried referrer, found shop:', shop);
          } catch (e) {
            console.log('🔍 Cannot parse referrer:', e.message);
          }
        }
        
        // Method 3: Try extracting from hostname
        if (!shop && window.location.hostname.includes('myshopify.com')) {
          shop = window.location.hostname;
          console.log('🔍 Extracted shop from hostname:', shop);
        }
        
        if (!shop) {
          throw new Error('Unable to get shop information. Please ensure you are accessing the app through the Shopify admin.');
        }
        
        // Store the shop we found
        setShopDomain(shop);
      } else {
        // Store the shop we found
        setShopDomain(shopInfo.shop);
      }

      const shopToUse = shopInfo?.shop || shopDomain;
      console.log('🔍 OAuth Setup - Using shop:', shopToUse);

      // Check if store has valid OAuth token by testing Shopify API
      const shopToUse = shopInfo?.shop || shopDomain;
      const response = await fetch(`https://bidly-auction-backend.onrender.com/api/shopify/status?shop=${shopToUse}`);
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
    // Use the shop we stored earlier, or try to get it again
    let shop = shopDomain;
    
    if (!shop) {
      const shopInfo = getShopInfo();
      shop = shopInfo?.shop;
      
      // Try additional methods if still not found
      if (!shop) {
        try {
          if (window.self !== window.top) {
            const parentUrl = new URL(window.top.location.href);
            shop = parentUrl.searchParams.get('shop');
          }
        } catch (e) {
          // Cross-origin, can't access
        }
      }
      
      if (!shop && document.referrer) {
        try {
          const referrerUrl = new URL(document.referrer);
          shop = referrerUrl.searchParams.get('shop');
        } catch (e) {
          // Can't parse
        }
      }
    }
    
    if (!shop) {
      setError('Unable to get shop information. Please refresh the page or access the app through Shopify admin.');
      console.error('❌ No shop found. URL:', window.location.href);
      console.error('❌ Referrer:', document.referrer);
      console.error('❌ Hostname:', window.location.hostname);
      return;
    }

    console.log('🔍 OAuth Setup - Completing OAuth for shop:', shop);

    // Redirect to OAuth flow
    // Use top-level navigation to break out of iframe (Shopify OAuth cannot be in iframe)
    const oauthUrl = `https://bidly-auction-backend.onrender.com/auth/shopify/install?shop=${shop}`;
    
    // Check if we're in an iframe
    try {
      if (window.self !== window.top) {
        // We're in an iframe - use form submission to break out
        // This works even with cross-origin restrictions
        const form = document.createElement('form');
        form.method = 'GET';
        form.action = oauthUrl;
        form.target = '_top'; // Break out of iframe
        form.style.display = 'none';
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
      } else {
        // We're not in an iframe - regular redirect
        window.location.href = oauthUrl;
      }
    } catch (error) {
      // Fallback: try direct redirect
      console.error('Redirect error, using fallback:', error);
      try {
        window.location.href = oauthUrl;
      } catch (e) {
        // Last resort: create clickable link
        const link = document.createElement('a');
        link.href = oauthUrl;
        link.target = '_top';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
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
