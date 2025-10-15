import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const limit = url.searchParams.get('limit') || '20';
  
  try {
    // Use Shopify GraphQL API directly
    const response = await admin.graphql(`
      query getProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              status
              createdAt
              updatedAt
              variants(first: 1) {
                edges {
                  node {
                    id
                    title
                    price
                    availableForSale
                  }
                }
              }
            }
          }
        }
      }
    `, {
      variables: { first: parseInt(limit) }
    });

    const responseJson = await response.json();
    
    if (responseJson.errors) {
      console.error('GraphQL errors:', responseJson.errors);
      throw new Error('GraphQL query failed');
    }

    // Transform the data to match expected format
    const products = responseJson.data.products.edges.map(edge => ({
      id: edge.node.id.replace('gid://shopify/Product/', ''),
      title: edge.node.title,
      handle: edge.node.handle,
      status: edge.node.status,
      createdAt: edge.node.createdAt,
      updatedAt: edge.node.updatedAt,
      price: edge.node.variants.edges[0]?.node.price || '0.00',
      availableForSale: edge.node.variants.edges[0]?.node.availableForSale || false
    }));

    return new Response(JSON.stringify(products), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch Shopify products' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
