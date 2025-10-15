import axios from 'axios';
import Store from '../models/Store.js';

/**
 * Enhanced Shopify Service with OAuth Support
 * This service now works with store-specific access tokens from the OAuth flow
 * Each store has its own token stored in the database
 */
class ShopifyService {
  constructor() {
    this.apiVersion = '2024-10';
    
    console.log('🔧 ShopifyService initialized with OAuth support');
    console.log('  - API Version:', this.apiVersion);
    console.log('  - Mode: Store-specific tokens (OAuth)');
  }

  /**
   * Create an authenticated client for a specific store
   * This method creates a new axios client with the store's access token
   * @param {string} shopDomain - The shop's domain
   * @param {string} accessToken - The store's access token
   * @returns {Object} Configured axios client
   */
  createClient(shopDomain, accessToken) {
    const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    return axios.create({
      baseURL: `https://${cleanDomain}/admin/api/${this.apiVersion}`,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get store information and create authenticated client
   * This is the main method to get a working client for a specific store
   * @param {string} shopDomain - The shop's domain
   * @returns {Object} Object with client and store info
   */
  async getStoreClient(shopDomain) {
    try {
      console.log('🏪 Getting store client for:', shopDomain);
      
      // Find the store in the database
      const store = await Store.findByDomain(shopDomain);
      
      if (!store || !store.isInstalled) {
        throw new Error(`Store ${shopDomain} not found or not installed`);
      }

      // Get the access token (this method handles security)
      const accessToken = store.getAccessToken();
      
      if (!accessToken) {
        throw new Error(`No access token found for store ${shopDomain}`);
      }

      // Create and return the authenticated client
      const client = this.createClient(shopDomain, accessToken);
      
      console.log('✅ Store client created for:', shopDomain);
      
      return {
        client,
        store,
        shopDomain: store.shopDomain,
        accessToken
      };
      
    } catch (error) {
      console.error('❌ Error getting store client:', error.message);
      throw error;
    }
  }

  /**
   * Fetch a single product by ID for a specific store
   * @param {string} shopDomain - The shop's domain
   * @param {string} productId - Shopify product ID
   * @returns {Object} Product data with title, images, and price
   */
  async getProduct(shopDomain, productId) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const response = await client.get(`/products/${productId}.json`);
      const product = response.data.product;
      
      return this.formatProductData(product);
    } catch (error) {
      console.error('Error fetching product:', error.response?.data || error.message);
      throw new Error(`Failed to fetch product ${productId}: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Fetch multiple products by IDs for a specific store
   * @param {string} shopDomain - The shop's domain
   * @param {Array} productIds - Array of Shopify product IDs
   * @returns {Array} Array of formatted product data
   */
  async getProducts(shopDomain, productIds) {
    try {
      const promises = productIds.map(id => this.getProduct(shopDomain, id));
      const products = await Promise.all(promises);
      return products;
    } catch (error) {
      console.error('Error fetching products:', error.message);
      throw error;
    }
  }

  /**
   * Search products by title or handle for a specific store
   * @param {string} shopDomain - The shop's domain
   * @param {string} query - Search query
   * @param {number} limit - Number of results to return (default: 10)
   * @returns {Array} Array of matching products
   */
  async searchProducts(shopDomain, query, limit = 10) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      // Shopify REST API doesn't support text search directly
      // We need to fetch products and filter them client-side
      console.log(`🔍 Searching for: "${query}" in store: ${shopDomain}`);
      
      const response = await client.get('/products.json', {
        params: {
          limit: 250, // Get more products to search through
        },
      });
      
      const allProducts = response.data.products;
      console.log(`📦 Found ${allProducts.length} total products`);
      
      // Filter products based on query
      const searchQuery = query.toLowerCase();
      console.log(`🔍 Search query: "${searchQuery}"`);
      
      const filteredProducts = allProducts.filter(product => {
        const title = product.title?.toLowerCase() || '';
        const body = product.body_html?.toLowerCase() || '';
        const tags = product.tags?.toLowerCase() || '';
        const vendor = product.vendor?.toLowerCase() || '';
        
        const matches = title.includes(searchQuery) || 
               body.includes(searchQuery) || 
               tags.includes(searchQuery) || 
               vendor.includes(searchQuery);
        
        if (matches) {
          console.log(`✅ Match found: "${product.title}" (title: "${title}", vendor: "${vendor}")`);
        }
        
        return matches;
      });
      
      console.log(`✅ Found ${filteredProducts.length} matching products out of ${allProducts.length} total`);
      
      // Take only the requested limit
      const limitedProducts = filteredProducts.slice(0, limit);
      return limitedProducts.map(product => this.formatProductData(product));
    } catch (error) {
      console.error('Error searching products:', error.response?.data || error.message);
      
      // If store is not found or not installed, return mock data
      if (error.message.includes('not found') || error.message.includes('not installed')) {
        console.log('Store not found, returning mock data for:', query);
        return this.getMockProducts(query, limit);
      }
      
      throw new Error(`Failed to search products: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Get mock products for development when Shopify is not configured
   */
  getMockProducts(query, limit = 10) {
    const mockProducts = [
      {
        id: 1,
        title: 'Yellow Snowboard',
        handle: 'yellow-snowboard',
        body_html: 'A bright yellow snowboard perfect for winter sports',
        vendor: 'SnowSports Co',
        product_type: 'Snowboard',
        tags: 'snowboard,yellow,winter,sports',
        images: [
          {
            id: 1,
            src: 'https://cdn.shopify.com/s/files/1/0001/0002/0003/products/yellow-snowboard.jpg',
            alt: 'Yellow Snowboard'
          }
        ],
        variants: [
          {
            id: 1,
            title: 'Default Title',
            price: '299.99',
            inventory_quantity: 10
          }
        ]
      },
      {
        id: 2,
        title: 'Blue Winter Jacket',
        handle: 'blue-winter-jacket',
        body_html: 'Warm blue winter jacket for cold weather',
        vendor: 'WinterWear',
        product_type: 'Jacket',
        tags: 'jacket,blue,winter,warm',
        images: [
          {
            id: 2,
            src: 'https://cdn.shopify.com/s/files/1/0001/0002/0003/products/blue-jacket.jpg',
            alt: 'Blue Winter Jacket'
          }
        ],
        variants: [
          {
            id: 2,
            title: 'Default Title',
            price: '149.99',
            inventory_quantity: 5
          }
        ]
      },
      {
        id: 3,
        title: 'Red Ski Boots',
        handle: 'red-ski-boots',
        body_html: 'Comfortable red ski boots for skiing',
        vendor: 'SkiGear Pro',
        product_type: 'Ski Boots',
        tags: 'boots,red,ski,winter',
        images: [
          {
            id: 3,
            src: 'https://cdn.shopify.com/s/files/1/0001/0002/0003/products/red-boots.jpg',
            alt: 'Red Ski Boots'
          }
        ],
        variants: [
          {
            id: 3,
            title: 'Default Title',
            price: '199.99',
            inventory_quantity: 8
          }
        ]
      }
    ];

    // Filter mock products based on query
    const filteredProducts = mockProducts.filter(product => 
      product.title.toLowerCase().includes(query.toLowerCase()) ||
      product.body_html.toLowerCase().includes(query.toLowerCase()) ||
      product.tags.toLowerCase().includes(query.toLowerCase())
    );

    return filteredProducts.slice(0, limit).map(product => this.formatProductData(product));
  }

  /**
   * Get all products with pagination for a specific store
   * @param {string} shopDomain - The shop's domain
   * @param {number} limit - Number of products per page (default: 50)
   * @param {string} pageInfo - Pagination cursor (optional)
   * @returns {Object} Object with products array and pagination info
   */
  async getAllProducts(shopDomain, limit = 50, pageInfo = null) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const params = { limit };
      if (pageInfo) {
        params.page_info = pageInfo;
      }

      const response = await client.get('/products.json', { params });
      const products = response.data.products;
      const pagination = this.extractPaginationInfo(response.headers);

      return {
        products: products.map(product => this.formatProductData(product)),
        pagination,
      };
    } catch (error) {
      console.error('Error fetching all products:', error.response?.data || error.message);
      throw new Error(`Failed to fetch products: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Format product data for our auction system
   * @param {Object} product - Raw Shopify product data
   * @returns {Object} Formatted product data
   */
  formatProductData(product) {
    if (!product) {
      return null;
    }

    // Get the first variant (usually the main product)
    const variant = product.variants && product.variants[0];
    
    // Get the first image
    const image = product.images && product.images[0];
    
    return {
      id: product.id.toString(),
      title: product.title,
      handle: product.handle,
      description: product.body_html ? this.stripHtml(product.body_html) : '',
      price: variant ? parseFloat(variant.price) : 0,
      compareAtPrice: variant ? parseFloat(variant.compare_at_price || 0) : 0,
      image: image ? {
        src: image.src,
        alt: image.alt || product.title,
        width: image.width,
        height: image.height,
      } : null,
      images: product.images ? product.images.map(img => ({
        src: img.src,
        alt: img.alt || product.title,
        width: img.width,
        height: img.height,
      })) : [],
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags ? product.tags.split(',').map(tag => tag.trim()) : [],
      status: product.status,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      // Additional useful data
      variants: product.variants ? product.variants.map(v => ({
        id: v.id.toString(),
        title: v.title,
        price: parseFloat(v.price),
        compareAtPrice: parseFloat(v.compare_at_price || 0),
        sku: v.sku,
        inventory: v.inventory_quantity,
        available: v.available,
      })) : [],
    };
  }

  /**
   * Extract pagination information from response headers
   * @param {Object} headers - Response headers
   * @returns {Object} Pagination info
   */
  extractPaginationInfo(headers) {
    const linkHeader = headers.link;
    if (!linkHeader) {
      return { hasNext: false, hasPrevious: false };
    }

    const links = linkHeader.split(',').map(link => {
      const [url, rel] = link.split(';');
      return {
        url: url.trim().slice(1, -1), // Remove < and >
        rel: rel.trim().split('=')[1].slice(1, -1), // Remove quotes
      };
    });

    const nextLink = links.find(link => link.rel === 'next');
    const prevLink = links.find(link => link.rel === 'previous');

    return {
      hasNext: !!nextLink,
      hasPrevious: !!prevLink,
      nextPageInfo: nextLink ? this.extractPageInfo(nextLink.url) : null,
      previousPageInfo: prevLink ? this.extractPageInfo(prevLink.url) : null,
    };
  }

  /**
   * Extract page_info parameter from URL
   * @param {string} url - URL with page_info parameter
   * @returns {string} Page info value
   */
  extractPageInfo(url) {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('page_info');
  }

  /**
   * Validate if a product ID exists in Shopify for a specific store
   * @param {string} shopDomain - The shop's domain
   * @param {string} productId - Shopify product ID
   * @returns {boolean} True if product exists
   */
  async validateProduct(shopDomain, productId) {
    try {
      await this.getProduct(shopDomain, productId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get product inventory information for a specific store
   * @param {string} shopDomain - The shop's domain
   * @param {string} productId - Shopify product ID
   * @returns {Object} Inventory data
   */
  async getProductInventory(shopDomain, productId) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const response = await client.get(`/products/${productId}.json`);
      const product = response.data.product;
      
      if (!product.variants || product.variants.length === 0) {
        return { totalInventory: 0, variants: [] };
      }

      const inventory = product.variants.map(variant => ({
        id: variant.id.toString(),
        title: variant.title,
        inventory: variant.inventory_quantity || 0,
        available: variant.available,
        sku: variant.sku,
      }));

      const totalInventory = inventory.reduce((sum, variant) => sum + variant.inventory, 0);

      return {
        totalInventory,
        variants: inventory,
      };
    } catch (error) {
      console.error('Error fetching product inventory:', error.response?.data || error.message);
      throw new Error(`Failed to fetch inventory for product ${productId}`);
    }
  }

  /**
   * Get product suggestions for autocomplete for a specific store
   * @param {string} shopDomain - The shop's domain
   * @param {string} query - Search query
   * @param {number} limit - Number of suggestions
   * @returns {Array} Array of product suggestions
   */
  async getProductSuggestions(shopDomain, query, limit = 20) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      // Fetch all products and filter client-side (same as search)
      const response = await client.get('/products.json', {
        params: {
          limit: 250, // Get more products to search through
          fields: 'id,title,handle,images,variants,vendor,product_type',
        },
      });
      
      const allProducts = response.data.products;
      const searchQuery = query.toLowerCase();
      
      // Filter products based on query
      const filteredProducts = allProducts.filter(product => {
        const title = product.title?.toLowerCase() || '';
        const vendor = product.vendor?.toLowerCase() || '';
        
        return title.includes(searchQuery) || vendor.includes(searchQuery);
      });
      
      // Take only the requested limit
      const limitedProducts = filteredProducts.slice(0, limit);
      
      return limitedProducts.map(product => ({
        id: product.id.toString(),
        title: product.title,
        handle: product.handle,
        price: product.variants?.[0]?.price ? parseFloat(product.variants[0].price) : 0,
        image: product.images?.[0]?.src || null,
        vendor: product.vendor,
        productType: product.product_type,
      }));
    } catch (error) {
      console.error('Error fetching product suggestions:', error.response?.data || error.message);
      throw new Error(`Failed to fetch product suggestions: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Strip HTML tags from product description
   * @param {string} html - HTML string
   * @returns {string} Plain text
   */
  stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Get product by handle (URL-friendly identifier) for a specific store
   * @param {string} shopDomain - The shop's domain
   * @param {string} handle - Product handle
   * @returns {Object} Product data
   */
  async getProductByHandle(shopDomain, handle) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const response = await client.get('/products.json', {
        params: { handle: handle }
      });
      
      const products = response.data.products;
      if (products.length === 0) {
        throw new Error(`Product with handle "${handle}" not found`);
      }
      
      return this.formatProductData(products[0]);
    } catch (error) {
      console.error('Error fetching product by handle:', error.response?.data || error.message);
      throw new Error(`Failed to fetch product by handle: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Get products by vendor
   * @param {string} vendor - Vendor name
   * @param {number} limit - Number of results
   * @returns {Array} Array of products
   */
  async getProductsByVendor(shopDomain, vendor, limit = 50) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const response = await client.get('/products.json', {
        params: {
          vendor: vendor,
          limit: limit,
        },
      });
      
      const products = response.data.products;
      return products.map(product => this.formatProductData(product));
    } catch (error) {
      console.error('Error fetching products by vendor:', error.response?.data || error.message);
      throw new Error(`Failed to fetch products by vendor: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Get products by product type
   * @param {string} productType - Product type
   * @param {number} limit - Number of results
   * @returns {Array} Array of products
   */
  async getProductsByType(shopDomain, productType, limit = 50) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const response = await client.get('/products.json', {
        params: {
          product_type: productType,
          limit: limit,
        },
      });
      
      const products = response.data.products;
      return products.map(product => this.formatProductData(product));
    } catch (error) {
      console.error('Error fetching products by type:', error.response?.data || error.message);
      throw new Error(`Failed to fetch products by type: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Get products with specific tags
   * @param {Array} tags - Array of tags
   * @param {number} limit - Number of results
   * @returns {Array} Array of products
   */
  async getProductsByTags(shopDomain, tags, limit = 50) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const tagQuery = tags.join(',');
      const response = await client.get('/products.json', {
        params: {
          tags: tagQuery,
          limit: limit,
        },
      });
      
      const products = response.data.products;
      return products.map(product => this.formatProductData(product));
    } catch (error) {
      console.error('Error fetching products by tags:', error.response?.data || error.message);
      throw new Error(`Failed to fetch products by tags: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Check if a specific store is properly configured
   * @param {string} shopDomain - The shop's domain
   * @returns {boolean} True if store is installed and configured
   */
  async isStoreConfigured(shopDomain) {
    try {
      const store = await Store.findByDomain(shopDomain);
      return !!(store && store.isInstalled && store.accessToken);
    } catch (error) {
      console.error('Error checking store configuration:', error.message);
      return false;
    }
  }

  /**
   * Get service configuration status for a specific store
   * @param {string} shopDomain - The shop's domain
   * @returns {Object} Configuration status
   */
  async getStoreConfigStatus(shopDomain) {
    try {
      const store = await Store.findByDomain(shopDomain);
      
      if (!store) {
        return {
          configured: false,
          shopDomain: shopDomain,
          hasAccessToken: false,
          isInstalled: false,
          apiVersion: this.apiVersion,
          mockMode: true,
          error: 'Store not found'
        };
      }

      return {
        configured: store.isInstalled && !!store.accessToken,
        shopDomain: store.shopDomain,
        storeName: store.storeName,
        hasAccessToken: !!store.accessToken,
        isInstalled: store.isInstalled,
        apiVersion: this.apiVersion,
        mockMode: !store.isInstalled || !store.accessToken,
        installedAt: store.installedAt,
        lastAccessAt: store.lastAccessAt
      };
    } catch (error) {
      console.error('Error getting store config status:', error.message);
      return {
        configured: false,
        shopDomain: shopDomain,
        hasAccessToken: false,
        isInstalled: false,
        apiVersion: this.apiVersion,
        mockMode: true,
        error: error.message
      };
    }
  }

  /**
   * Test connection to a specific store
   * @param {string} shopDomain - The shop's domain
   * @returns {Object} Test result
   */
  async testStoreConnection(shopDomain) {
    try {
      const { client, store } = await this.getStoreClient(shopDomain);
      
      // Test the connection by fetching shop info
      const response = await client.get('/shop.json');
      const shopInfo = response.data.shop;
      
      return {
        success: true,
        shopDomain: shopDomain,
        storeName: store.storeName,
        shopInfo: {
          name: shopInfo.name,
          domain: shopInfo.domain,
          email: shopInfo.email,
          currency: shopInfo.currency,
          planName: shopInfo.plan_name
        },
        message: 'Connection successful'
      };
    } catch (error) {
      console.error('Error testing store connection:', error.message);
      return {
        success: false,
        shopDomain: shopDomain,
        error: error.message,
        message: 'Connection failed'
      };
    }
  }
}

// Create a singleton instance with lazy initialization
let shopifyServiceInstance = null;

const getShopifyService = () => {
  if (!shopifyServiceInstance) {
    shopifyServiceInstance = new ShopifyService();
  }
  return shopifyServiceInstance;
};

export default getShopifyService;