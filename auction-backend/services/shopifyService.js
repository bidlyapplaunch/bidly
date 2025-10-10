import axios from 'axios';

class ShopifyService {
  constructor() {
    this.shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = '2024-10';
    
    console.log('🔧 ShopifyService Debug:');
    console.log('  - shopDomain:', this.shopDomain);
    console.log('  - accessToken:', this.accessToken ? 'Present' : 'Missing');
    console.log('  - apiVersion:', this.apiVersion);
    
    if (!this.shopDomain || !this.accessToken) {
      console.warn('❌ Shopify credentials not configured. Product data fetching will be disabled.');
      this.client = null;
    } else {
      console.log('✅ Shopify credentials found, creating API client...');
      this.client = axios.create({
        baseURL: `https://${this.shopDomain}/admin/api/${this.apiVersion}`,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
      });
      console.log('✅ Shopify API client created');
    }
  }

  /**
   * Fetch a single product by ID
   * @param {string} productId - Shopify product ID
   * @returns {Object} Product data with title, images, and price
   */
  async getProduct(productId) {
    if (!this.client) {
      throw new Error('Shopify service not configured');
    }
    
    try {
      const response = await this.client.get(`/products/${productId}.json`);
      const product = response.data.product;
      
      return this.formatProductData(product);
    } catch (error) {
      console.error('Error fetching product:', error.response?.data || error.message);
      throw new Error(`Failed to fetch product ${productId}: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Fetch multiple products by IDs
   * @param {Array} productIds - Array of Shopify product IDs
   * @returns {Array} Array of formatted product data
   */
  async getProducts(productIds) {
    try {
      const promises = productIds.map(id => this.getProduct(id));
      const products = await Promise.all(promises);
      return products;
    } catch (error) {
      console.error('Error fetching products:', error.message);
      throw error;
    }
  }

  /**
   * Search products by title or handle
   * @param {string} query - Search query
   * @param {number} limit - Number of results to return (default: 10)
   * @returns {Array} Array of matching products
   */
  async searchProducts(query, limit = 10) {
    if (!this.client) {
      console.log('Shopify service not configured, returning mock data for:', query);
      // Return mock data for development
      return this.getMockProducts(query, limit);
    }

    try {
      // Shopify REST API doesn't support text search directly
      // We need to fetch products and filter them client-side
      console.log(`🔍 Searching for: "${query}"`);
      
      const response = await this.client.get('/products.json', {
        params: {
          limit: 250, // Get more products to search through
        },
      });
      
      const allProducts = response.data.products;
      console.log(`📦 Found ${allProducts.length} total products`);
      
      // Filter products based on query
      const searchQuery = query.toLowerCase();
      const filteredProducts = allProducts.filter(product => {
        const title = product.title?.toLowerCase() || '';
        const body = product.body_html?.toLowerCase() || '';
        const tags = product.tags?.toLowerCase() || '';
        const vendor = product.vendor?.toLowerCase() || '';
        
        return title.includes(searchQuery) || 
               body.includes(searchQuery) || 
               tags.includes(searchQuery) || 
               vendor.includes(searchQuery);
      });
      
      console.log(`✅ Found ${filteredProducts.length} matching products`);
      
      // Take only the requested limit
      const limitedProducts = filteredProducts.slice(0, limit);
      return limitedProducts.map(product => this.formatProductData(product));
    } catch (error) {
      console.error('Error searching products:', error.response?.data || error.message);
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
   * Get all products with pagination
   * @param {number} limit - Number of products per page (default: 50)
   * @param {string} pageInfo - Pagination cursor (optional)
   * @returns {Object} Object with products array and pagination info
   */
  async getAllProducts(limit = 50, pageInfo = null) {
    try {
      const params = { limit };
      if (pageInfo) {
        params.page_info = pageInfo;
      }

      const response = await this.client.get('/products.json', { params });
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
   * Validate if a product ID exists in Shopify
   * @param {string} productId - Shopify product ID
   * @returns {boolean} True if product exists
   */
  async validateProduct(productId) {
    try {
      await this.getProduct(productId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get product inventory information
   * @param {string} productId - Shopify product ID
   * @returns {Object} Inventory data
   */
  async getProductInventory(productId) {
    try {
      const response = await this.client.get(`/products/${productId}.json`);
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
   * Get product suggestions for autocomplete
   * @param {string} query - Search query
   * @param {number} limit - Number of suggestions
   * @returns {Array} Array of product suggestions
   */
  async getProductSuggestions(query, limit = 20) {
    try {
      const response = await this.client.get('/products.json', {
        params: {
          title: query,
          limit: limit,
          fields: 'id,title,handle,images,variants,vendor,product_type',
        },
      });
      
      const products = response.data.products;
      return products.map(product => ({
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
   * Get product by handle (URL-friendly identifier)
   * @param {string} handle - Product handle
   * @returns {Object} Product data
   */
  async getProductByHandle(handle) {
    try {
      const response = await this.client.get('/products.json', {
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
  async getProductsByVendor(vendor, limit = 50) {
    try {
      const response = await this.client.get('/products.json', {
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
  async getProductsByType(productType, limit = 50) {
    try {
      const response = await this.client.get('/products.json', {
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
  async getProductsByTags(tags, limit = 50) {
    try {
      const tagQuery = tags.join(',');
      const response = await this.client.get('/products.json', {
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
   * Check if Shopify service is properly configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return !!(this.shopDomain && this.accessToken);
  }

  /**
   * Get service configuration status
   * @returns {Object} Configuration status
   */
  getConfigStatus() {
    return {
      configured: this.isConfigured(),
      shopDomain: this.shopDomain || 'mock-shop.myshopify.com',
      hasAccessToken: !!this.accessToken,
      apiVersion: this.apiVersion,
      mockMode: !this.isConfigured(),
    };
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