import axios from 'axios';
import crypto from 'crypto';

/**
 * Shopify OAuth Service
 * Handles the complete OAuth flow for Shopify app installation
 * This service manages the authentication process between your app and Shopify stores
 */
class ShopifyOAuthService {
  constructor() {
    // Initialize configuration as null - will be loaded lazily
    this._clientId = null;
    this._clientSecret = null;
    this._redirectUri = null;
    this.scopes = 'read_products,read_product_listings,read_orders,write_orders';
    this.apiVersion = '2024-10';
  }

  /**
   * Get configuration values (lazy-loaded from environment)
   */
  get clientId() {
    if (this._clientId === null) {
      this._clientId = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY;
    }
    return this._clientId;
  }

  get clientSecret() {
    if (this._clientSecret === null) {
      this._clientSecret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET;
    }
    return this._clientSecret;
  }

  get redirectUri() {
    if (this._redirectUri === null) {
      this._redirectUri = process.env.SHOPIFY_REDIRECT_URI;
    }
    return this._redirectUri;
  }

  /**
   * Initialize and log configuration (call this when needed)
   */
  initialize() {
    console.log('🔧 ShopifyOAuthService initialized:');
    console.log('  - Client ID:', this.clientId ? 'Present' : 'Missing');
    console.log('  - Client Secret:', this.clientSecret ? 'Present' : 'Missing');
    console.log('  - Redirect URI:', this.redirectUri);
    console.log('  - Scopes:', this.scopes);
  }

  /**
   * Generate the OAuth authorization URL for a specific store
   * This URL is where store owners will be redirected to install your app
   * @param {string} shopDomain - The shop's domain (e.g., 'mystore.myshopify.com')
   * @param {string} state - Random state parameter for security
   * @returns {string} The authorization URL
   */
  generateAuthUrl(shopDomain, state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scopes,
      redirect_uri: this.redirectUri,
      state: state,
    });

    // Ensure shop domain has proper format
    const cleanShopDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const authUrl = `https://${cleanShopDomain}/admin/oauth/authorize?${params.toString()}`;
    
    console.log('🔗 Generated OAuth URL for shop:', cleanShopDomain);
    return authUrl;
  }

  /**
   * Exchange the authorization code for an access token
   * This is called when Shopify redirects back to your app after store owner approves
   * @param {string} shopDomain - The shop's domain
   * @param {string} code - Authorization code from Shopify
   * @param {string} state - State parameter for verification
   * @returns {Object} Access token and shop information
   */
  async exchangeCodeForToken(shopDomain, code, state) {
    try {
      console.log('🔄 Exchanging code for access token for shop:', shopDomain);
      
      // Prepare the token exchange request
      const tokenUrl = `https://${shopDomain}/admin/oauth/access_token`;
      const requestData = {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
      };

      // Make the request to Shopify to exchange code for token
      const response = await axios.post(tokenUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { access_token, scope } = response.data;
      
      console.log('✅ Successfully obtained access token for shop:', shopDomain);
      console.log('  - Token length:', access_token ? access_token.length : 0);
      console.log('  - Granted scopes:', scope);

      return {
        accessToken: access_token,
        scope: scope,
        shopDomain: shopDomain,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Error exchanging code for token:', error.response?.data || error.message);
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Verify the HMAC signature from Shopify
   * This ensures the request is actually from Shopify and hasn't been tampered with
   * @param {Object} query - Query parameters from the callback request
   * @returns {boolean} Whether the signature is valid
   */
  verifyHmac(query) {
    try {
      const { hmac, ...rest } = query;
      
      if (!hmac) {
        console.warn('⚠️ No HMAC signature provided');
        return false;
      }

      // Create the message to verify (sorted query parameters without hmac)
      const sortedParams = Object.keys(rest)
        .sort()
        .map(key => `${key}=${rest[key]}`)
        .join('&');

      // Generate HMAC using the client secret
      const calculatedHmac = crypto
        .createHmac('sha256', this.clientSecret)
        .update(sortedParams)
        .digest('hex');

      // Compare the calculated HMAC with the provided one
      const isValid = calculatedHmac === hmac;
      
      console.log('🔐 HMAC verification:', isValid ? 'Valid' : 'Invalid');
      return isValid;
    } catch (error) {
      console.error('❌ Error verifying HMAC:', error.message);
      return false;
    }
  }

  /**
   * Generate a random state parameter for OAuth security
   * This prevents CSRF attacks during the OAuth flow
   * @returns {string} Random state string
   */
  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get shop information using the access token
   * This verifies the token works and gets basic shop details
   * @param {string} shopDomain - The shop's domain
   * @param {string} accessToken - The access token
   * @returns {Object} Shop information
   */
  async getShopInfo(shopDomain, accessToken) {
    try {
      console.log('🏪 Fetching shop info for:', shopDomain);
      
      const response = await axios.get(
        `https://${shopDomain}/admin/api/${this.apiVersion}/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      const shopInfo = response.data.shop;
      console.log('✅ Shop info retrieved:', shopInfo.name);
      
      return {
        id: shopInfo.id,
        name: shopInfo.name,
        domain: shopInfo.domain,
        email: shopInfo.email,
        currency: shopInfo.currency,
        timezone: shopInfo.timezone,
        planName: shopInfo.plan_name,
      };
    } catch (error) {
      console.error('❌ Error fetching shop info:', error.response?.data || error.message);
      throw new Error(`Failed to fetch shop info: ${error.response?.data?.errors || error.message}`);
    }
  }
}

// Export a singleton instance
export default new ShopifyOAuthService();
