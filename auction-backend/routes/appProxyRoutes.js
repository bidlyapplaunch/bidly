import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getAllAuctions,
  getAuctionById,
  placeBid,
  buyNow,
  getAllAuctionsPage,
  getAuctionDetailsPage
} from '../controllers/auctionController.js';
import {
  validatePlaceBid,
  validateBuyNow,
  validateId
} from '../middleware/validation.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-10';
const BACKEND_BASE_URL = process.env.APP_URL || 'https://bidly-auction-backend.onrender.com';

const marketplaceDistPath = path.join(__dirname, '../../auction-customer/dist');
const marketplaceAssetsPath = path.join(marketplaceDistPath, 'assets');
const marketplaceIndexPath = path.join(marketplaceDistPath, 'index.html');

let marketplaceTemplate = null;
try {
  if (fs.existsSync(marketplaceIndexPath)) {
    marketplaceTemplate = fs.readFileSync(marketplaceIndexPath, 'utf8');
    console.log('✅ Marketplace template loaded for app proxy');
  } else {
    console.warn('⚠️ Marketplace index.html not found at', marketplaceIndexPath);
  }
} catch (error) {
  console.error('❌ Failed to load marketplace template:', error);
}

/**
 * App Proxy Routes for Shopify Theme Integration
 * These routes are accessible via /apps/bidly/* from the storefront
 * They handle CORS and provide a secure way for themes to access auction data
 */

// Serve theme extension assets (NO AUTHENTICATION REQUIRED)
// GET /apps/bidly/assets/bidly-widget.css
router.get('/assets/bidly-widget.css', (req, res) => {
  try {
    const cssPath = path.join(__dirname, '../../extensions/theme-app-extension/assets/bidly-widget.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(cssContent);
  } catch (error) {
    console.error('Error serving CSS:', error);
    res.status(404).send('/* CSS file not found */');
  }
});

// GET /apps/bidly/assets/bidly-widget.js
router.get('/assets/bidly-widget.js', (req, res) => {
  try {
    const jsPath = path.join(__dirname, '../../extensions/theme-app-extension/assets/bidly-widget.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(jsContent);
  } catch (error) {
    console.error('Error serving JS:', error);
    res.status(404).send('// JS file not found');
  }
});

// GET /apps/bidly/assets/locales/:locale.json
router.get('/assets/locales/:locale.json', (req, res) => {
  try {
    const requestedLocale = (req.params.locale || '').toLowerCase();
    const safeLocale = requestedLocale.replace(/[^a-z0-9-]/gi, '') || 'en';
    const localePath = path.join(
      __dirname,
      '../../extensions/theme-app-extension/assets/locales',
      `${safeLocale}.json`
    );

    if (!fs.existsSync(localePath)) {
      return res.status(404).json({ error: 'Locale file not found' });
    }

    const localeContent = fs.readFileSync(localePath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300');
    res.send(localeContent);
  } catch (error) {
    console.error('Error serving locale JSON:', error);
    res.status(404).json({ error: 'Locale file not found' });
  }
});

if (fs.existsSync(marketplaceAssetsPath)) {
  router.use(
    '/assets',
    express.static(marketplaceAssetsPath, {
      maxAge: '1d',
      immutable: true
    })
  );
} else {
  console.warn('⚠️ Marketplace assets directory not found:', marketplaceAssetsPath);
}

// Health check endpoint (NO AUTHENTICATION REQUIRED)
// GET /apps/bidly/health
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Bidly App Proxy is running',
    timestamp: new Date().toISOString()
  });
});

// All other app proxy routes require store identification
router.use(identifyStore);

const getShopifyAccessToken = (store) => {
  if (!store) return null;
  if (typeof store.getAccessToken === 'function') {
    return store.getAccessToken();
  }
  return store.accessToken || null;
};

const fetchShopifyCustomer = async (shopDomain, accessToken, customerId) => {
  if (!shopDomain || !accessToken || !customerId) {
    return null;
  }

  try {
    const response = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.warn(
        '⚠️ Failed to fetch Shopify customer details:',
        response.status,
        await response.text()
      );
      return null;
    }

    const payload = await response.json();
    return payload?.customer || null;
  } catch (error) {
    console.error('❌ Error fetching Shopify customer:', error);
    return null;
  }
};

router.get('/customer/context', async (req, res) => {
  try {
    const shopDomain = req.shopDomain;
    const rawCustomerId = req.query.logged_in_customer_id || req.query.customer_id;

    if (!shopDomain || !rawCustomerId) {
      return res.json({ success: true, loggedIn: false });
    }

    const normalizedCustomerId = rawCustomerId.toString().split('/').pop();
    const accessToken = getShopifyAccessToken(req.store);

    if (!accessToken) {
      console.warn('⚠️ No access token available for customer context fetch');
      return res.json({ success: true, loggedIn: false });
    }

    const customer = await fetchShopifyCustomer(shopDomain, accessToken, normalizedCustomerId);

    if (!customer) {
      return res.json({ success: true, loggedIn: false });
    }

    const fullName = [customer.first_name || '', customer.last_name || ''].join(' ').trim();

    return res.json({
      success: true,
      loggedIn: true,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        fullName: fullName || customer.email || 'Shopify Customer'
      }
    });
  } catch (error) {
    console.error('❌ Error in customer context endpoint:', error);
    return res.json({ success: false, loggedIn: false });
  }
});

router.get('/', async (req, res) => {
  try {
    if (!marketplaceTemplate) {
      return res
        .status(503)
        .send('Marketplace is currently unavailable. Please contact the storefront administrator.');
    }

    const shopDomain = req.shopDomain;
    const baseProxyPath = req.baseUrl || '/apps/bidly';
    const returnPath = `${baseProxyPath}?shop=${encodeURIComponent(shopDomain)}`;
    const loginUrl = `/account/login?return_to=${encodeURIComponent(returnPath)}`;
    const logoutUrl = `/account/logout?return_to=${encodeURIComponent(returnPath)}`;

    const customerPayload = {
      logged_in: false
    };

    const rawCustomerId = req.query.logged_in_customer_id || req.query.customer_id;

    if (rawCustomerId && req.store) {
      const normalizedCustomerId = rawCustomerId.toString().split('/').pop();
      const accessToken =
        typeof req.store.getAccessToken === 'function'
          ? req.store.getAccessToken()
          : req.store.accessToken;

      if (accessToken) {
        try {
          const response = await fetch(
            `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/customers/${normalizedCustomerId}.json`,
            {
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            const customer = data?.customer;

            if (customer) {
              const displayName = [
                customer.first_name || '',
                customer.last_name || ''
              ]
                .join(' ')
                .trim();

              customerPayload.logged_in = true;
              customerPayload.id = customer.id;
              customerPayload.email = customer.email;
              customerPayload.firstName = customer.first_name || '';
              customerPayload.lastName = customer.last_name || '';
              customerPayload.name = displayName || customer.email || 'Shopify Customer';
            }
          } else {
            console.warn(
              '⚠️ Failed to fetch customer details from Shopify:',
              response.status,
              await response.text()
            );
          }
        } catch (error) {
          console.error('❌ Error fetching Shopify customer details:', error);
        }
      }
    }

    const marketplaceConfig = {
      shopDomain,
      appProxyBasePath: baseProxyPath,
      backendBaseUrl: BACKEND_BASE_URL,
      enforceShopifyLogin: true,
      loginUrl,
      logoutUrl,
      customer: customerPayload
    };

    const inlineScript = `
    <script>
      window.BidlyMarketplaceConfig = ${JSON.stringify(marketplaceConfig)};
      (function(config){
        const DEFAULT_BACKEND = config.backendBaseUrl;
        const STORE_BACKEND_MAP = {};
        if (config.shopDomain) {
          STORE_BACKEND_MAP[config.shopDomain] = DEFAULT_BACKEND;
        }

        function cleanShop(shop) {
          if (!shop) { return ''; }
          return shop.replace(/^https?:\\/\\//, '').replace(/\\/$/, '').toLowerCase().trim();
        }

        window.BidlyBackendConfig = {
          STORE_BACKEND_MAP: STORE_BACKEND_MAP,
          DEFAULT_BACKEND: DEFAULT_BACKEND,
          getBackendUrl: function(shopDomain) {
            if (!shopDomain) {
              return DEFAULT_BACKEND;
            }
            const clean = cleanShop(shopDomain);
            return STORE_BACKEND_MAP[clean] || DEFAULT_BACKEND;
          }
        };

        window.BidlyHybridLogin = {
          getCurrentCustomer: function() {
            if (!config.customer || !config.customer.logged_in) {
              return null;
            }
            return {
              id: config.customer.id,
              email: config.customer.email,
              fullName: config.customer.name,
              firstName: config.customer.firstName,
              lastName: config.customer.lastName,
              isTemp: false
            };
          },
          isUserLoggedIn: function() {
            return !!(config.customer && config.customer.logged_in);
          },
          guestLogin: function() {
            if (config.loginUrl) {
              window.location.href = config.loginUrl;
            }
            return Promise.resolve(false);
          },
          openGuestLogin: function() {
            if (config.loginUrl) {
              window.location.href = config.loginUrl;
            }
          },
          logout: function() {
            if (config.logoutUrl) {
              window.location.href = config.logoutUrl;
            }
          }
        };
      })(window.BidlyMarketplaceConfig || {});
    </script>`;

    let htmlOutput = marketplaceTemplate;

    const assetRewrites = [
      { pattern: /src="\/assets\//g, replacement: `src="${baseProxyPath}/assets/` },
      { pattern: /href="\/assets\//g, replacement: `href="${baseProxyPath}/assets/` },
      { pattern: /src="\.\/*assets\//g, replacement: `src="${baseProxyPath}/assets/` },
      { pattern: /href="\.\/*assets\//g, replacement: `href="${baseProxyPath}/assets/` }
    ];

    assetRewrites.forEach(({ pattern, replacement }) => {
      htmlOutput = htmlOutput.replace(pattern, replacement);
    });

    const finalHtml = htmlOutput.replace('</body>', `${inlineScript}\n</body>`);

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html');
    return res.send(finalHtml);
  } catch (error) {
    console.error('❌ Failed to render marketplace page:', error);
    return res
      .status(500)
      .send('Failed to load the marketplace. Please try again or contact the store owner.');
  }
});

// Get auction listing page (all auctions) - MUST be first to avoid conflicts
// GET /apps/bidly/api/auctions/list?shop=store.myshopify.com
router.get('/api/auctions/list', getAllAuctionsPage);

// Get all auctions for theme display
// GET /apps/bidly/api/auctions?shop=store.myshopify.com
router.get('/api/auctions', getAllAuctions);

// Get single auction by ID (accepts both MongoDB ObjectId and Shopify Product ID)
// GET /apps/bidly/api/auctions/:id?shop=store.myshopify.com
router.get('/api/auctions/:id', getAuctionById);

// Get auction details page (renders HTML page for individual auction)
// GET /apps/bidly/api/auctions/page/:id?shop=store.myshopify.com
router.get('/api/auctions/page/:id', validateId, getAuctionDetailsPage);

// Place bid on auction
// POST /apps/bidly/api/auctions/:id/bid?shop=store.myshopify.com
router.post('/api/auctions/:id/bid', validateId, validatePlaceBid, placeBid);

// Buy now
// POST /apps/bidly/api/auctions/:id/buy-now?shop=store.myshopify.com
router.post('/api/auctions/:id/buy-now', validateId, validateBuyNow, buyNow);

export default router;
