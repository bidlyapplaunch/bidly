import Dashboard from "../components/Dashboard";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { json } from "react-router";

const BACKEND_URL = process.env.AUCTION_BACKEND_URL || "https://bidly-backend.hiiiiiiiiiii.com";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Fetch stats and auctions in parallel
  const [statsResponse, auctionsResponse] = await Promise.all([
    fetch(`${BACKEND_URL}/api/auctions/stats?shop=${encodeURIComponent(shopDomain)}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-shopify-shop-domain': shopDomain
      }
    }).catch(() => null),
    fetch(`${BACKEND_URL}/api/auctions?shop=${encodeURIComponent(shopDomain)}&page=1&limit=10`, {
      headers: {
        'Content-Type': 'application/json',
        'x-shopify-shop-domain': shopDomain
      }
    }).catch(() => null)
  ]);

  const stats = statsResponse?.ok ? await statsResponse.json().catch(() => null) : null;
  const auctionsData = auctionsResponse?.ok ? await auctionsResponse.json().catch(() => null) : null;

  // Normalize auctions array
  let auctions = [];
  if (Array.isArray(auctionsData)) {
    auctions = auctionsData;
  } else if (auctionsData?.auctions) {
    auctions = auctionsData.auctions;
  } else if (auctionsData?.data) {
    auctions = auctionsData.data;
  }

  return json({
    stats: stats?.data || stats || { totalAuctions: 0, activeAuctions: 0, totalBids: 0 },
    auctions,
    shopDomain
  });
};

export default function Index() {
  return <Dashboard />;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
