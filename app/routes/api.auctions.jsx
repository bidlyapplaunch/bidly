import { authenticate } from "../shopify.server";

const BACKEND_URL = "https://unsynchronous-theresia-indefinite.ngrok-free.dev";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/auctions?${searchParams}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
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
    console.error('Error fetching auctions:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch auctions' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  
  const method = request.method;
  const url = new URL(request.url);
  const auctionId = url.pathname.split('/').pop();
  
  try {
    let backendUrl = `${BACKEND_URL}/api/auctions`;
    if (auctionId && method !== 'POST') {
      backendUrl += `/${auctionId}`;
    }
    
    const body = method !== 'GET' ? await request.text() : undefined;
    
    const response = await fetch(backendUrl, {
      method,
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json'
      },
      body
    });
    
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
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
