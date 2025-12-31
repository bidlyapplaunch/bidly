import axios from 'axios';
import Store from '../models/Store.js';
import generateRandomName from '../utils/generateRandomName.js';

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNABORTED',
  'EAI_AGAIN'
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enhanced Shopify Service with OAuth Support
 * This service now works with store-specific access tokens from the OAuth flow
 * Each store has its own token stored in the database
 */
class ShopifyService {
  constructor() {
    this.apiVersion = '2025-10';
    
    console.log('🔧 ShopifyService initialized with OAuth support');
    console.log('  - API Version:', this.apiVersion);
    console.log('  - Mode: Store-specific tokens (OAuth)');
  }

  isRetryableError(error) {
    const status = error?.response?.status;
    if (status === 429) {
      return true;
    }
    if (status >= 500 && status < 600) {
      return true;
    }
    if (error?.code && RETRYABLE_ERROR_CODES.has(error.code)) {
      return true;
    }
    if (error?.message && error.message.toLowerCase().includes('timeout')) {
      return true;
    }
    return false;
  }

  async executeWithRetry(operationName, fn, { maxAttempts = 3, baseDelayMs = 400 } = {}) {
    let attempt = 0;
    let lastError = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;
        if (!this.isRetryableError(error) || attempt >= maxAttempts) {
          throw error;
        }

        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `⚠️ ${operationName} failed on attempt ${attempt}/${maxAttempts} (${error.message}). Retrying in ${delay}ms...`
        );
        await sleep(delay);
      }
    }

    throw lastError;
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
   * Fetch a single product by ID for a specific store (GraphQL)
   * @param {string} shopDomain - The shop's domain
   * @param {string} productId - Shopify product ID
   * @returns {Object} Product data with title, images, and price
   */
  async getProduct(shopDomain, productId) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      // Use GraphQL instead of REST API
      const gql = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            title
            handle
            descriptionHtml
            vendor
            productType
            tags
            status
            createdAt
            updatedAt
            images(first: 10) {
              edges {
                node {
                  id
                  url
                  altText
                  width
                  height
                }
              }
            }
            variants(first: 25) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  sku
                  inventoryQuantity
                  availableForSale
                }
              }
            }
          }
        }
      `;

      const response = await client.post('/graphql.json', {
        query: gql,
        variables: {
          id: `gid://shopify/Product/${productId}`
        }
      });

      if (response.data?.errors) {
        throw new Error(response.data.errors.map(err => err.message).join('; '));
      }

      const productNode = response.data?.data?.product;
      if (!productNode) {
        throw new Error(`Product ${productId} not found`);
      }

      // Normalize GraphQL response to REST-like format for formatProductData
      const normalized = this.normalizeGraphQLProduct(productNode);
      return this.formatProductData(normalized);
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
      const trimmedQuery = (query || '').trim();
      if (!trimmedQuery) {
        return [];
      }
      
      const { client } = await this.getStoreClient(shopDomain);
      console.log(`🔍 Searching for: "${trimmedQuery}" in store: ${shopDomain}`);

      try {
        const graphQLResults = await this.searchProductsGraphQL(client, trimmedQuery, limit);
        if (graphQLResults.length > 0) {
          return graphQLResults;
        }
        console.log('⚠️ GraphQL search returned no matches, falling back to REST pagination.');
      } catch (graphQLError) {
        console.warn('⚠️ GraphQL product search failed:', graphQLError.message);
        throw graphQLError;
      }
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
   * Get all products with pagination for a specific store (GraphQL)
   * @param {string} shopDomain - The shop's domain
   * @param {number} limit - Number of products per page (default: 50)
   * @param {string} pageInfo - Pagination cursor (optional, GraphQL uses "after" parameter)
   * @returns {Object} Object with products array and pagination info
   */
  async getAllProducts(shopDomain, limit = 50, pageInfo = null) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const gql = `
        query GetAllProducts($first: Int!, $after: String) {
          products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
            edges {
              cursor
              node {
                id
                title
                handle
                descriptionHtml
                vendor
                productType
                tags
                status
                createdAt
                updatedAt
                images(first: 10) {
                  edges {
                    node {
                      id
                      url
                      altText
                      width
                      height
                    }
                  }
                }
                variants(first: 25) {
                  edges {
                    node {
                      id
                      title
                      price
                      compareAtPrice
                      sku
                      inventoryQuantity
                      availableForSale
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              endCursor
              startCursor
            }
          }
        }
      `;

      const response = await client.post('/graphql.json', {
        query: gql,
        variables: {
          first: limit,
          after: pageInfo || null
        }
      });

      if (response.data?.errors) {
        throw new Error(response.data.errors.map(err => err.message).join('; '));
      }

      const productEdges = response.data?.data?.products?.edges || [];
      const pageInfoData = response.data?.data?.products?.pageInfo || {};

      const products = productEdges.map(edge => {
        const normalized = this.normalizeGraphQLProduct(edge.node);
        return this.formatProductData(normalized);
      });

      return {
        products,
        pagination: {
          hasNext: pageInfoData.hasNextPage || false,
          hasPrevious: pageInfoData.hasPreviousPage || false,
          nextPageInfo: pageInfoData.endCursor || null,
          previousPageInfo: pageInfoData.startCursor || null
        }
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

  buildGraphQLSearchQuery(rawQuery) {
    const escaped = rawQuery.replace(/"/g, '\\"').trim();
    if (!escaped) {
      return '';
    }
    
    // Match title, description, vendor, product type, and tags
    const wildcardQuery = `*${escaped}*`;
    return `(title:${wildcardQuery} OR body:${wildcardQuery} OR tag:${wildcardQuery} OR vendor:${wildcardQuery} OR product_type:${wildcardQuery})`;
  }

  async searchProductsGraphQL(client, query, limit) {
    const searchQuery = this.buildGraphQLSearchQuery(query);
    if (!searchQuery) {
      return [];
    }

    console.log('🧭 Executing GraphQL product search');
    
    const gql = `
      query SearchProducts($query: String!, $first: Int!, $after: String) {
        products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true, query: $query) {
          edges {
            cursor
            node {
              id
              title
              handle
              descriptionHtml
              vendor
              productType
              tags
              status
              createdAt
              updatedAt
              images(first: 10) {
                edges {
                  node {
                    id
                    url
                    altText
                    width
                    height
                  }
                }
              }
              variants(first: 25) {
                edges {
                  node {
                    id
                    title
                    price
                    compareAtPrice
                    sku
                    inventoryQuantity
                    availableForSale
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const results = [];
    let cursor = null;

    while (results.length < limit) {
      const response = await client.post('/graphql.json', {
        query: gql,
        variables: {
          query: searchQuery,
          first: Math.min(50, limit),
          after: cursor,
        },
      });

      if (response.data?.errors) {
        throw new Error(response.data.errors.map(err => err.message).join('; '));
      }

      const productEdges = response.data?.data?.products?.edges || [];
      productEdges.forEach(edge => {
        if (results.length >= limit) {
          return;
        }
        const normalized = this.normalizeGraphQLProduct(edge.node);
        results.push(this.formatProductData(normalized));
      });

      const pageInfo = response.data?.data?.products?.pageInfo;
      if (pageInfo?.hasNextPage && pageInfo.endCursor) {
        cursor = pageInfo.endCursor;
      } else {
        break;
      }
    }

    console.log(`🧭 GraphQL search returned ${results.length} products`);
    return results;
  }

  normalizeGraphQLProduct(node) {
    const stripGid = gid => {
      if (!gid) return null;
      const parts = gid.split('/');
      return parts[parts.length - 1];
    };

    const images = node.images?.edges?.map(edge => ({
      id: stripGid(edge.node.id),
      src: edge.node.url,
      alt: edge.node.altText || node.title,
      width: edge.node.width,
      height: edge.node.height,
    })) || [];

    const variants = node.variants?.edges?.map(edge => ({
      id: stripGid(edge.node.id),
      title: edge.node.title,
      price: edge.node.price,
      compare_at_price: edge.node.compareAtPrice,
      sku: edge.node.sku,
      inventory_quantity: edge.node.inventoryQuantity,
      available: edge.node.availableForSale,
    })) || [];

    return {
      id: stripGid(node.id),
      title: node.title,
      handle: node.handle,
      body_html: node.descriptionHtml || '',
      vendor: node.vendor,
      product_type: node.productType,
      tags: Array.isArray(node.tags) ? node.tags.join(',') : '',
      status: node.status,
      created_at: node.createdAt,
      updated_at: node.updatedAt,
      images,
      variants,
    };
  }

  filterProductsByQuery(products, query) {
    const searchQuery = query.toLowerCase();
    return products.filter(product => {
      const title = product.title?.toLowerCase() || '';
      const body = product.body_html?.toLowerCase() || '';
      const tags = typeof product.tags === 'string'
        ? product.tags.toLowerCase()
        : Array.isArray(product.tags)
          ? product.tags.join(',').toLowerCase()
          : '';
      const vendor = product.vendor?.toLowerCase() || '';

      const matches = title.includes(searchQuery) ||
        body.includes(searchQuery) ||
        tags.includes(searchQuery) ||
        vendor.includes(searchQuery);

      if (matches) {
        console.log(`✅ Match found: "${product.title}" (vendor: "${product.vendor}")`);
      }

      return matches;
    });
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
   * Get product inventory information for a specific store (GraphQL)
   * @param {string} shopDomain - The shop's domain
   * @param {string} productId - Shopify product ID
   * @returns {Object} Inventory data
   */
  async getProductInventory(shopDomain, productId) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const gql = `
        query GetProductInventory($id: ID!) {
          product(id: $id) {
            id
            variants(first: 25) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                  inventoryQuantity
                  availableForSale
                }
              }
            }
          }
        }
      `;

      const response = await client.post('/graphql.json', {
        query: gql,
        variables: {
          id: `gid://shopify/Product/${productId}`
        }
      });

      if (response.data?.errors) {
        throw new Error(response.data.errors.map(err => err.message).join('; '));
      }

      const productNode = response.data?.data?.product;
      if (!productNode) {
        return { totalInventory: 0, variants: [] };
      }

      const variantEdges = productNode.variants?.edges || [];
      
      if (variantEdges.length === 0) {
        return { totalInventory: 0, variants: [] };
      }

      const stripGid = gid => {
        if (!gid) return null;
        const parts = gid.split('/');
        return parts[parts.length - 1];
      };

      const inventory = variantEdges.map(edge => ({
        id: stripGid(edge.node.id),
        title: edge.node.title,
        inventory: edge.node.inventoryQuantity || 0,
        available: edge.node.availableForSale,
        sku: edge.node.sku,
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
   * Get product suggestions for autocomplete for a specific store (GraphQL)
   * @param {string} shopDomain - The shop's domain
   * @param {string} query - Search query
   * @param {number} limit - Number of suggestions
   * @returns {Array} Array of product suggestions
   */
  async getProductSuggestions(shopDomain, query, limit = 20) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      // Use GraphQL search instead of REST
      const searchQuery = this.buildGraphQLSearchQuery(query);
      if (!searchQuery) {
        return [];
      }

      const gql = `
        query GetProductSuggestions($query: String!, $first: Int!) {
          products(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
            edges {
              node {
                id
                title
                handle
                vendor
                productType
                images(first: 1) {
                  edges {
                    node {
                      url
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      price
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await client.post('/graphql.json', {
        query: gql,
        variables: {
          query: searchQuery,
          first: limit
        }
      });

      if (response.data?.errors) {
        throw new Error(response.data.errors.map(err => err.message).join('; '));
      }

      const productEdges = response.data?.data?.products?.edges || [];
      const stripGid = gid => {
        if (!gid) return null;
        const parts = gid.split('/');
        return parts[parts.length - 1];
      };

      return productEdges.map(edge => ({
        id: stripGid(edge.node.id),
        title: edge.node.title,
        handle: edge.node.handle,
        price: edge.node.variants?.edges?.[0]?.node?.price ? parseFloat(edge.node.variants.edges[0].node.price) : 0,
        image: edge.node.images?.edges?.[0]?.node?.url || null,
        vendor: edge.node.vendor,
        productType: edge.node.productType,
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
   * Get product by handle (URL-friendly identifier) for a specific store (GraphQL)
   * @param {string} shopDomain - The shop's domain
   * @param {string} handle - Product handle
   * @returns {Object} Product data
   */
  async getProductByHandle(shopDomain, handle) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const gql = `
        query GetProductByHandle($handle: String!) {
          productByHandle(handle: $handle) {
            id
            title
            handle
            descriptionHtml
            vendor
            productType
            tags
            status
            createdAt
            updatedAt
            images(first: 10) {
              edges {
                node {
                  id
                  url
                  altText
                  width
                  height
                }
              }
            }
            variants(first: 25) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  sku
                  inventoryQuantity
                  availableForSale
                }
              }
            }
          }
        }
      `;

      const response = await client.post('/graphql.json', {
        query: gql,
        variables: { handle }
      });

      if (response.data?.errors) {
        throw new Error(response.data.errors.map(err => err.message).join('; '));
      }

      const productNode = response.data?.data?.productByHandle;
      if (!productNode) {
        throw new Error(`Product with handle "${handle}" not found`);
      }

      const normalized = this.normalizeGraphQLProduct(productNode);
      return this.formatProductData(normalized);
    } catch (error) {
      console.error('Error fetching product by handle:', error.response?.data || error.message);
      throw new Error(`Failed to fetch product by handle: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Get products by vendor (GraphQL)
   * @param {string} shopDomain - The shop's domain
   * @param {string} vendor - Vendor name
   * @param {number} limit - Number of results
   * @returns {Array} Array of products
   */
  async getProductsByVendor(shopDomain, vendor, limit = 50) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const gql = `
        query GetProductsByVendor($query: String!, $first: Int!) {
          products(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
            edges {
              node {
                id
                title
                handle
                descriptionHtml
                vendor
                productType
                tags
                status
                createdAt
                updatedAt
                images(first: 10) {
                  edges {
                    node {
                      id
                      url
                      altText
                      width
                      height
                    }
                  }
                }
                variants(first: 25) {
                  edges {
                    node {
                      id
                      title
                      price
                      compareAtPrice
                      sku
                      inventoryQuantity
                      availableForSale
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await client.post('/graphql.json', {
        query: gql,
        variables: {
          query: `vendor:'${vendor.replace(/'/g, "\\'")}'`,
          first: limit
        }
      });

      if (response.data?.errors) {
        throw new Error(response.data.errors.map(err => err.message).join('; '));
      }

      const productEdges = response.data?.data?.products?.edges || [];
      return productEdges.map(edge => {
        const normalized = this.normalizeGraphQLProduct(edge.node);
        return this.formatProductData(normalized);
      });
    } catch (error) {
      console.error('Error fetching products by vendor:', error.response?.data || error.message);
      throw new Error(`Failed to fetch products by vendor: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Get products by product type (GraphQL)
   * @param {string} shopDomain - The shop's domain
   * @param {string} productType - Product type
   * @param {number} limit - Number of results
   * @returns {Array} Array of products
   */
  async getProductsByType(shopDomain, productType, limit = 50) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      const gql = `
        query GetProductsByType($query: String!, $first: Int!) {
          products(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
            edges {
              node {
                id
                title
                handle
                descriptionHtml
                vendor
                productType
                tags
                status
                createdAt
                updatedAt
                images(first: 10) {
                  edges {
                    node {
                      id
                      url
                      altText
                      width
                      height
                    }
                  }
                }
                variants(first: 25) {
                  edges {
                    node {
                      id
                      title
                      price
                      compareAtPrice
                      sku
                      inventoryQuantity
                      availableForSale
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await client.post('/graphql.json', {
        query: gql,
        variables: {
          query: `product_type:'${productType.replace(/'/g, "\\'")}'`,
          first: limit
        }
      });

      if (response.data?.errors) {
        throw new Error(response.data.errors.map(err => err.message).join('; '));
      }

      const productEdges = response.data?.data?.products?.edges || [];
      return productEdges.map(edge => {
        const normalized = this.normalizeGraphQLProduct(edge.node);
        return this.formatProductData(normalized);
      });
    } catch (error) {
      console.error('Error fetching products by type:', error.response?.data || error.message);
      throw new Error(`Failed to fetch products by type: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Get products with specific tags (GraphQL)
   * @param {string} shopDomain - The shop's domain
   * @param {Array} tags - Array of tags
   * @param {number} limit - Number of results
   * @returns {Array} Array of products
   */
  async getProductsByTags(shopDomain, tags, limit = 50) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      // Build GraphQL tag query - tag:tag1 OR tag:tag2 OR ...
      const tagQueries = tags.map(tag => `tag:'${tag.replace(/'/g, "\\'")}'`).join(' OR ');
      
      const gql = `
        query GetProductsByTags($query: String!, $first: Int!) {
          products(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
            edges {
              node {
                id
                title
                handle
                descriptionHtml
                vendor
                productType
                tags
                status
                createdAt
                updatedAt
                images(first: 10) {
                  edges {
                    node {
                      id
                      url
                      altText
                      width
                      height
                    }
                  }
                }
                variants(first: 25) {
                  edges {
                    node {
                      id
                      title
                      price
                      compareAtPrice
                      sku
                      inventoryQuantity
                      availableForSale
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await client.post('/graphql.json', {
        query: gql,
        variables: {
          query: tagQueries,
          first: limit
        }
      });

      if (response.data?.errors) {
        throw new Error(response.data.errors.map(err => err.message).join('; '));
      }

      const productEdges = response.data?.data?.products?.edges || [];
      return productEdges.map(edge => {
        const normalized = this.normalizeGraphQLProduct(edge.node);
        return this.formatProductData(normalized);
      });
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

  /**
   * Find or create a Shopify customer by email
   * @param {string} shopDomain - The shop's domain
   * @param {string} email - Customer email
   * @param {string} firstName - Customer first name (optional)
   * @param {string} lastName - Customer last name (optional)
   * @returns {Object} Shopify customer data with ID
   */
  async findOrCreateCustomer(shopDomain, email, firstName = null, lastName = null) {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      
      // First, try to find existing customer by email
      const searchResponse = await client.get('/customers/search.json', {
        params: {
          query: `email:${email}`
        }
      });

      if (searchResponse.data.customers && searchResponse.data.customers.length > 0) {
        console.log(`✅ Found existing customer: ${email}`);
        return searchResponse.data.customers[0];
      }

      const namePayload = buildShopifyCustomerName(firstName, lastName, email);

      // Customer doesn't exist, create a new one
      console.log(`🆕 Creating new customer with alias "${namePayload.firstName}" for: ${email}`);
      const createResponse = await client.post('/customers.json', {
        customer: {
          email: email,
          first_name: namePayload.firstName,
          last_name: namePayload.lastName,
          send_email_welcome: false // Don't send welcome email
        }
      });

      console.log(`✅ Created new customer: ${email}`);
      return createResponse.data.customer;
    } catch (error) {
      console.error('Error finding or creating customer:', error.response?.data || error.message);
      throw new Error(`Failed to find or create customer: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Create a draft order in Shopify
   * @param {string} shopDomain - The shop's domain
   * @param {string} customerId - Shopify customer ID
   * @param {string} productId - Shopify product ID (the duplicated product)
   * @param {number} customPrice - Custom price (the winning bid amount)
   * @param {string} note - Draft order note (optional)
   * @returns {Object} Created draft order data
   */
  async createDraftOrder(shopDomain, customerId, productId, customPrice, note = '', options = {}) {
    const { idempotencyKey = null, maxAttempts = 3 } = options || {};

    const perform = async () => {
      const { client } = await this.getStoreClient(shopDomain);

      // Use GraphQL to get product variants instead of REST
      const gql = `
        query GetProductVariants($id: ID!) {
          product(id: $id) {
            id
            variants(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `;

      const productResponse = await client.post('/graphql.json', {
        query: gql,
        variables: {
          id: `gid://shopify/Product/${productId}`
        }
      });

      if (productResponse.data?.errors) {
        throw new Error(productResponse.data.errors.map(err => err.message).join('; '));
      }

      const productNode = productResponse.data?.data?.product;
      if (!productNode || !productNode.variants?.edges || productNode.variants.edges.length === 0) {
        throw new Error('Product has no variants');
      }

      // Extract variant ID from GID
      const variantGid = productNode.variants.edges[0].node.id;
      const variantId = variantGid.split('/').pop();

      const requestConfig = idempotencyKey
        ? { headers: { 'Idempotency-Key': idempotencyKey } }
        : undefined;

      const draftOrderResponse = await client.post(
        '/draft_orders.json',
        {
          draft_order: {
            line_items: [
              {
                variant_id: variantId,
                quantity: 1,
                price: customPrice.toString()
              }
            ],
            customer: {
              id: customerId
            },
            note: note || 'Generated automatically by Bidly Auction App'
          }
        },
        requestConfig
      );

      console.log(`✅ Draft order created: ${draftOrderResponse.data.draft_order.id}`);
      return draftOrderResponse.data.draft_order;
    };

    try {
      return await this.executeWithRetry('createDraftOrder', perform, { maxAttempts });
    } catch (error) {
      console.error('Error creating draft order:', error.response?.data || error.message);
      throw new Error(`Failed to create draft order: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Send invoice for a draft order
   * @param {string} shopDomain - The shop's domain
   * @param {string} draftOrderId - Draft order ID
   * @param {string} subject - Invoice email subject
   * @param {string} customMessage - Invoice email message body
   * @returns {Object} Invoice send result
   */
  async sendDraftOrderInvoice(shopDomain, draftOrderId, subject, customMessage, options = {}) {
    const { idempotencyKey = null, maxAttempts = 2 } = options || {};

    const perform = async () => {
      const { client } = await this.getStoreClient(shopDomain);

      const requestConfig = idempotencyKey
        ? { headers: { 'Idempotency-Key': idempotencyKey } }
        : undefined;

      const invoiceResponse = await client.post(
        `/draft_orders/${draftOrderId}/send_invoice.json`,
        {
          draft_order_invoice: {
            to: null,
            subject: subject,
            custom_message: customMessage
          }
        },
        requestConfig
      );

      console.log(`✅ Invoice sent for draft order: ${draftOrderId}`);
      return invoiceResponse.data;
    };

    try {
      return await this.executeWithRetry('sendDraftOrderInvoice', perform, { maxAttempts });
    } catch (error) {
      console.error('Error sending draft order invoice:', error.response?.data || error.message);
      throw new Error(`Failed to send draft order invoice: ${error.response?.data?.errors || error.message}`);
    }
  }

  /**
   * Determine if the Bidly app embed is enabled for the current theme
   * @param {string} shopDomain - The shop's domain
   * @param {string} handle - The app embed handle to check
   * @returns {boolean} Whether the app embed is currently active
   */
  async isAppEmbedEnabled(shopDomain, handle = 'bidly-auction-widget') {
    try {
      const { client } = await this.getStoreClient(shopDomain);
      const query = `
        query ActiveAppEmbeds {
          currentAppInstallation {
            activeAppEmbeds {
              handle
              title
            }
          }
        }
      `;

      const response = await client.post('/graphql.json', { query });
      const embeds = response.data?.data?.currentAppInstallation?.activeAppEmbeds || [];

      const isActive = embeds.some((embed) => embed.handle === handle);
      console.log(`🔍 App embed "${handle}" active:`, isActive);
      return { active: isActive };
    } catch (error) {
      let errorMessage = error.message;
      if (error.response?.data?.errors) {
        errorMessage = error.response.data.errors.map((err) => err.message).join('; ');
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      console.error('Error checking app embed status:', error.response?.data || error.message);
      return {
        active: false,
        error: errorMessage
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

function buildShopifyCustomerName(firstName, lastName, email) {
  const trimmedFirst = typeof firstName === 'string' ? firstName.trim() : '';
  const trimmedLast = typeof lastName === 'string' ? lastName.trim() : '';
  const hasValidFirst = trimmedFirst && trimmedFirst.toLowerCase() !== 'undefined';
  const hasValidLast =
    trimmedLast &&
    trimmedLast.toLowerCase() !== 'undefined' &&
    trimmedLast.toLowerCase() !== 'customer';

  if (!hasValidFirst) {
    const alias = generateRandomName();
    return {
      firstName: alias,
      lastName: hasValidLast ? trimmedLast : ''
    };
  }

  return {
    firstName: trimmedFirst,
    lastName: hasValidLast ? trimmedLast : ''
  };
}