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
                throw new Error(`GraphQL Error: ${response.data.errors[0].message}`);
            }

            return response.data.data;
        } catch (error) {
            console.error('GraphQL Request Failed:', error.message);
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
            productId: `gid://shopify/Product/${originalProductId}`,
            newTitle: `${winnerData.productTitle} (Auction Winner - ${winnerData.winnerName})`,
            newStatus: 'DRAFT'
        };

        return await this.executeGraphQL(storeDomain, accessToken, query, variables);
    }

    /**
     * Update product variant price for winner
     */
    async updateProductVariantPrice(storeDomain, accessToken, variantId, winningBidAmount) {
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

        return await this.executeGraphQL(storeDomain, accessToken, query, variables);
    }

    /**
     * Create a private product for auction winner
     */
    async createPrivateProductForWinner(storeDomain, accessToken, originalProduct, winnerData, winningBidAmount) {
        // First, duplicate the product
        const duplicateResult = await this.duplicateProductForWinner(storeDomain, accessToken, originalProduct.id, {
            productTitle: originalProduct.title,
            winnerName: winnerData.bidder
        });

        if (duplicateResult.productDuplicate.userErrors.length > 0) {
            throw new Error(`Product duplication failed: ${duplicateResult.productDuplicate.userErrors[0].message}`);
        }

        const newProduct = duplicateResult.productDuplicate.newProduct;

        // Get the duplicated product details to update variant prices
        const productDetails = await this.getProduct(storeDomain, accessToken, newProduct.id.split('/').pop());

        // Update all variant prices to the winning bid amount
        const variantUpdates = productDetails.product.variants.edges.map(async (variantEdge) => {
            return await this.updateProductVariantPrice(
                storeDomain, 
                accessToken, 
                variantEdge.node.id, 
                winningBidAmount
            );
        });

        await Promise.all(variantUpdates);

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
