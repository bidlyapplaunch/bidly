import { authenticate } from "../shopify.server";

const BACKEND_URL = process.env.AUCTION_BACKEND_URL || "https://bidly-backend.hiiiiiiiiiii.com";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  
  try {
    const url = new URL(`${BACKEND_URL}/api/auctions/stats`);
    url.searchParams.set('shop', shopDomain);
    
    const response = await fetch(url.toString(), {
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
    console.error('Error fetching auction stats:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch auction stats' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
