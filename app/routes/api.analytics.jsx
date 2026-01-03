import { authenticate } from "../shopify.server";

const BACKEND_URL = process.env.AUCTION_BACKEND_URL || "https://bidly-backend.hiiiiiiiiiii.com";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  
  try {
    const url = new URL(`${BACKEND_URL}/api/analytics/`);
    url.searchParams.set('shop', shopDomain);
    
    // Copy period query param if present
    const requestUrl = new URL(request.url);
    const period = requestUrl.searchParams.get('period');
    if (period) {
      url.searchParams.set('period', period);
    }
    
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
    console.error('Error fetching analytics:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch analytics' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

