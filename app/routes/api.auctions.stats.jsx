import { authenticate } from "../shopify.server";

const BACKEND_URL = "https://bidly-auction-backend.onrender.com";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/auctions/stats`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
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
