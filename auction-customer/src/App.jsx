import React, { useState, useEffect } from 'react';
import { 
  AppProvider, 
  Page, 
  Card, 
  Text, 
  Layout, 
  Banner, 
  Spinner, 
  Frame,
  Toast,
  Button
} from '@shopify/polaris';
import { auctionAPI } from './services/api';
import socketService from './services/socket';
import AuctionCard from './components/AuctionCard';

function App() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bidLoading, setBidLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetchVisibleAuctions();
    
    // Set up WebSocket connection for real-time updates
    socketService.connect();
    
    // Listen for real-time bid updates
    const handleBidUpdate = (bidData) => {
      console.log('📡 Received real-time bid update:', bidData);
      
      // Update the auction in the local state
      setAuctions(prevAuctions => 
        prevAuctions.map(auction => 
          auction._id === bidData.auctionId || auction.id === bidData.auctionId
            ? {
                ...auction,
                currentBid: bidData.currentBid,
                bidHistory: bidData.bidHistory
              }
            : auction
        )
      );
      
      // Show notification for new bid
      setToastMessage(`New bid: $${bidData.amount} by ${bidData.bidder}`);
      setShowToast(true);
    };
    
    socketService.onBidUpdate(handleBidUpdate);
    
    return () => {
      socketService.offBidUpdate(handleBidUpdate);
      socketService.disconnect();
    };
  }, []);

  const fetchVisibleAuctions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await auctionAPI.getVisibleAuctions();
      // Filter to show only pending and active auctions (exclude closed)
      const visibleAuctions = (response.data || []).filter(auction => 
        auction.status === 'pending' || auction.status === 'active'
      );
      setAuctions(visibleAuctions);
    } catch (err) {
      console.error('Error fetching auctions:', err);
      setError('Failed to fetch auctions. Please try again later.');
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBidPlaced = async (bidData) => {
    try {
      setBidLoading(true);
      setError(null);
      
      // Find the auction ID (assuming we have it in the context)
      // For now, we'll need to pass the auction ID from the component
      const auctionId = bidData.auctionId;
      
      await auctionAPI.placeBid(auctionId, {
        bidder: bidData.bidder,
        amount: bidData.amount
      });
      
      setToastMessage(`Bid placed successfully! $${bidData.amount}`);
      setShowToast(true);
      
      // Refresh auctions to get updated data
      await fetchVisibleAuctions();
      
    } catch (err) {
      console.error('Error placing bid:', err);
      setError(err.response?.data?.message || 'Failed to place bid. Please try again.');
    } finally {
      setBidLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchVisibleAuctions();
  };

  if (loading) {
    return (
      <AppProvider>
        <Frame>
          <Page title="Live Auctions">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
              <Spinner size="large" />
            </div>
          </Page>
        </Frame>
      </AppProvider>
    );
  }

  return (
    <AppProvider>
      <Frame>
        <Page 
          title="Live Auctions" 
          subtitle="Browse upcoming and active auctions"
          primaryAction={{
            content: 'Refresh',
            onAction: handleRefresh
          }}
        >
          {error && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner status="critical">
                <Text variant="bodyMd">{error}</Text>
              </Banner>
            </div>
          )}

          {auctions.length === 0 ? (
            <Card sectioned>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Text variant="headingLg" as="h2">No Auctions Available</Text>
                <Text variant="bodyMd" color="subdued">
                  There are currently no pending or active auctions. Check back later!
                </Text>
                <div style={{ marginTop: '1rem' }}>
                  <Button onClick={handleRefresh}>Refresh</Button>
                </div>
              </div>
            </Card>
          ) : (
            <Layout>
              {auctions.map((auction) => (
                <Layout.Section oneHalf key={auction._id || auction.id}>
                  <AuctionCard 
                    auction={auction} 
                    onBidPlaced={(bidData) => handleBidPlaced({ ...bidData, auctionId: auction._id || auction.id })}
                    isLoading={bidLoading}
                  />
                </Layout.Section>
              ))}
            </Layout>
          )}

          {/* Toast for notifications */}
          {showToast && (
            <Toast
              content={toastMessage}
              onDismiss={() => setShowToast(false)}
            />
          )}
        </Page>
      </Frame>
    </AppProvider>
  );
}

export default App;
