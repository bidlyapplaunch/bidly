import { authenticate } from "../shopify.server";

const BACKEND_URL = process.env.AUCTION_BACKEND_URL || "https://bidly-backend.hiiiiiiiiiii.com";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  searchParams.set('shop', shopDomain);
  
  try {
    // GET /api/auctions (list only)
    const backendUrl = `${BACKEND_URL}/api/auctions?${searchParams}`;
    
    // DO NOT forward Authorization header - backend trusts x-shopify-shop-domain only
    const response = await fetch(backendUrl, {
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
    console.error('Error fetching auctions:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch auctions' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  
  const method = request.method;
  
  try {
    // POST /api/auctions (create only)
    if (method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const backendUrl = new URL(`${BACKEND_URL}/api/auctions`);
    backendUrl.searchParams.set('shop', shopDomain);
    
    const body = await request.text();
    
    // DO NOT forward Authorization header - backend trusts x-shopify-shop-domain only
    const response = await fetch(backendUrl.toString(), {
      method: 'POST',
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
    console.error('Error creating auction:', error);
    return new Response(JSON.stringify({ error: 'Failed to create auction' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
