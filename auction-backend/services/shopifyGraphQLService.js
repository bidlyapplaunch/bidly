import axios from 'axios';

/**
 * Shopify GraphQL Service
 * Handles product duplication, creation, and inventory management
 */
class ShopifyGraphQLService {
    constructor() {
        this.baseUrl = 'https://api.shopify.com/admin/api/2025-10/graphql.json';
    }

    /**
     * Execute GraphQL mutation/query
     */
    async executeGraphQL(storeDomain, accessToken, query, variables = {}) {
        try {
            const response = await axios.post(
                `https://${storeDomain}/admin/api/2025-10/graphql.json`,
                {
                    query,
                    variables
                },
                {
                    headers: {
                        'X-Shopify-Access-Token': accessToken,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.errors) {
                console.error('GraphQL Errors:', response.data.errors);
                const firstError = response.data.errors[0];
                
                // Create error with more details for permission errors
                const error = new Error(`GraphQL Error: ${firstError.message}`);
                error.graphqlErrors = response.data.errors;
                error.isPermissionError = firstError.extensions?.code === 'ACCESS_DENIED' || 
                                         firstError.message.includes('ACCESS_DENIED') ||
                                         firstError.message.includes('access scope') ||
                                         firstError.message.includes('permission');
                
                throw error;
            }

            return response.data.data;
        } catch (error) {
            console.error('GraphQL Request Failed:', error.message);
            
            // Preserve permission error flag if it exists
            if (error.isPermissionError) {
                throw error;
            }
            
            // Check if it's a permission error from Axios response
            if (error.response?.data?.errors) {
                const firstError = error.response.data.errors[0];
                if (firstError.extensions?.code === 'ACCESS_DENIED' || 
                    firstError.message?.includes('ACCESS_DENIED') ||
                    firstError.message?.includes('access scope') ||
                    firstError.message?.includes('permission')) {
                    error.isPermissionError = true;
                    error.graphqlErrors = error.response.data.errors;
                }
            }
            
            throw error;
        }
    }

    /**
     * Get product by ID
     */
    async getProduct(storeDomain, accessToken, productId) {
        const query = `
            query getProduct($id: ID!) {
                product(id: $id) {
                    id
                    title
                    description
                    handle
                    status
                    productType
                    vendor
                    tags
                    images(first: 10) {
                        edges {
                            node {
                                id
                                url
                                altText
                            }
                        }
                    }
                    variants(first: 10) {
                        edges {
                            node {
                                id
                                title
                                price
                                sku
                                inventoryQuantity
                                inventoryPolicy
                            }
                        }
                    }
                }
            }
        `;

        return await this.executeGraphQL(storeDomain, accessToken, query, {
            id: `gid://shopify/Product/${productId}`
        });
    }

    /**
     * Create a product manually (fallback when duplication fails)
     */
    async createProductManually(storeDomain, accessToken, originalProduct, winnerData, winningBidAmount) {
        const query = `
            mutation productCreate($input: ProductInput!) {
                productCreate(input: $input) {
                    product {
                        id
                        title
                        handle
                        status
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        // Get images from original product
        const imageInputs = originalProduct.images?.edges?.map(edge => ({
            src: edge.node.url,
            altText: edge.node.altText || originalProduct.title
        })) || [];

        // Create variants with winning bid price
        const variantInputs = originalProduct.variants?.edges?.map(edge => ({
            price: winningBidAmount.toString(),
            title: edge.node.title || 'Default Title',
            sku: edge.node.sku || `auction-winner-${Date.now()}`,
            inventoryPolicy: 'DENY',
            inventoryManagement: null // No inventory tracking for auction winner products
        })) || [{
            price: winningBidAmount.toString(),
            title: 'Default Title',
            inventoryPolicy: 'DENY',
            inventoryManagement: null
        }];

        const variables = {
            input: {
                title: `${originalProduct.title} (Auction Winner - ${winnerData.bidder})`,
                descriptionHtml: originalProduct.description || '',
                status: 'UNLISTED',
                productType: originalProduct.productType || '',
                vendor: originalProduct.vendor || '',
                tags: [...(originalProduct.tags || []), 'auction-winner'],
                images: imageInputs,
                variants: variantInputs
            }
        };

        const result = await this.executeGraphQL(storeDomain, accessToken, query, variables);

        if (result.productCreate.userErrors.length > 0) {
            throw new Error(`Product creation failed: ${result.productCreate.userErrors[0].message}`);
        }

        return result.productCreate.product;
    }

    /**
     * Duplicate product for auction winner
     */
    async duplicateProductForWinner(storeDomain, accessToken, originalProductId, winnerData) {
        const query = `
            mutation productDuplicate($productId: ID!, $newTitle: String!, $newStatus: ProductStatus) {
                productDuplicate(productId: $productId, newTitle: $newTitle, newStatus: $newStatus) {
                    newProduct {
                        id
                        title
                        handle
                        status
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const variables = {
            productId: originalProductId,
            newTitle: `${winnerData.productTitle} (Auction Winner - ${winnerData.winnerName})`,
            newStatus: 'UNLISTED'
        };

        return await this.executeGraphQL(storeDomain, accessToken, query, variables);
    }

    /**
     * Copy product images from original to duplicated product (GraphQL)
     * Note: Product duplication should preserve images automatically, but this method
     * can be used if needed. However, updating product images via GraphQL is complex
     * and may require using Files API. For now, we'll skip this as duplication preserves images.
     */
    async copyProductImages(storeDomain, accessToken, productId, originalImages) {
        try {
            if (!originalImages || originalImages.length === 0) {
                console.log('ℹ️ No original images to copy');
                return { success: true, message: 'No images to copy' };
            }

            // Build image inputs for productUpdate mutation
            const imageInputs = originalImages.map(edge => ({
                src: edge.node.url,
                altText: edge.node.altText || ''
            }));

            const query = `
                mutation productUpdate($input: ProductInput!) {
                    productUpdate(input: $input) {
                        product {
                            id
                            images(first: 10) {
                                edges {
                                    node {
                                        id
                                        url
                                    }
                                }
                            }
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            `;

            const variables = {
                input: {
                    id: productId,
                    images: imageInputs
                }
            };

            const result = await this.executeGraphQL(storeDomain, accessToken, query, variables);
            
            if (result.productUpdate.userErrors.length > 0) {
                const errorMsg = result.productUpdate.userErrors[0].message;
                console.error('Failed to copy images:', errorMsg);
                return { success: false, error: errorMsg };
            }

            console.log(`✅ Successfully copied ${imageInputs.length} images to duplicated product`);
            return { success: true, message: `Copied ${imageInputs.length} images` };
        } catch (error) {
            console.warn('Error copying images:', error.message);
            // Don't throw - this is non-critical, product was still created
            return { success: false, error: error.message };
        }
    }

    /**
     * Update product variant prices for winner using GraphQL
     */
    async updateProductVariantPrices(storeDomain, accessToken, productId, variants, winningBidAmount) {
        console.log('🔄 Using GraphQL to update variant prices');
        const variantUpdates = [];
        
        // Use GraphQL productVariantUpdate mutation for each variant
        for (const variantEdge of variants) {
            const variantId = variantEdge.node.id; // Keep as GID
            try {
                const query = `
                    mutation productVariantUpdate($input: ProductVariantInput!) {
                        productVariantUpdate(input: $input) {
                            productVariant {
                                id
                                price
                            }
                            userErrors {
                                field
                                message
                            }
                        }
                    }
                `;

                const variables = {
                    input: {
                        id: variantId,
                        price: winningBidAmount.toString()
                    }
                };

                const result = await this.executeGraphQL(storeDomain, accessToken, query, variables);
                
                if (result.productVariantUpdate.userErrors.length > 0) {
                    const errorMsg = result.productVariantUpdate.userErrors[0].message;
                    console.error(`Failed to update variant ${variantId}:`, errorMsg);
                    variantUpdates.push({ id: variantId, success: false, error: errorMsg });
                } else {
                    variantUpdates.push({ id: variantId, success: true });
                }
            } catch (error) {
                console.error(`Failed to update variant ${variantId}:`, error.message);
                variantUpdates.push({ id: variantId, success: false, error: error.message });
            }
        }
        
        return { variantUpdates };
    }

    /**
     * Update product variant price for winner
     */
    async updateProductVariantPrice(storeDomain, accessToken, variantId, winningBidAmount) {
        // This method is deprecated - use updateProductVariantPrices instead
        // Keeping for backward compatibility but it won't work with current API
        throw new Error('updateProductVariantPrice is deprecated. Use updateProductVariantPrices instead.');
    }

    /**
     * Create a private product for auction winner
     */
    async createPrivateProductForWinner(storeDomain, accessToken, originalProduct, winnerData, winningBidAmount) {
        // Use manual product creation instead of duplication
        // This ensures prices and images are set correctly from the start
        // productDuplicate preserves original prices and may have issues with images
        console.log(`🔄 Creating product manually with correct price $${winningBidAmount} from the start...`);
        
        // Ensure we have full product data
        let fullProduct = originalProduct;
        if (!fullProduct.title || !fullProduct.variants || !fullProduct.images) {
            console.log('⚠️ Fetching full product details for manual creation...');
            const productId = typeof originalProduct === 'string' ? originalProduct : originalProduct.id.split('/').pop();
            const productData = await this.getProduct(storeDomain, accessToken, productId);
            fullProduct = productData.product;
        }

        // Create product manually with winning bid price and images set correctly
        const newProduct = await this.createProductManually(storeDomain, accessToken, fullProduct, winnerData, winningBidAmount);

        return {
            productId: newProduct.id,
            productHandle: newProduct.handle,
            productTitle: newProduct.title,
            productUrl: `https://${storeDomain}/products/${newProduct.handle}`
        };
    }

    /**
     * Update inventory for a product variant
     */
    async updateInventory(storeDomain, accessToken, variantId, quantity) {
        const query = `
            mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                inventoryAdjustQuantities(input: $input) {
                    inventoryAdjustmentGroup {
                        id
                        reason
                        referenceDocumentUri
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const variables = {
            input: {
                reason: 'correction',
                referenceDocumentUri: 'bidly-auction-winner',
                adjustments: [
                    {
                        inventoryItemId: variantId,
                        delta: quantity
                    }
                ]
            }
        };

        return await this.executeGraphQL(storeDomain, accessToken, query, variables);
    }

    /**
     * Get inventory levels for a product
     */
    async getInventoryLevels(storeDomain, accessToken, productId) {
        const query = `
            query getProductInventory($id: ID!) {
                product(id: $id) {
                    variants(first: 10) {
                        edges {
                            node {
                                id
                                inventoryQuantity
                                inventoryItem {
                                    id
                                    inventoryLevels(first: 10) {
                                        edges {
                                            node {
                                                id
                                                available
                                                location {
                                                    id
                                                    name
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        return await this.executeGraphQL(storeDomain, accessToken, query, {
            id: `gid://shopify/Product/${productId}`
        });
    }
}

export default new ShopifyGraphQLService();
