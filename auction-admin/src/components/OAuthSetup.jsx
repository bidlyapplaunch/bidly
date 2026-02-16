import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import useAdminI18n from '../hooks/useAdminI18n';

const OAuthSetup = ({ onComplete }) => {
  // Use window.console directly to bypass debug filter
  if (typeof window !== 'undefined' && window.console) {
    window.console.warn('🔵 OAuthSetup component rendered');
  }
  const i18n = useAdminI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsOAuth, setNeedsOAuth] = useState(false);
  const [shopDomain, setShopDomain] = useState(null);
  const [manualShop, setManualShop] = useState('');
  const { getShopInfo } = useAppBridgeActions();
  const initialCheckDone = useRef(false);

  const redirectToShopifyAdmin = useCallback((shop, host) => {
    const cleanShop = (shop || '').trim();
    
    // Determine app handle from API key
    const apiKey = window.__SHOPIFY_API_KEY__ || 
                   document.querySelector('meta[name="shopify-api-key"]')?.content ||
                   new URLSearchParams(window.location.search).get('apiKey') ||
                   new URLSearchParams(window.location.search).get('api_key');
    
    let appHandle = null;
    
    if (apiKey) {
      // Map client IDs to app handles
      if (apiKey === 'de32970476f2ecf20d98f9d9b6994c89') {
        appHandle = 'bidly-2'; // Second app
      } else if (apiKey === '698a2d663b3718b47b794bfbd6835ef4') {
        appHandle = 'bidly-3'; // First app
      }
    }
    
    // Require app handle - fail if not determined
    if (!appHandle) {
      console.error('❌ Could not determine app handle from API key:', apiKey);
      throw new Error('Unable to determine app handle. API key must match a known app.');
    }
    
    let adminUrl = null;

    if (host) {
      try {
        const decodedHost = window.atob(host);
        if (decodedHost && decodedHost.startsWith('admin.shopify.com')) {
          const hasAppsPath = decodedHost.includes('/apps/');
          adminUrl = `https://${decodedHost}${hasAppsPath ? '' : `/apps/${appHandle}`}`;
        }
      } catch (error) {
        console.warn('⚠️ Failed to decode host parameter:', error);
      }
    }

    if (!adminUrl && cleanShop.endsWith('.myshopify.com')) {
      const storeSlug = cleanShop.replace('.myshopify.com', '');
      adminUrl = `https://admin.shopify.com/store/${storeSlug}/apps/${appHandle}`;
    }

    if (!adminUrl) {
      return false;
    }

    try {
      const target = window.top ?? window;
      target.location.href = adminUrl;
      return true;
    } catch (error) {
      console.error('❌ Failed to redirect to Shopify admin:', error);
      return false;
    }
  }, []);

  const checkOAuthStatus = useCallback(async () => {
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
          throw new Error(i18n.translate('admin.oauth.setup.errors.noShop'));
        }
        
        // Store the shop we found
        setShopDomain(shop);
      } else {
        // Store the shop we found
        setShopDomain(shopInfo.shop);
      }

      const shopToUse = shopInfo?.shop || shopDomain;
      console.log('🔍 OAuth Setup - Using shop:', shopToUse);

      // Check if store has completed OAuth installation
      if (!shopToUse) {
        throw new Error('Shop domain is required but not found');
      }
      
      // Get backend URL for this shop
      const { getBackendUrl } = await import('../config/backendConfig.js');
      let backendUrl = getBackendUrl(shopToUse);
      
      // If backendUrl is empty or relative, use window.location.origin
      if (!backendUrl || !backendUrl.startsWith('http')) {
        backendUrl = window.location.origin;
      }
      
      // Use the OAuth status endpoint which doesn't require authentication
      // Add cache-busting to prevent 304 responses from using stale data
      const cacheBuster = `?shop=${shopToUse}&_t=${Date.now()}`;
      const response = await fetch(`${backendUrl}/auth/shopify/status${cacheBuster}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      // 304 Not Modified is a valid response - treat it as success
      if (!response.ok && response.status !== 304) {
        // If endpoint doesn't exist or returns error, assume OAuth is needed
        console.warn('⚠️ OAuth status check failed:', response.status, response.statusText);
        setNeedsOAuth(true);
        return;
      }
      
      // For 304, the browser should use cached response body
      const data = await response.json();
      console.log('🔍 OAuth status response:', data);

      // Check if store is installed (has completed OAuth)
      if (data.success && data.data && data.data.isInstalled) {
        // OAuth is complete, proceed to dashboard
        console.log('✅ Store is already installed, proceeding to dashboard');
        onComplete();
      } else {
        // OAuth is needed
        console.log('⚠️ Store is not installed, showing OAuth setup');
        setNeedsOAuth(true);
      }
    } catch (error) {
      console.error('OAuth check failed:', error);
      setError(i18n.translate('admin.oauth.setup.errors.noShop'));
    } finally {
      setLoading(false);
    }
  }, [getShopInfo, onComplete, redirectToShopifyAdmin, shopDomain, i18n]);

  useEffect(() => {
    // Use window.console directly to bypass debug filter
    if (typeof window !== 'undefined' && window.console) {
      window.console.warn('🔵 OAuthSetup useEffect running, initialCheckDone:', initialCheckDone.current);
    }
    if (initialCheckDone.current) {
      if (typeof window !== 'undefined' && window.console) {
        window.console.warn('🔵 OAuthSetup useEffect: already done, skipping');
      }
      return;
    }
    initialCheckDone.current = true;
    if (typeof window !== 'undefined' && window.console) {
      window.console.warn('🔵 OAuthSetup useEffect: calling checkOAuthStatus');
    }

    const urlParams = new URLSearchParams(window.location.search);
    const shopFromUrl = urlParams.get('shop');
    const installed = urlParams.get('installed') === 'true';
    const success = urlParams.get('success') !== 'false';
    const host = urlParams.get('host');

    if (shopFromUrl) {
      console.log('✅ Found shop in URL on mount:', shopFromUrl);
      setShopDomain(shopFromUrl);
    } else {
      console.warn('⚠️ No shop in URL on mount:', window.location.href);
    }

    if (installed && success) {
      console.log('🔁 OAuth completed externally, redirecting back to Shopify admin.');
      const redirected = redirectToShopifyAdmin(shopFromUrl, host);
      if (redirected) {
        return;
      }
    }

    // Immediately try to get shop from URL on mount
    checkOAuthStatus();
  }, [checkOAuthStatus, redirectToShopifyAdmin]);

  const handleCompleteOAuth = async () => {
    console.log('🚀🚀🚀 handleCompleteOAuth called 🚀🚀🚀');
    console.log('📍 Initial state check:');
    console.log('  - shopDomain state:', shopDomain);
    console.log('  - manualShop state:', manualShop);
    console.log('  - window.location.href:', window.location.href);
    console.log('  - window.location.search:', window.location.search);
    
    // Try to get shop from multiple sources
    let shop = null;
    
    // Method 1: Use stored shop from state (if we found it earlier) - THIS SHOULD WORK
    if (shopDomain) {
      shop = shopDomain;
      console.log('✅✅✅ Using shop from state (shopDomain):', shop);
    } else {
      console.warn('⚠️ shopDomain state is empty/null');
    }
    
    // Method 2: Try current URL search params directly (multiple ways)
    if (!shop) {
      // Try URLSearchParams
      try {
        const urlParams = new URLSearchParams(window.location.search);
        shop = urlParams.get('shop');
        if (shop) {
          console.log('✅ Found shop via URLSearchParams:', shop);
        }
      } catch (e) {
        console.error('Error with URLSearchParams:', e);
      }
      
      // Also try manual regex parsing as fallback
      if (!shop && window.location.search) {
        const match = window.location.search.match(/[?&]shop=([^&]+)/);
        if (match && match[1]) {
          shop = decodeURIComponent(match[1]);
          console.log('✅ Found shop via regex:', shop);
        }
      }
      
      // Try hash if it exists
      if (!shop && window.location.hash) {
        const hashMatch = window.location.hash.match(/[?&]shop=([^&]+)/);
        if (hashMatch && hashMatch[1]) {
          shop = decodeURIComponent(hashMatch[1]);
          console.log('✅ Found shop in hash:', shop);
        }
      }
    }
    
    // Method 3: Try getShopInfo helper
    if (!shop) {
      const shopInfo = getShopInfo();
      shop = shopInfo?.shop;
      if (shop) {
        console.log('🔍 Found shop from getShopInfo:', shop);
      }
    }
    
    // Method 4: Try parent window if in iframe
    if (!shop) {
      try {
        if (window.self !== window.top) {
          const parentUrl = new URL(window.top.location.href);
          shop = parentUrl.searchParams.get('shop');
          if (shop) {
            console.log('🔍 Found shop in parent window:', shop);
          }
        }
      } catch (e) {
        console.log('🔍 Cannot access parent window (cross-origin):', e.message);
      }
    }
    
    // Method 5: Try document referrer
    if (!shop && document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        shop = referrerUrl.searchParams.get('shop');
        if (shop) {
          console.log('🔍 Found shop in referrer:', shop);
        }
      } catch (e) {
        console.log('🔍 Cannot parse referrer:', e.message);
      }
    }
    
    // Method 6: Try extracting from hostname
    if (!shop && window.location.hostname.includes('myshopify.com')) {
      shop = window.location.hostname;
      console.log('🔍 Extracted shop from hostname:', shop);
    }
    
    // If still no shop found, check if we have manual input
    if (!shop && manualShop && manualShop.trim()) {
      shop = manualShop.trim();
      console.log('🔍 Using manually entered shop:', shop);
    }
    
    if (!shop) {
      const errorMsg = i18n.translate('admin.oauth.setup.errors.noShop');
      setError(errorMsg);
      console.error('❌❌❌ CRITICAL: No shop found after trying all methods ❌❌❌');
      console.error('  - Full URL:', window.location.href);
      console.error('  - Search params:', window.location.search);
      console.error('  - Hash:', window.location.hash);
      console.error('  - Referrer:', document.referrer);
      console.error('  - Hostname:', window.location.hostname);
      console.error('  - Stored shopDomain:', shopDomain);
      console.error('  - Manual shop:', manualShop);
      console.error('  - All window.location properties:', {
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash,
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        origin: window.location.origin
      });
      // Show manual input field - don't try to redirect
      setNeedsOAuth(true);
      return; // STOP - don't proceed with OAuth URL generation
    }

    // Validate and encode shop parameter
    if (!shop || typeof shop !== 'string' || shop.trim() === '') {
      setError(i18n.translate('admin.oauth.setup.errors.invalidShop'));
      console.error('❌ Invalid shop value:', shop);
      return;
    }
    
    // Clean and validate shop domain format
    const cleanedShop = shop.trim();
    const shopDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
    if (!shopDomainRegex.test(cleanedShop)) {
      setError(i18n.translate('admin.oauth.setup.errors.invalidFormat', { shop: cleanedShop }));
      console.error('❌ Invalid shop format:', cleanedShop);
      return;
    }
    
    console.log('✅ OAuth Setup - Using shop for redirect:', cleanedShop);

    // CRITICAL: Validate the final shop one more time before building URL
    if (!cleanedShop || cleanedShop.trim() === '' || !cleanedShop.includes('.myshopify.com')) {
      const errorMsg = `Invalid shop domain: ${cleanedShop || 'undefined'}. Please enter a valid shop domain (e.g., store.myshopify.com).`;
      setError(errorMsg);
      console.error('❌❌❌ CRITICAL VALIDATION FAILED ❌❌❌');
      console.error('  - cleanedShop value:', cleanedShop);
      console.error('  - cleanedShop type:', typeof cleanedShop);
      console.error('  - cleanedShop length:', cleanedShop?.length);
      console.error('  - Contains .myshopify.com:', cleanedShop?.includes('.myshopify.com'));
      console.error('  - This shop value CANNOT be used for OAuth');
      setNeedsOAuth(true);
      return; // STOP - absolutely do not generate URL without valid shop
    }
    
    // Final safety check - ensure shop is actually a string and not undefined/null
    if (typeof cleanedShop !== 'string' || cleanedShop.length < 10) {
      const errorMsg = `Shop domain validation failed. Received: ${JSON.stringify(cleanedShop)}`;
      setError(errorMsg);
      console.error('❌ Type/length validation failed:', {
        type: typeof cleanedShop,
        value: cleanedShop,
        length: cleanedShop?.length
      });
      setNeedsOAuth(true);
      return;
    }

    // FINAL VALIDATION: One last check before URL generation
    console.log('🔍 FINAL CHECK before generating OAuth URL:');
    console.log('  - cleanedShop:', cleanedShop);
    console.log('  - Is string?', typeof cleanedShop === 'string');
    console.log('  - Length:', cleanedShop.length);
    console.log('  - Contains .myshopify.com?', cleanedShop.includes('.myshopify.com'));
    
    if (!cleanedShop || typeof cleanedShop !== 'string' || !cleanedShop.includes('.myshopify.com')) {
      console.error('❌❌❌ FINAL VALIDATION FAILED - ABORTING URL GENERATION ❌❌❌');
      setError(i18n.translate('admin.oauth.setup.errors.validationFailed', { shop: JSON.stringify(cleanedShop) }));
      setNeedsOAuth(true);
      return;
    }

    // Get backend URL for this shop - for OAuth we need absolute URL
    const { getBackendUrl } = await import('../config/backendConfig.js');
    let backendUrl = getBackendUrl(cleanedShop);
    
    // If backendUrl is empty or relative, use window.location.origin
    // This is required for OAuth redirects from iframes
    if (!backendUrl || !backendUrl.startsWith('http')) {
      backendUrl = window.location.origin;
      console.log('🔗 Using current origin as backend URL:', backendUrl);
    }
    
    const baseUrl = `${backendUrl}/auth/shopify/install`;
    
    // Redirect to OAuth flow
    // Use top-level navigation to break out of iframe (Shopify OAuth cannot be in iframe)
    const encodedShop = encodeURIComponent(cleanedShop);
    const oauthUrl = `${baseUrl}?shop=${encodedShop}`;
    
    console.log('🔗 Using backend URL:', backendUrl, 'for shop:', cleanedShop);
    
    console.log('✅✅✅ GENERATING OAUTH URL ✅✅✅');
    console.log('  - Base URL:', baseUrl);
    console.log('  - Shop (raw):', cleanedShop);
    console.log('  - Shop (encoded):', encodedShop);
    console.log('  - Final OAuth URL:', oauthUrl);
    console.log('  - URL includes shop?', oauthUrl.includes('shop='));
    
    // Verify the URL was constructed correctly
    try {
      const testUrl = new URL(oauthUrl);
      const testShop = testUrl.searchParams.get('shop');
      if (!testShop || testShop !== cleanedShop) {
        throw new Error(`URL construction failed! Expected shop="${cleanedShop}", got shop="${testShop}"`);
      }
      console.log('✅ URL construction verified successfully');
      console.log('  - URL shop param value:', testShop);
    } catch (e) {
      console.error('❌ URL construction verification failed:', e);
      setError(i18n.translate('admin.oauth.setup.errors.urlConstruction'));
      setNeedsOAuth(true);
      return;
    }
    
    // Check if we're in an iframe
    console.log('🔍 About to redirect/navigate. Final shop value:', cleanedShop);
    console.log('🔍 Final OAuth URL:', oauthUrl);
    console.log('🔍 Is in iframe?', window.self !== window.top);
    
    try {
      if (window.self !== window.top) {
        // We're in an iframe - use top-level navigation to break out
        // This bypasses CSP form-action restrictions
        console.log('📤 Breaking out of iframe with top-level redirect');
        console.log('  - OAuth URL:', oauthUrl);
        try {
          // Try to access top window and redirect
          window.top.location.href = oauthUrl;
        } catch (e) {
          // If we can't access top (cross-origin), try using window.open as fallback
          console.warn('⚠️ Cannot access window.top, trying window.open:', e);
          window.open(oauthUrl, '_top');
        }
      } else {
        // We're not in an iframe - regular redirect
        console.log('📤 Direct redirect to:', oauthUrl);
        window.location.href = oauthUrl;
      }
    } catch (error) {
      // Fallback: try direct redirect
      console.error('Redirect error, using fallback:', error);
      try {
        window.location.href = oauthUrl;
      } catch (e) {
        // Last resort: create clickable link
        console.error('All redirect methods failed, using link click:', e);
        const link = document.createElement('a');
        link.href = oauthUrl;
        link.target = '_top';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        }, 100);
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
                <Spinner size="large" accessibilityLabel={i18n.translate('admin.oauth.loading.title')} />
                <Text variant="bodyMd" as="p">
                  {i18n.translate('admin.oauth.loading.message')}
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
              <Banner status="critical" title={i18n.translate('admin.oauth.error.title')}>
                <Text variant="bodyMd" as="p">
                  {error}
                </Text>
              </Banner>
              <div style={{ marginTop: '1rem' }}>
                <Button onClick={checkOAuthStatus}>
                  {i18n.translate('admin.oauth.error.tryAgain')}
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
                      {i18n.translate('admin.oauth.setup.title')}
                    </Text>
                    <div style={{ marginTop: '0.5rem' }}>
                      <Text variant="bodyMd" as="p">
                        {i18n.translate('admin.oauth.setup.description')}
                      </Text>
                    </div>
                  </div>

                  <Banner status="info">
                    <Text variant="bodyMd" as="p">
                      <strong>{i18n.translate('admin.oauth.setup.whyNeeded.title')}</strong><br />
                      {i18n.translate('admin.oauth.setup.whyNeeded.message')}
                    </Text>
                  </Banner>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {error && error.includes('Unable to get shop') && (
                      <div style={{ marginBottom: '1rem' }}>
                        <Text variant="bodyMd" as="p" tone="subdued" style={{ marginBottom: '0.5rem' }}>
                          {i18n.translate('admin.oauth.setup.manualShop.label')}
                        </Text>
                        <input
                          type="text"
                          placeholder={i18n.translate('admin.oauth.setup.manualShop.placeholder')}
                          value={manualShop}
                          onChange={(e) => setManualShop(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #c9cccf',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    )}
                    <Button 
                      primary 
                      size="large"
                      onClick={handleCompleteOAuth}
                      disabled={error && error.includes('Unable to get shop') && !manualShop.trim()}
                    >
                      {i18n.translate('admin.oauth.setup.action')}
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
