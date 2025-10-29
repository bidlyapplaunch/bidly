import axios from 'axios';

/**
 * Shopify GraphQL Service
 * Handles product duplication, creation, and inventory management
 */
class ShopifyGraphQLService {
    constructor() {
        this.baseUrl = 'https://api.shopify.com/admin/api/2024-01/graphql.json';
    }

    /**
     * Execute GraphQL mutation/query
     */
    async executeGraphQL(storeDomain, accessToken, query, variables = {}) {
        try {
            const response = await axios.post(
                `https://${storeDomain}/admin/api/2024-01/graphql.json`,
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
                status: 'DRAFT',
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
            newStatus: 'DRAFT'
        };

        return await this.executeGraphQL(storeDomain, accessToken, query, variables);
    }

    /**
     * Update product variant prices for winner using REST API (more reliable)
     * Version 2.0 - Fixed GraphQL mutation issue
     */
    async updateProductVariantPrices(storeDomain, accessToken, productId, variants, winningBidAmount) {
        console.log('🔄 Using REST API to update variant prices (Version 2.0)');
        // Use REST API to update variant prices
        const variantUpdates = [];
        
        for (const variantEdge of variants) {
            const variantId = variantEdge.node.id.split('/').pop();
            try {
                const response = await axios.put(
                    `https://${storeDomain}/admin/api/2024-01/variants/${variantId}.json`,
                    {
                        variant: {
                            price: winningBidAmount.toString()
                        }
                    },
                    {
                        headers: {
                            'X-Shopify-Access-Token': accessToken,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                variantUpdates.push({ id: variantId, success: true });
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
        let newProduct;

        try {
            // First, try to duplicate the product
            const duplicateResult = await this.duplicateProductForWinner(storeDomain, accessToken, originalProduct.id, {
                productTitle: originalProduct.title,
                winnerName: winnerData.bidder
            });

            if (duplicateResult.productDuplicate.userErrors.length > 0) {
                throw new Error(`Product duplication failed: ${duplicateResult.productDuplicate.userErrors[0].message}`);
            }

            newProduct = duplicateResult.productDuplicate.newProduct;

            // Get the duplicated product details to update variant prices
            const productDetails = await this.getProduct(storeDomain, accessToken, newProduct.id.split('/').pop());

            // Update all variant prices to the winning bid amount using productUpdate
            if (productDetails.product.variants.edges.length > 0) {
                try {
                    await this.updateProductVariantPrices(
                        storeDomain, 
                        accessToken, 
                        newProduct.id,
                        productDetails.product.variants.edges,
                        winningBidAmount
                    );
                    console.log('✅ Variant prices updated successfully');
                } catch (variantError) {
                    console.warn('⚠️ Failed to update variant prices, but product was created:', variantError.message);
                    // Continue anyway - product was created successfully
                }
            }
        } catch (error) {
            // If duplication fails due to permissions, fallback to manual creation
            if (error.isPermissionError || error.message.includes('ACCESS_DENIED') || error.message.includes('write_products') || error.message.includes('permission')) {
                console.log('⚠️ Product duplication failed due to permissions, falling back to manual creation...');
                
                // originalProduct should already be a full product object from getProduct
                // But if it's missing title or other fields, fetch it again
                let fullProduct = originalProduct;
                if (!fullProduct.title || !fullProduct.variants) {
                    console.log('⚠️ Fetching full product details for manual creation...');
                    const productId = typeof originalProduct === 'string' ? originalProduct : originalProduct.id.split('/').pop();
                    const productData = await this.getProduct(storeDomain, accessToken, productId);
                    fullProduct = productData.product;
                }

                // Create product manually with winning bid price already set
                newProduct = await this.createProductManually(storeDomain, accessToken, fullProduct, winnerData, winningBidAmount);
            } else {
                // Re-throw if it's a different error
                throw error;
            }
        }

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
