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
import customerAuthService from './services/customerAuth';
import AuctionCard from './components/AuctionCard';
import CustomerAuth from './components/CustomerAuth';
import themeService from './services/themeService';

function App() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bidLoading, setBidLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [marketplaceTheme, setMarketplaceTheme] = useState({
    template: 'A',
    gradientEnabled: false
  });
  
  // Customer authentication state
  const [customer, setCustomer] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  // Get shop information from URL parameters
  const getShopInfo = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop');
    if (shop) {
      const shopName = shop.replace('.myshopify.com', '');
      return { shop, shopName };
    }
    return { shop: null, shopName: null };
  };

  const { shop, shopName } = getShopInfo();

  useEffect(() => {
    let isMounted = true;

    themeService.loadTheme(shop).then((theme) => {
      if (!isMounted || !theme) {
        return;
      }

      setMarketplaceTheme({
        template: (theme.template || 'A').toUpperCase(),
        gradientEnabled: !!theme.gradientEnabled
      });
    });

    // Initialize customer authentication
    if (customerAuthService.isAuthenticated()) {
      setCustomer(customerAuthService.getCustomer());
      console.log('👤 Customer authenticated:', customerAuthService.getCustomerName());
    }
    
    fetchVisibleAuctions();
    
    // Set up WebSocket connection for real-time updates
    const socket = socketService.connect();
    
    // Monitor connection status
    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setConnectionStatus('connected');
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setConnectionStatus('disconnected');
    });
    
    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      setConnectionStatus('error');
    });
    
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
                bidHistory: bidData.bidHistory,
                status: bidData.auctionEnded ? 'ended' : auction.status,
                endTime: bidData.auctionEnded ? new Date().toISOString() : auction.endTime
              }
            : auction
        )
      );
      
      // Show notification for new bid or buy now
      if (bidData.buyNow) {
        const productName = bidData.productTitle || 'the item';
        setToastMessage(`🎉 ${bidData.bidder} bought ${productName} now! Auction ended.`);
      } else if (bidData.auctionEnded) {
        setToastMessage(`🏆 ${bidData.bidder} won the auction with $${bidData.amount}!`);
      } else {
        setToastMessage(`New bid: $${bidData.amount} by ${bidData.bidder}`);
      }
      setShowToast(true);
    };
    
    // Listen for auction status updates (pending -> active -> ended)
    const handleStatusUpdate = (statusData) => {
      console.log('📡 Received status update:', statusData);
      
      // Update the auction in the local state
      setAuctions(prevAuctions => 
        prevAuctions.map(auction => 
          auction._id === statusData.auctionId || auction.id === statusData.auctionId
            ? {
                ...auction,
                status: statusData.newStatus,
                ...statusData.auctionData
              }
            : auction
        )
      );
      
      // Show notification for status changes
      let statusMessage = '';
      switch (statusData.newStatus) {
        case 'active':
          statusMessage = `🟢 Auction is now active! You can place bids.`;
          break;
        case 'ended':
          statusMessage = `🔴 Auction has ended.`;
          break;
        case 'pending':
          statusMessage = `⏳ Auction is pending.`;
          break;
        default:
          statusMessage = `🔄 Auction status updated to ${statusData.newStatus}.`;
      }
      
      setToastMessage(statusMessage);
      setShowToast(true);
    };
    
    // Listen for time extension events (popcorn auctions)
    const handleTimeExtension = (extensionData) => {
      console.log('🍿 Received time extension:', extensionData);
      
      // Update the auction in the local state with new end time
      setAuctions(prevAuctions => 
        prevAuctions.map(auction => 
          auction._id === extensionData.auctionId || auction.id === extensionData.auctionId
            ? {
                ...auction,
                endTime: extensionData.newEndTime
              }
            : auction
        )
      );
      
      // Show notification for time extension
      setToastMessage(`🍿 ${extensionData.message}`);
      setShowToast(true);
    };
    
    socketService.onBidUpdate(handleBidUpdate);
    socketService.onStatusUpdate(handleStatusUpdate);
    socketService.onTimeExtension(handleTimeExtension);
    
    // Set up automatic refresh every 10 seconds to detect status changes (as backup)
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing auctions to check status changes...');
      fetchVisibleAuctionsSilent();
    }, 10000); // 10 seconds
    
    return () => {
      socketService.offBidUpdate(handleBidUpdate);
      socketService.offStatusUpdate(handleStatusUpdate);
      socketService.disconnect();
      clearInterval(refreshInterval);
      isMounted = false;
    };
  }, []);

  // Join auction rooms when auctions are loaded or updated
  useEffect(() => {
    if (auctions.length > 0 && socketService.isSocketConnected()) {
      console.log('🔌 Joining auction rooms for real-time updates...');
      auctions.forEach(auction => {
        const auctionId = auction._id || auction.id;
        if (auctionId) {
          socketService.joinAuction(auctionId);
        }
      });
    }
  }, [auctions]);

  const fetchVisibleAuctions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await auctionAPI.getVisibleAuctions();
      // Filter to show pending, active, and ended auctions (exclude only closed)
      const visibleAuctions = (response.data || []).filter(auction => 
        auction.status === 'pending' || auction.status === 'active' || auction.status === 'ended'
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

  // Silent refresh for automatic status updates (no loading spinner)
  const fetchVisibleAuctionsSilent = async () => {
    try {
      const response = await auctionAPI.getVisibleAuctions();
      // Filter to show pending, active, and ended auctions (exclude only closed)
      const visibleAuctions = (response.data || []).filter(auction => 
        auction.status === 'pending' || auction.status === 'active' || auction.status === 'ended'
      );
      setAuctions(visibleAuctions);
    } catch (err) {
      console.error('Error in silent refresh:', err);
      // Don't set error for silent refresh to avoid disrupting user experience
    }
  };

  const handleBidPlaced = async (bidData) => {
    // Check if customer is authenticated
    if (!requireAuth()) {
      return;
    }

    try {
      setBidLoading(true);
      setError(null);
      
      // Find the auction ID (assuming we have it in the context)
      // For now, we'll need to pass the auction ID from the component
      const auctionId = bidData.auctionId;
      const bidder = customer.name; // Use authenticated customer name
      
      await auctionAPI.placeBid(auctionId, {
        bidder: bidder,
        amount: bidData.amount,
        customerEmail: customer.email
      });
      
      setToastMessage(`✅ Bid placed successfully! $${bidData.amount} by ${bidder}`);
      setShowToast(true);
      
      // Refresh auctions to get updated data
      await fetchVisibleAuctions();
      
    } catch (err) {
      console.error('Error placing bid:', err);
      
      // Better error handling with specific messages
      let errorMessage = 'Failed to place bid. Please try again.';
      
      if (err.response?.status === 400) {
        errorMessage = err.response?.data?.message || 'Invalid bid. Please check your bid amount.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Auction not found. It may have ended.';
      } else if (err.response?.status === 409) {
        errorMessage = 'Auction is not active. You cannot bid on this auction.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please try again in a moment.';
      } else if (!navigator.onLine) {
        errorMessage = 'No internet connection. Please check your network.';
      }
      
      setError(errorMessage);
      setToastMessage(`❌ ${errorMessage}`);
      setShowToast(true);
    } finally {
      setBidLoading(false);
    }
  };

  const handleBuyNow = async (data) => {
    // Check if customer is authenticated
    if (!requireAuth()) {
      return;
    }

    try {
      setBidLoading(true);
      setError(null);
      
      const { auctionId } = data;
      const bidder = customer.name; // Use authenticated customer name
      
      await auctionAPI.buyNow(auctionId, bidder, customer.email);
      
      // Find the auction to get product name
      const auction = auctions.find(a => (a._id || a.id) === auctionId);
      const productName = auction?.productData?.title || 'the item';
      setToastMessage(`🎉 Buy now successful! ${bidder} won ${productName}!`);
      setShowToast(true);
      
      // Refresh auctions to get updated data
      await fetchVisibleAuctions();
      
    } catch (err) {
      console.error('Error buying now:', err);
      
      // Better error handling for buy now
      let errorMessage = 'Failed to buy now. Please try again.';
      
      if (err.response?.status === 400) {
        errorMessage = err.response?.data?.message || 'Invalid buy now request.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Auction not found or already ended.';
      } else if (err.response?.status === 409) {
        errorMessage = 'Auction is not active. Buy now is not available.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please try again in a moment.';
      } else if (!navigator.onLine) {
        errorMessage = 'No internet connection. Please check your network.';
      }
      
      setError(errorMessage);
      setToastMessage(`❌ ${errorMessage}`);
      setShowToast(true);
    } finally {
      setBidLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchVisibleAuctions();
  };

  // Customer authentication handlers
  const handleCustomerLogin = (customerData) => {
    setCustomer(customerData);
    setShowAuthModal(false);
    setAuthRequired(false);
    setToastMessage(`Welcome, ${customerData.name}! You can now place bids.`);
    setShowToast(true);
  };

  const handleCustomerLogout = () => {
    customerAuthService.logout();
    setCustomer(null);
    setToastMessage('You have been logged out.');
    setShowToast(true);
  };

  const requireAuth = () => {
    if (!customer) {
      setAuthRequired(true);
      setShowAuthModal(true);
      return false;
    }
    return true;
  };

  if (loading) {
    return (
      <div
        className="bidly-marketplace-root"
        data-bidly-marketplace-template={marketplaceTheme.template}
        data-bidly-marketplace-gradient={marketplaceTheme.gradientEnabled ? '1' : '0'}
      >
        <AppProvider>
          <Frame>
            <Page title="Live Auctions">
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <Spinner size="large" />
              </div>
            </Page>
          </Frame>
        </AppProvider>
      </div>
    );
  }

  return (
    <div
      className="bidly-marketplace-root"
      data-bidly-marketplace-template={marketplaceTheme.template}
      data-bidly-marketplace-gradient={marketplaceTheme.gradientEnabled ? '1' : '0'}
    >
      <AppProvider>
        <Frame>
        <Page 
          title={`Auction Marketplace${shopName ? ` - ${shopName}` : ''}`}
          subtitle={shopName ? `Browse auctions from ${shopName}` : "Browse pending, active, and ended auctions"}
          primaryAction={{
            content: 'Refresh',
            onAction: handleRefresh
          }}
          secondaryActions={[
            {
              content: customer ? `👤 ${customer.name}` : 'Login to Bid',
              onAction: customer ? handleCustomerLogout : () => setShowAuthModal(true)
            }
          ]}
        >
          {/* Shop Information and Connection Status */}
          <div style={{ marginBottom: '1rem' }}>
            {shopName && (
              <Banner status="info">
                <Text variant="bodyMd">🏪 Viewing auctions from <strong>{shopName}</strong></Text>
              </Banner>
            )}
            {connectionStatus === 'connected' && (
              <Banner status="success">
                <Text variant="bodyMd">🟢 Connected to live updates</Text>
              </Banner>
            )}
            {connectionStatus === 'connecting' && (
              <Banner status="info">
                <Text variant="bodyMd">🟡 Connecting to live updates...</Text>
              </Banner>
            )}
            {connectionStatus === 'disconnected' && (
              <Banner status="warning">
                <Text variant="bodyMd">🔴 Disconnected from live updates. Refreshing...</Text>
              </Banner>
            )}
            {connectionStatus === 'error' && (
              <Banner status="critical">
                <Text variant="bodyMd">❌ Connection error. Some features may not work properly.</Text>
              </Banner>
            )}
          </div>
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
                  There are currently no pending, active, or ended auctions. Check back later!
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
                    onBuyNow={(bidder) => handleBuyNow({ bidder, auctionId: auction._id || auction.id })}
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
        {/* Customer Authentication Modal */}
        {showAuthModal && (
          <CustomerAuth
            onLogin={handleCustomerLogin}
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </Frame>
    </AppProvider>
  </div>
  );
}

export default App;
