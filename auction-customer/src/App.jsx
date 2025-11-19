import React, { useState, useEffect, useCallback } from 'react';
import {
  AppProvider,
  Page,
  Card,
  Text,
  Layout,
  Banner,
  Spinner,
  Frame,
  Toast
} from '@shopify/polaris';
import { auctionAPI, customerAPI } from './services/api';
import socketService from './services/socket';
import customerAuthService from './services/customerAuth';
import AuctionCard from './components/AuctionCard';
import CustomerAuth from './components/CustomerAuth';
import themeService from './services/themeService';

function App() {
  const marketplaceConfig = typeof window !== 'undefined' ? (window.BidlyMarketplaceConfig || {}) : {};
  const enforceShopifyLogin = !!marketplaceConfig.enforceShopifyLogin;
  const shopifyLoginUrl = marketplaceConfig.loginUrl;
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

  const ANONYMOUS_BIDDER = 'Anonymous';

  const getDisplayName = (entity) => {
    if (!entity) return ANONYMOUS_BIDDER;
    return (
      entity.displayName ||
      entity.bidder ||
      entity.bidderName ||
      entity.name ||
      ANONYMOUS_BIDDER
    );
  };

  const normalizeBid = (bid = {}) => {
    const displayName = getDisplayName(bid);
    return { ...bid, displayName };
  };

  const normalizeBidHistory = (history = []) => history.map(normalizeBid);

  const normalizeWinner = (winner) => {
    if (!winner) return null;
    return { ...winner, displayName: getDisplayName(winner) };
  };

  const normalizeAuction = (auction = {}) => {
    if (!auction) return auction;
    return {
      ...auction,
      bidHistory: normalizeBidHistory(auction.bidHistory || []),
      winner: normalizeWinner(auction.winner)
    };
  };

  // Get shop information from URL parameters before defining hooks that depend on it
  const getShopInfo = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const shopParam = urlParams.get('shop');
    if (shopParam) {
      const shopNameParam = shopParam.replace('.myshopify.com', '');
      return { shop: shopParam, shopName: shopNameParam };
    }
    return { shop: null, shopName: null };
  };

  const { shop, shopName } = getShopInfo();
  const resolvedShopDomain =
    shop || marketplaceConfig.shopDomain || marketplaceConfig.shop || null;

  // Customer authentication state - declare before useCallback hooks that depend on them
  const [customer, setCustomer] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [customerSyncing, setCustomerSyncing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  const syncCustomerProfile = useCallback(async (sourceCustomer) => {
    if (!sourceCustomer?.email || !resolvedShopDomain) {
      return null;
    }

    const displayNameCandidate =
      sourceCustomer.displayName ||
      sourceCustomer.fullName ||
      sourceCustomer.name ||
      sourceCustomer.email ||
      ANONYMOUS_BIDDER;

    const nameSeed = sourceCustomer.fullName || sourceCustomer.name || '';
    const [seedFirst = '', ...seedRest] = nameSeed.trim().split(' ').filter(Boolean);
    const fallbackFirst = sourceCustomer.firstName || seedFirst;
    const fallbackLast = sourceCustomer.lastName || seedRest.join(' ');

    setCustomerSyncing(true);
    try {
      const payload = {
        shopifyId: sourceCustomer.id,
        email: sourceCustomer.email,
        firstName: fallbackFirst,
        lastName: fallbackLast,
        displayName: displayNameCandidate,
        shopDomain: resolvedShopDomain
      };

      const response = await customerAPI.saveCustomer(payload);
      if (response?.customer) {
        setCustomerProfile(response.customer);
        return response.customer;
      }
    } catch (error) {
      console.error('Error syncing customer profile:', error);
    } finally {
      setCustomerSyncing(false);
    }

    return null;
  }, [resolvedShopDomain]);

  const ensureCustomerProfile = useCallback(async () => {
    if (!customer) {
      return null;
    }
    if (customerProfile?.id) {
      return customerProfile;
    }
    return await syncCustomerProfile(customer);
  }, [customer, customerProfile, syncCustomerProfile]);

  const currentDisplayName =
    customerProfile?.displayName ||
    customer?.fullName ||
    customer?.name ||
    customer?.email ||
    ANONYMOUS_BIDDER;

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
      const normalizedBidHistory = normalizeBidHistory(bidData.bidHistory || []);
      const normalizedWinner = normalizeWinner(bidData.winner);
      const bidderName = getDisplayName(bidData);
      
      setAuctions(prevAuctions => 
        prevAuctions.map(auction => {
          if (auction._id === bidData.auctionId || auction.id === bidData.auctionId) {
            return {
              ...auction,
              currentBid: typeof bidData.currentBid === 'number' ? bidData.currentBid : auction.currentBid,
              bidHistory: normalizedBidHistory.length ? normalizedBidHistory : auction.bidHistory,
              status: bidData.auctionEnded ? 'ended' : auction.status,
              endTime: bidData.auctionEnded ? new Date().toISOString() : auction.endTime,
              winner: normalizedWinner || auction.winner
            };
          }
          return auction;
        })
      );
      
      const productName = bidData.productTitle || 'the item';
      if (bidData.buyNow) {
        setToastMessage(`🎉 ${bidderName} bought ${productName} now! Auction ended.`);
      } else if (bidData.auctionEnded) {
        setToastMessage(`🏆 ${bidderName} won the auction with $${bidData.amount}!`);
      } else {
        setToastMessage(`New bid: $${bidData.amount} by ${bidderName}`);
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
            ? normalizeAuction({
                ...auction,
                ...(statusData.auctionData || {}),
                status: statusData.newStatus
              })
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

  useEffect(() => {
    if (customer) {
      syncCustomerProfile(customer);
    } else {
      setCustomerProfile(null);
    }
  }, [customer, syncCustomerProfile]);

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
      setAuctions(visibleAuctions.map(normalizeAuction));
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
      setAuctions(visibleAuctions.map(normalizeAuction));
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

    if (!customer?.id) {
      setError('We could not verify your bidder profile. Please log in again.');
      setToastMessage('❌ Please log in again to place bids.');
      setShowToast(true);
      setAuthRequired(true);
      setShowAuthModal(true);
      return;
    }

    let activeProfile = customerProfile;
    if (!activeProfile && customer) {
      activeProfile = await ensureCustomerProfile();
    }

    if (!activeProfile?.id) {
      const profileError = 'We could not load your bidder profile. Please refresh and try again.';
      setError(profileError);
      setToastMessage(`❌ ${profileError}`);
      setShowToast(true);
      setAuthRequired(true);
      setShowAuthModal(true);
      return;
    }

    try {
      setBidLoading(true);
      setError(null);
      
      const auctionId = bidData.auctionId;
      await auctionAPI.placeBid(auctionId, {
        amount: bidData.amount,
        customerId: activeProfile.id
      });
      
      const bidderName = activeProfile.displayName || currentDisplayName;
      setToastMessage(`✅ Bid placed successfully! $${bidData.amount} by ${bidderName}`);
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

    if (!customer?.id) {
      setError('We could not verify your bidder profile. Please log in again.');
      setToastMessage('❌ Please log in again to buy now.');
      setShowToast(true);
      setAuthRequired(true);
      setShowAuthModal(true);
      return;
    }

    let activeProfile = customerProfile;
    if (!activeProfile && customer) {
      activeProfile = await ensureCustomerProfile();
    }

    if (!activeProfile?.id) {
      const profileError = 'We could not load your bidder profile. Please refresh and try again.';
      setError(profileError);
      setToastMessage(`❌ ${profileError}`);
      setShowToast(true);
      setAuthRequired(true);
      setShowAuthModal(true);
      return;
    }

    try {
      setBidLoading(true);
      setError(null);
      
      const { auctionId } = data;
      
      await auctionAPI.buyNow(auctionId, { customerId: activeProfile.id });
      
      // Find the auction to get product name
      const auction = auctions.find(a => (a._id || a.id) === auctionId);
      const productName = auction?.productData?.title || 'the item';
      const bidderName = activeProfile.displayName || currentDisplayName;
      setToastMessage(`🎉 Buy now successful! ${bidderName} won ${productName}!`);
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

  // Customer authentication handlers
  const handleCustomerLogin = (customerData) => {
    setCustomer(customerData);
    syncCustomerProfile(customerData);
    setShowAuthModal(false);
    setAuthRequired(false);
    const alias = customerData.name || customerData.fullName || customerData.email || 'your account';
    setToastMessage(`Welcome, ${alias}! You can now place bids.`);
    setShowToast(true);
  };

  const handleCustomerLogout = () => {
    customerAuthService.logout();
    setCustomer(null);
    setCustomerProfile(null);
    if (!enforceShopifyLogin) {
      setToastMessage('You have been logged out.');
      setShowToast(true);
    }
  };

  const handleLoginAction = () => {
    if (enforceShopifyLogin && shopifyLoginUrl) {
      window.location.href = shopifyLoginUrl;
      return;
    }
    setAuthRequired(true);
    setShowAuthModal(true);
  };

  const requireAuth = () => {
    if (!customer) {
      if (enforceShopifyLogin && shopifyLoginUrl) {
        window.location.href = shopifyLoginUrl;
      } else {
        setAuthRequired(true);
        setShowAuthModal(true);
      }
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
          secondaryActions={[
            {
              content: customer ? `👤 ${currentDisplayName} · Logout` : 'Login to Bid',
              onAction: customer ? handleCustomerLogout : handleLoginAction
            }
          ]}
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
                  There are currently no pending, active, or ended auctions. Check back later!
                </Text>
              </div>
            </Card>
          ) : (
            <Layout>
              {auctions.map((auction) => (
                <Layout.Section oneHalf key={auction._id || auction.id}>
                  <AuctionCard 
                    auction={auction} 
                    onBidPlaced={(bidData) => handleBidPlaced({ ...bidData, auctionId: auction._id || auction.id })}
                    onBuyNow={() => handleBuyNow({ auctionId: auction._id || auction.id })}
                    isLoading={bidLoading || customerSyncing}
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
