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
     * Execute GraphQL mutation/query with throttle-aware retry (SVC-07).
     * Retries on HTTP 429/5xx and on GraphQL `THROTTLED` cost errors with exponential
     * backoff, so winner-product creation / variant updates don't fail hard under load.
     */
    async executeGraphQL(storeDomain, accessToken, query, variables = {}, options = {}) {
        const maxAttempts = options.maxAttempts || 4;
        const backoff = (attempt, retryAfterSec) => {
            if (Number.isFinite(retryAfterSec)) return retryAfterSec * 1000;
            return Math.min(2000 * Math.pow(2, attempt - 1), 10000);
        };

        let attempt = 0;
        while (attempt < maxAttempts) {
            attempt++;
            try {
                const response = await axios.post(
                    `https://${storeDomain}/admin/api/2025-10/graphql.json`,
                    { query, variables },
                    {
                        headers: {
                            'X-Shopify-Access-Token': accessToken,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.data.errors) {
                    const errors = response.data.errors;
                    const isThrottled = errors.some(e => e.extensions?.code === 'THROTTLED');
                    if (isThrottled && attempt < maxAttempts) {
                        const delay = backoff(attempt);
                        console.warn(`⏳ Shopify GraphQL throttled, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }

                    console.error('GraphQL Errors:', errors);
                    const firstError = errors[0];
                    const error = new Error(`GraphQL Error: ${firstError.message}`);
                    error.graphqlErrors = errors;
                    error.isPermissionError = firstError.extensions?.code === 'ACCESS_DENIED' ||
                                             firstError.message.includes('ACCESS_DENIED') ||
                                             firstError.message.includes('access scope') ||
                                             firstError.message.includes('permission');
                    throw error;
                }

                return response.data.data;
            } catch (error) {
                // Retry transient transport failures (429 / 5xx)
                const status = error.response?.status;
                const isTransient = status === 429 || (status >= 500 && status < 600);
                if (isTransient && attempt < maxAttempts) {
                    const retryAfter = parseFloat(error.response?.headers?.['retry-after']);
                    const delay = backoff(attempt, retryAfter);
                    console.warn(`⏳ Shopify GraphQL HTTP ${status}, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                console.error('GraphQL Request Failed:', error.message);

                if (error.isPermissionError) {
                    throw error;
                }

                // Surface permission errors from an Axios response body
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
    }

    /**
     * Build a product GID from a numeric id (or pass through an existing gid).
     */
    toProductGid(productId) {
        const value = productId?.toString() || '';
        return value.includes('gid://') ? value : `gid://shopify/Product/${value}`;
    }

    /**
     * Set ALL auction metafields for a product in a single metafieldsSet call.
     * (SVC-06/BACKEND-12: replaces ~20 sequential REST calls — a list + put/post per field —
     * that previously ran on every bid via an HTTP self-call.)
     */
    async setAuctionMetafields(storeDomain, accessToken, productId, auctionData) {
        const ownerId = this.toProductGid(productId);
        const toIso = (v) => (v instanceof Date ? v.toISOString() : v);

        const metafields = [
            { key: 'is_auction', value: 'true', type: 'boolean' },
            { key: 'auction_id', value: auctionData.auctionId.toString(), type: 'single_line_text_field' },
            { key: 'status', value: auctionData.status, type: 'single_line_text_field' },
            { key: 'current_bid', value: (auctionData.currentBid || 0).toString(), type: 'number_decimal' },
            { key: 'starting_bid', value: auctionData.startingBid.toString(), type: 'number_decimal' },
            { key: 'reserve_price', value: (auctionData.reservePrice || 0).toString(), type: 'number_decimal' },
            { key: 'start_time', value: toIso(auctionData.startTime), type: 'date_time' },
            { key: 'end_time', value: toIso(auctionData.endTime), type: 'date_time' },
            { key: 'bid_count', value: (auctionData.bidCount || 0).toString(), type: 'number_integer' },
            { key: 'buy_now_price', value: (auctionData.buyNowPrice || 0).toString(), type: 'number_decimal' }
        ].map(m => ({ ...m, namespace: 'auction', ownerId }));

        return this.writeMetafields(storeDomain, accessToken, metafields);
    }

    /**
     * Mark a product as no longer an auction (single call) — used after soft delete so the
     * storefront widget stops loading it.
     */
    async clearAuctionMetafields(storeDomain, accessToken, productId) {
        const ownerId = this.toProductGid(productId);
        const metafields = [
            { namespace: 'auction', key: 'is_auction', value: 'false', type: 'boolean', ownerId },
            { namespace: 'auction', key: 'status', value: 'deleted', type: 'single_line_text_field', ownerId }
        ];
        return this.writeMetafields(storeDomain, accessToken, metafields);
    }

    /**
     * Internal: run a metafieldsSet mutation and surface userErrors.
     */
    async writeMetafields(storeDomain, accessToken, metafields) {
        const mutation = `
            mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                    metafields { id key namespace }
                    userErrors { field message }
                }
            }`;

        const data = await this.executeGraphQL(storeDomain, accessToken, mutation, { metafields });
        const userErrors = data?.metafieldsSet?.userErrors || [];
        if (userErrors.length > 0) {
            throw new Error(`metafieldsSet userErrors: ${userErrors.map(e => e.message).join('; ')}`);
        }
        return data?.metafieldsSet?.metafields || [];
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
            mutation productDuplicate($productId: ID!, $newTitle: String!, $newStatus: ProductStatus, $includeImages: Boolean) {
                productDuplicate(productId: $productId, newTitle: $newTitle, newStatus: $newStatus, includeImages: $includeImages) {
                    newProduct {
                        id
                        title
                        handle
                        status
                        media(first: 10) {
                            edges {
                                node {
                                    ... on MediaImage {
                                        id
                                        image {
                                            url
                                        }
                                    }
                                }
                            }
                        }
                    }
                    userErrors {
                        field
                        message
                    }
                    imageJob {
                        id
                        done
                    }
                }
            }
        `;

        const variables = {
            productId: originalProductId,
            newTitle: `${winnerData.productTitle} (Auction Winner - ${winnerData.winnerName})`,
            newStatus: 'UNLISTED',
            includeImages: true  // Explicitly include images in duplication
        };

        return await this.executeGraphQL(storeDomain, accessToken, query, variables);
    }

    /**
     * Attach images to a product using productUpdate with media field
     * Uses the original image URLs - Shopify will re-attach the same media files
     * According to Shopify: "Duplicate image" = attach the same media again using the URL
     */
    async attachImagesToProduct(storeDomain, accessToken, productId, originalImageEdges) {
        if (!originalImageEdges || originalImageEdges.length === 0) {
            console.log('ℹ️ No images to attach');
            return { success: true, message: 'No images to attach' };
        }

        // Build media inputs using originalSource URLs (Shopify will re-attach the same files)
        const mediaInputs = originalImageEdges.map(edge => {
            const imageUrl = edge.node.url || edge.node.src;
            const altText = edge.node.altText || '';
            
            if (!imageUrl) {
                console.warn('⚠️ Skipping image without URL');
                return null;
            }
            
            return {
                originalSource: imageUrl,
                alt: altText,
                mediaContentType: 'IMAGE'
            };
        }).filter(Boolean); // Remove any null entries

        if (mediaInputs.length === 0) {
            console.log('ℹ️ No valid image URLs to attach');
            return { success: true, message: 'No valid images to attach' };
        }

        const query = `
            mutation productUpdate($input: ProductInput!) {
                productUpdate(input: $input) {
                    product {
                        id
                        media(first: 10) {
                            edges {
                                node {
                                    ... on MediaImage {
                                        id
                                        image {
                                            url
                                        }
                                    }
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
                media: mediaInputs
            }
        };

        const result = await this.executeGraphQL(storeDomain, accessToken, query, variables);
        
        if (result.productUpdate.userErrors.length > 0) {
            const errorMsg = result.productUpdate.userErrors[0].message;
            throw new Error(`Failed to attach images: ${errorMsg}`);
        }

        console.log(`✅ Successfully attached ${mediaInputs.length} images to product`);
        return { success: true, message: `Attached ${mediaInputs.length} images` };
    }

    /**
     * Copy product images from original to duplicated product (GraphQL)
     * @deprecated Use attachImagesToProduct instead - this method uses deprecated approach
     */
    async copyProductImages(storeDomain, accessToken, productId, originalImages) {
        console.warn('⚠️ copyProductImages is deprecated, use attachImagesToProduct instead');
        return this.attachImagesToProduct(storeDomain, accessToken, productId, originalImages);
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
     * Uses productDuplicate to copy everything (images, metafields, collections, etc.)
     * Then updates variant prices to the winning bid amount
     */
    async createPrivateProductForWinner(storeDomain, accessToken, originalProduct, winnerData, winningBidAmount) {
        // Get the original product ID (handle both GID format and numeric ID)
        const originalProductId = typeof originalProduct === 'string' 
            ? originalProduct 
            : (originalProduct.id || originalProduct);
        
        // Ensure it's in GID format
        const productGid = originalProductId.includes('gid://') 
            ? originalProductId 
            : `gid://shopify/Product/${originalProductId}`;
        
        console.log(`🔄 Duplicating product ${productGid} to copy all fields (images, metafields, collections, etc.)...`);
        
        // Step 1: Use productDuplicate to copy everything (images, metafields, collections, inventory settings, etc.)
        const duplicateResult = await this.duplicateProductForWinner(
            storeDomain, 
            accessToken, 
            productGid, 
            {
                productTitle: typeof originalProduct === 'string' ? 'Product' : (originalProduct.title || 'Product'),
                winnerName: winnerData.bidder || winnerData.winnerName || 'Winner'
            }
        );
        
        if (duplicateResult.productDuplicate.userErrors.length > 0) {
            throw new Error(`Product duplication failed: ${duplicateResult.productDuplicate.userErrors[0].message}`);
        }
        
        const duplicatedProduct = duplicateResult.productDuplicate.newProduct;
        const newProductId = duplicatedProduct.id;
        
        // Check if images were copied (count media in duplicated product)
        // Note: getProduct returns images.edges, but productDuplicate returns media.edges
        const duplicatedMediaCount = duplicatedProduct.media?.edges?.length || 0;
        const originalMediaCount = originalProduct.images?.edges?.length || 0;
        
        console.log(`✅ Product duplicated successfully. Images: ${duplicatedMediaCount} copied (original had ${originalMediaCount})`);
        
        // Step 2: If images weren't copied, manually attach them using original image URLs
        // originalProduct comes from getProduct() which returns images.edges structure
        if (duplicatedMediaCount === 0 && originalMediaCount > 0 && typeof originalProduct === 'object' && originalProduct.images?.edges) {
            console.log(`⚠️ Images were not copied during duplication. Manually attaching ${originalMediaCount} images...`);
            try {
                await this.attachImagesToProduct(storeDomain, accessToken, newProductId, originalProduct.images.edges);
                console.log(`✅ Successfully attached ${originalMediaCount} images to duplicated product`);
            } catch (imageError) {
                console.warn(`⚠️ Failed to manually attach images (non-critical): ${imageError.message}`);
                // Don't throw - product was still created, just without images
            }
        }
        
        console.log(`🔄 Now updating variant prices to $${winningBidAmount}...`);
        
        // Step 3: Get the duplicated product's variants
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
            id: newProductId
        });
        
        const variants = productData.product.variants?.edges || [];
        if (variants.length === 0) {
            throw new Error('Duplicated product has no variants');
        }
        
        // Step 4: Update variant prices to winning bid amount
        const variantUpdates = variants.map(variantEdge => ({
            id: variantEdge.node.id,
            price: winningBidAmount.toString()
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
            productId: newProductId,
            variants: variantUpdates
        });
        
        if (updateVariantsResult.productVariantsBulkUpdate.userErrors.length > 0) {
            throw new Error(`Variant price update failed: ${updateVariantsResult.productVariantsBulkUpdate.userErrors[0].message}`);
        }
        
        console.log(`✅ Variant prices updated to $${winningBidAmount}`);
        
        return {
            productId: duplicatedProduct.id,
            productHandle: duplicatedProduct.handle,
            productTitle: duplicatedProduct.title,
            productUrl: `https://${storeDomain}/products/${duplicatedProduct.handle}`
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
