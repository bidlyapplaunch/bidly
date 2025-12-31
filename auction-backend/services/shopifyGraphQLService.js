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
     * Uses the new API structure: create product first, then add variants and images separately
     */
    async createProductManually(storeDomain, accessToken, originalProduct, winnerData, winningBidAmount) {
        // Step 1: Create the product without variants and images
        const createQuery = `
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

        const createVariables = {
            input: {
                title: `${originalProduct.title} (Auction Winner - ${winnerData.bidder})`,
                descriptionHtml: originalProduct.description || '',
                status: 'UNLISTED',
                productType: originalProduct.productType || '',
                vendor: originalProduct.vendor || '',
                tags: [...(originalProduct.tags || []), 'auction-winner']
            }
        };

        const createResult = await this.executeGraphQL(storeDomain, accessToken, createQuery, createVariables);

        if (createResult.productCreate.userErrors.length > 0) {
            throw new Error(`Product creation failed: ${createResult.productCreate.userErrors[0].message}`);
        }

        const newProduct = createResult.productCreate.product;
        const productId = newProduct.id;

        // Step 2: Update variant prices to winning bid amount
        // productCreate automatically creates a default variant, so we update its price
        // First, get the product with its variants
        const getProductQuery = `
            query getProduct($id: ID!) {
                product(id: $id) {
                    id
                    variants(first: 10) {
                        edges {
                            node {
                                id
                                price
                                title
                            }
                        }
                    }
                }
            }
        `;

        const productData = await this.executeGraphQL(storeDomain, accessToken, getProductQuery, {
            id: productId
        });

        const variants = productData.product.variants?.edges || [];
        if (variants.length === 0) {
            throw new Error('Product created but no variants found');
        }

        // Update variant prices using productVariantsBulkUpdate
        // productVariantUpdate is deprecated - use productVariantsBulkUpdate even for single variants
        const variantUpdates = variants.map(variantEdge => ({
            id: variantEdge.node.id,
            price: winningBidAmount.toString(),
            inventoryPolicy: 'DENY'
        }));

        const updateVariantsQuery = `
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                    productVariants {
                        id
                        price
                        title
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const updateVariantsResult = await this.executeGraphQL(storeDomain, accessToken, updateVariantsQuery, {
            productId: productId,
            variants: variantUpdates
        });

        if (updateVariantsResult.productVariantsBulkUpdate.userErrors.length > 0) {
            throw new Error(`Variant price update failed: ${updateVariantsResult.productVariantsBulkUpdate.userErrors[0].message}`);
        }

        // Step 3: Add images using fileCreate + productUpdate
        // According to Shopify docs: https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media
        // Files are processed asynchronously - must poll for fileStatus: READY before associating
        const images = originalProduct.images?.edges || [];
        if (images.length > 0) {
            const mediaIds = [];
            
            // Create file records for each image using fileCreate
            for (const edge of images) {
                try {
                    const fileCreateQuery = `
                        mutation fileCreate($files: [FileCreateInput!]!) {
                            fileCreate(files: $files) {
                                files {
                                    id
                                    fileStatus
                                    alt
                                }
                                userErrors {
                                    field
                                    message
                                }
                            }
                        }
                    `;

                    const fileCreateResult = await this.executeGraphQL(storeDomain, accessToken, fileCreateQuery, {
                        files: [{
                            originalSource: edge.node.url,
                            alt: edge.node.altText || originalProduct.title,
                            contentType: 'IMAGE'
                        }]
                    });

                    if (fileCreateResult.fileCreate.userErrors.length > 0) {
                        console.warn(`⚠️ Failed to create file for image: ${fileCreateResult.fileCreate.userErrors[0].message}`);
                        continue;
                    }

                    if (fileCreateResult.fileCreate.files.length === 0) {
                        console.warn(`⚠️ No file returned from fileCreate for image: ${edge.node.url}`);
                        continue;
                    }

                    const fileId = fileCreateResult.fileCreate.files[0].id;
                    const fileStatus = fileCreateResult.fileCreate.files[0].fileStatus;

                    // Poll for file readiness (files are processed asynchronously)
                    // According to docs: https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media#step-2-poll-for-file-readiness
                    let isReady = fileStatus === 'READY';
                    let pollAttempts = 0;
                    const maxPollAttempts = 10; // Poll up to 10 times (10 seconds max)
                    
                    while (!isReady && pollAttempts < maxPollAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                        
                        const fileStatusQuery = `
                            query getFileStatus($id: ID!) {
                                node(id: $id) {
                                    ... on MediaImage {
                                        fileStatus
                                    }
                                }
                            }
                        `;

                        try {
                            const statusResult = await this.executeGraphQL(storeDomain, accessToken, fileStatusQuery, {
                                id: fileId
                            });
                            
                            if (statusResult.node?.fileStatus === 'READY') {
                                isReady = true;
                            } else if (statusResult.node?.fileStatus === 'FAILED') {
                                console.warn(`⚠️ File processing failed for ${edge.node.url}`);
                                break;
                            }
                        } catch (statusError) {
                            console.warn(`⚠️ Error checking file status: ${statusError.message}`);
                            break;
                        }
                        
                        pollAttempts++;
                    }

                    if (isReady) {
                        mediaIds.push(fileId);
                        console.log(`✅ File ready: ${fileId}`);
                    } else {
                        console.warn(`⚠️ File not ready after ${maxPollAttempts} attempts: ${fileId}`);
                    }
                } catch (fileError) {
                    console.warn(`⚠️ Error creating file for image ${edge.node.url}:`, fileError.message);
                }
            }

            // Associate ready files with product using productUpdate
            // According to docs: https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media#step-3-add-media-to-products
            if (mediaIds.length > 0) {
                const productUpdateQuery = `
                    mutation productUpdate($input: ProductInput!) {
                        productUpdate(input: $input) {
                            product {
                                id
                                media(first: 10) {
                                    edges {
                                        node {
                                            id
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

                const productUpdateResult = await this.executeGraphQL(storeDomain, accessToken, productUpdateQuery, {
                    input: {
                        id: productId,
                        media: mediaIds
                    }
                });

                if (productUpdateResult.productUpdate.userErrors.length > 0) {
                    console.warn(`⚠️ Failed to associate images with product: ${productUpdateResult.productUpdate.userErrors[0].message}`);
                } else {
                    console.log(`✅ Associated ${mediaIds.length} images with product`);
                }
            } else {
                console.warn(`⚠️ No files were ready to associate with product`);
            }
        }

        return newProduct;
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
        // productVariantUpdate is deprecated - use productVariantsBulkUpdate
        const variantUpdatesInput = variants.map(variantEdge => ({
            id: variantEdge.node.id, // Keep as GID
            price: winningBidAmount.toString()
        }));

        try {
            const query = `
                mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                        productVariants {
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
                productId: productId,
                variants: variantUpdatesInput
            };

            const result = await this.executeGraphQL(storeDomain, accessToken, query, variables);
            
            if (result.productVariantsBulkUpdate.userErrors.length > 0) {
                const errorMsg = result.productVariantsBulkUpdate.userErrors[0].message;
                console.error(`Failed to update variants:`, errorMsg);
                // Return error for all variants
                return {
                    variantUpdates: variantUpdatesInput.map(v => ({
                        id: v.id,
                        success: false,
                        error: errorMsg
                    }))
                };
            } else {
                // All variants updated successfully
                return {
                    variantUpdates: variantUpdatesInput.map(v => ({
                        id: v.id,
                        success: true
                    }))
                };
            }
        } catch (error) {
            console.error(`Failed to update variants:`, error.message);
            return {
                variantUpdates: variantUpdatesInput.map(v => ({
                    id: v.id,
                    success: false,
                    error: error.message
                }))
            };
        }
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
