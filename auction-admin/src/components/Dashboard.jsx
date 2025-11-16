import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Banner,
  Frame,
  Tabs
} from '@shopify/polaris';
import { PlusMinor } from '@shopify/polaris-icons';
import AuctionTable from './AuctionTable';
import AuctionForm from './AuctionForm';
import AuctionDetails from './AuctionDetails';
import Analytics from './Analytics';
import AppBridgeToast from './AppBridgeToast';
import { auctionAPI, shopifyAPI, analyticsAPI, billingAPI } from '../services/api';
import socketService from '../services/socket';
import { useAppBridgeActions } from '../hooks/useAppBridge';
import { useLocation, useNavigate } from 'react-router-dom';

const Dashboard = ({ onLogout }) => {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  
  // App Bridge functionality
  const { getShopInfo } = useAppBridgeActions();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastError, setToastError] = useState(false);
  
  // Get shop information from App Bridge
  const shopInfo = getShopInfo();
  const [shopifyProducts, setShopifyProducts] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedTab, setSelectedTab] = useState(0);
  const [planInfo, setPlanInfo] = useState({ plan: 'free', pendingPlan: null });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchStats();
    fetchShopifyProducts();
    fetchPlan();
    
    // Set up WebSocket connection for real-time updates
    const socket = socketService.connect();
    
    // Listen for auction status updates
    const handleStatusUpdate = (statusData) => {
      console.log('📡 Admin received status update:', statusData);
      
      // Refresh stats and auction list when status changes
      fetchStats();
      setRefreshTrigger(prev => prev + 1);
      
      // Show notification for status changes
      setToastMessage(`🔄 Auction status updated: ${statusData.newStatus}`);
      setShowToast(true);
    };
    
    // Listen for bid updates
    const handleBidUpdate = (bidData) => {
      console.log('📡 Admin received bid update:', bidData);
      
      // Refresh stats and auction list when bids are placed
      fetchStats();
      setRefreshTrigger(prev => prev + 1);
    };
    
    socketService.onStatusUpdate(handleStatusUpdate);
    socketService.onBidUpdate(handleBidUpdate);
    
    return () => {
      socketService.offStatusUpdate(handleStatusUpdate);
      socketService.offBidUpdate(handleBidUpdate);
    };
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await auctionAPI.getAuctionStats();
      setStats(response.data);
    } catch (err) {
      setError('Failed to load dashboard statistics');
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchShopifyProducts = async () => {
    try {
      // Fetch real products from Shopify API
      const response = await shopifyAPI.getAllProducts(20);
      setShopifyProducts(response.data || []);
    } catch (error) {
      console.error('Failed to fetch Shopify products:', error);
      // Fallback to empty array if Shopify API fails
      setShopifyProducts([]);
    }
  };

  const fetchPlan = async () => {
    try {
      const response = await billingAPI.getCurrentPlan();
      if (response.success) {
        setPlanInfo({
          plan: response.plan,
          pendingPlan: response.pendingPlan,
          planDetails: response.planDetails
        });
      }
    } catch (err) {
      console.error('Failed to load plan info', err);
    }
  };

  const handleCreateAuction = () => {
    setSelectedAuction(null);
    setFormModalOpen(true);
  };

  const handleEditAuction = (auction) => {
    setSelectedAuction(auction);
    setFormModalOpen(true);
  };

  const handleViewAuction = (auction) => {
    console.log('🔍 View auction clicked:', auction);
    console.log('🔍 Auction ID:', auction?.id || auction?._id);
    setSelectedAuction(auction);
    setDetailsModalOpen(true);
  };

  const handleFormSave = async (auctionData) => {
    try {
      console.log('💾 Saving auction:', auctionData);
      console.log('💾 Data types:', {
        shopifyProductId: typeof auctionData.shopifyProductId,
        startTime: typeof auctionData.startTime,
        endTime: typeof auctionData.endTime,
        startingBid: typeof auctionData.startingBid,
        buyNowPrice: typeof auctionData.buyNowPrice,
        status: typeof auctionData.status
      });
      
      if (selectedAuction) {
        // Update existing auction
        await auctionAPI.updateAuction(selectedAuction._id, auctionData);
        setToastMessage('Auction updated successfully');
      } else {
        // Create new auction
        await auctionAPI.createAuction(auctionData);
        setToastMessage('Auction created successfully');
      }
      
      // Refresh the statistics and trigger auction list refresh
      await fetchStats();
      setRefreshTrigger(prev => prev + 1);
      
      setFormModalOpen(false);
      setSelectedAuction(null);
      setShowToast(true);
    } catch (error) {
      console.error('Error saving auction:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // Handle PLAN_LIMIT_REACHED error specifically
      if (error.response?.data?.code === 'PLAN_LIMIT_REACHED') {
        const errorData = error.response.data;
        const limitMessage = `You've reached your auction limit (${errorData.limit} auction${errorData.limit === 1 ? '' : 's'}) for your current plan.`;
        const upgradeMessage = 'Please upgrade your plan to create more auctions, or wait for existing auctions to end or close them manually.';
        setToastMessage(`${limitMessage} ${upgradeMessage}`);
        setToastError(true);
        setShowToast(true);
        // Show prompt after toast is visible
        setTimeout(() => {
          if (window.confirm('Would you like to view available plans to upgrade?')) {
            navigate(`/plans${location.search || ''}`);
          }
        }, 3000);
        return;
      }
      
      setToastMessage(`Error saving auction: ${error.response?.data?.message || error.message || error}`);
      setToastError(true);
      setShowToast(true);
    }
  };

  const handleRefresh = () => {
    fetchStats();
    setRefreshTrigger(prev => prev + 1);
  };

  const handleViewCustomerDashboard = () => {
    // Get current shop information
    const currentShop = shopInfo.shop;
    
    if (!currentShop) {
      setToastMessage('Unable to determine store information');
      setToastError(true);
      setShowToast(true);
      return;
    }

    // Generate customer dashboard URL with shop parameter
    const customerUrl = `https://${currentShop}/apps/bidly?shop=${currentShop}`;
    
    // Open in new tab
    window.open(customerUrl, '_blank');
    
    setToastMessage('Opening auction marketplace in new tab');
    setToastError(false);
    setShowToast(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const currentPlanKey = (planInfo?.plan || 'free').toLowerCase();
  const recognizedPlans = ['free', 'basic', 'pro', 'enterprise'];
  const canCreateAuctions = recognizedPlans.includes(currentPlanKey);
  const pageSubtitle = canCreateAuctions
    ? (shopInfo.storeName ? `Store: ${shopInfo.storeName}` : 'Manage your auctions and monitor performance')
    : 'Upgrade to a plan to start hosting auctions.';
  const primaryAction = canCreateAuctions
    ? {
        content: 'Create Auction',
        icon: PlusMinor,
        onAction: handleCreateAuction
      }
    : {
        content: 'Choose a plan to create auctions',
        onAction: () => navigate(`/plans${location.search || ''}`),
        primary: true
      };

  if (error) {
    return (
      <Frame>
        <Page>
          <Banner status="critical">
            <Text variant="bodyMd">{error}</Text>
          </Banner>
        </Page>
      </Frame>
    );
  }

  return (
    <Frame>
      <Page
        fullWidth
        title={`Auction Dashboard${shopInfo.shop ? ` - ${shopInfo.shop}` : ''}`}
        subtitle={pageSubtitle}
        primaryAction={primaryAction}
        secondaryActions={[
          {
            content: 'Auction Marketplace',
            onAction: handleViewCustomerDashboard
          },
          {
            content: 'Refresh',
            onAction: handleRefresh
          },
          {
            content: 'Logout',
            onAction: onLogout
          }
        ]}
      >
        <Layout>
          {!canCreateAuctions && (
            <Layout.Section>
              <Banner
                tone="info"
                title="Preview mode active"
                action={{
                  content: 'View plans',
                  onAction: () => navigate(`/plans${location.search || ''}`)
                }}
              >
                <p>
                  You can explore the Bidly dashboard, but creating or managing live auctions requires an active
                  subscription. Choose a plan to unlock hosting, customization, and live bidding features.
                </p>
              </Banner>
            </Layout.Section>
          )}
          {/* Statistics Cards */}
          <Layout.Section>
            <Card sectioned>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Text variant="headingMd">Auction Overview</Text>
                <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Text variant="bodyMd" color="subdued">Total Auctions</Text>
                    <Text variant="heading2xl" as="div">
                      {stats?.totalAuctions || 0}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Text variant="bodyMd" color="subdued">Active Auctions</Text>
                    <Text variant="heading2xl" as="div" style={{ color: '#008060' }}>
                      {stats?.activeAuctions || 0}
                    </Text>
                  </div>
                </div>
              </div>
            </Card>
          </Layout.Section>
          {/* Total Bids */}
          <Layout.Section>
            <Card sectioned>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Text variant="headingMd">Total Bids</Text>
                <Text variant="heading2xl" as="div">
                  {stats?.totalBids || 0}
                </Text>
              </div>
            </Card>
          </Layout.Section>

          {/* Quick navigation buttons */}
          <Layout.Section>
            <Card sectioned>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <Button onClick={() => navigate(`/customization/widget${location.search || ''}`)}>
                  🎨 Widget styles
                </Button>
                <Button onClick={() => navigate(`/customization/marketplace${location.search || ''}`)}>
                  🎨 Marketplace styles
                </Button>
                <Button onClick={() => navigate(`/plans${location.search || ''}`)}>
                  🧾 Plans
                </Button>
              </div>
            </Card>
          </Layout.Section>


          {/* Tabbed Interface */}
          <Layout.Section>
            <Card>
              <Tabs
                tabs={[
                  {
                    id: 'auctions',
                    content: '📋 Auctions',
                    panelID: 'auctions-panel'
                  },
                  {
                    id: 'analytics',
                    content: '📊 Analytics',
                    panelID: 'analytics-panel'
                  }
                ]}
                selected={selectedTab}
                onSelect={setSelectedTab}
              >
                {selectedTab === 0 && (
                  <div style={{ padding: '16px' }}>
                    <AuctionTable
                      onEdit={handleEditAuction}
                      onView={handleViewAuction}
                      onRefresh={handleRefresh}
                      refreshTrigger={refreshTrigger}
                    />
                  </div>
                )}
                {selectedTab === 1 && (
                  <div style={{ padding: '16px' }}>
                    <Analytics />
                  </div>
                )}
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Modals */}
        <AuctionForm
          isOpen={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          auction={selectedAuction}
          onSave={handleFormSave}
          planInfo={planInfo}
        />

        <AuctionDetails
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          auction={selectedAuction}
          onRefresh={handleRefresh}
        />

        {/* App Bridge Toast */}
        {showToast && (
          <AppBridgeToast 
            message={toastMessage}
            isError={toastError}
            duration={8000}
            onDismiss={() => {
              setShowToast(false);
              setToastMessage('');
              setToastError(false);
            }}
          />
        )}
      </Page>
    </Frame>
  );
};

export default Dashboard;
