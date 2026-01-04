import { authenticate } from "../shopify.server";

const BACKEND_URL = process.env.AUCTION_BACKEND_URL || "https://bidly-backend.hiiiiiiiiiii.com";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const auctionId = params.id;
  
  if (!auctionId) {
    return new Response(JSON.stringify({ error: 'Auction ID is required' }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  try {
    const backendUrl = new URL(`${BACKEND_URL}/api/auctions/${auctionId}`);
    backendUrl.searchParams.set('shop', shopDomain);
    
    // DO NOT forward Authorization header - backend trusts x-shopify-shop-domain only
    const response = await fetch(backendUrl.toString(), {
      headers: {
        'Content-Type': 'application/json',
        'x-shopify-shop-domain': shopDomain
        // Explicitly NOT forwarding Authorization header
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Backend responded with ${response.status}` }));
      return new Response(JSON.stringify(errorData), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error('Error fetching auction:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch auction' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const auctionId = params.id;
  const method = request.method;
  
  if (!auctionId) {
    return new Response(JSON.stringify({ error: 'Auction ID is required' }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  try {
    const backendUrl = new URL(`${BACKEND_URL}/api/auctions/${auctionId}`);
    backendUrl.searchParams.set('shop', shopDomain);
    
    const body = method !== 'GET' ? await request.text() : undefined;
    
    // DO NOT forward Authorization header - backend trusts x-shopify-shop-domain only
    const response = await fetch(backendUrl.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-shopify-shop-domain': shopDomain
        // Explicitly NOT forwarding Authorization header
      },
      body
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Backend responded with ${response.status}` }));
      return new Response(JSON.stringify(errorData), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`Error ${method.toLowerCase()} auction:`, error);
    return new Response(JSON.stringify({ error: `Failed to ${method.toLowerCase()} auction` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

