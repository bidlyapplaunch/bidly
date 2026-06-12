/**
 * Compute the real-time status of an auction from its stored status + time window.
 *
 * Single source of truth (BACKEND-13). Previously three divergent copies existed in
 * auctionController, analyticsController, and server.js — the server/analytics copies did
 * NOT preserve `reserve_not_met`, so the same auction could report different statuses
 * depending on which endpoint served it. Import this everywhere instead.
 */
export const computeAuctionStatus = (auction) => {
  // Preserve terminal/admin states that are set explicitly and must not be
  // recomputed from the time window.
  if (auction.status === 'closed') return 'closed';
  if (auction.status === 'reserve_not_met') return 'reserve_not_met';
  if (auction.status === 'failed') return 'failed';

  const now = new Date();
  const startTime = new Date(auction.startTime);
  const endTime = new Date(auction.endTime);

  if (now < startTime) return 'pending';
  if (now >= startTime && now < endTime) return 'active';
  return 'ended';
};

export default computeAuctionStatus;
