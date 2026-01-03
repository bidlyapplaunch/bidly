import { authenticate } from "../shopify.server";

const BACKEND_URL = process.env.AUCTION_BACKEND_URL || "https://bidly-backend.hiiiiiiiiiii.com";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  searchParams.set('shop', shopDomain);
  
  // Check if this is a request for a single auction by ID
  // React Router may pass params.id for dynamic routes, or we check the pathname
  const pathParts = url.pathname.split('/').filter(Boolean);
  const auctionId = params.id || (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'auctions' ? pathParts[2] : null);
  const isSingleAuction = auctionId && auctionId !== 'stats';
  
  try {
    let backendUrl;
    if (isSingleAuction) {
      // GET /api/auctions/:id
      backendUrl = `${BACKEND_URL}/api/auctions/${auctionId}`;
      const backendUrlObj = new URL(backendUrl);
      backendUrlObj.searchParams.set('shop', shopDomain);
      backendUrl = backendUrlObj.toString();
    } else {
      // GET /api/auctions (list)
      backendUrl = `${BACKEND_URL}/api/auctions?${searchParams}`;
    }
    
    const response = await fetch(backendUrl, {
      headers: {
        'Content-Type': 'application/json',
        'x-shopify-shop-domain': shopDomain
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
  const url = new URL(request.url);
  const auctionId = url.pathname.split('/').pop();
  
  try {
    let backendUrl = `${BACKEND_URL}/api/auctions`;
    if (auctionId && method !== 'POST') {
      backendUrl += `/${auctionId}`;
    }
    
    // Add shop domain to query params
    const backendUrlObj = new URL(backendUrl);
    backendUrlObj.searchParams.set('shop', shopDomain);
    backendUrl = backendUrlObj.toString();
    
    const body = method !== 'GET' ? await request.text() : undefined;
    
    const response = await fetch(backendUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-shopify-shop-domain': shopDomain
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
