import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Banner,
  Frame,
  Toast,
  ResourceList,
  ResourceItem,
  Avatar,
  Badge,
  ButtonGroup,
  Tabs,
  BlockStack
} from '@shopify/polaris';
import { PlusMinor, AnalyticsMinor } from '@shopify/polaris-icons';
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
  const [planInfo, setPlanInfo] = useState({ plan: 'none', pendingPlan: null });
  const [planLoading, setPlanLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const search = location.search || '';

  const goToMarketplaceCustomization = () => {
    navigate(`/customization/marketplace${search}`);
  };

  const goToWidgetCustomization = () => {
    navigate(`/customization/widget${search}`);
  };

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
      setPlanLoading(true);
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
    } finally {
      setPlanLoading(false);
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
      setToastMessage(`Error saving auction: ${error.response?.data?.message || error.message || error}`);
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
    const customerUrl = `https://bidly-auction-customer.onrender.com?shop=${currentShop}`;
    
    // Open in new tab
    window.open(customerUrl, '_blank');
    
    setToastMessage('Opening customer dashboard in new tab');
    setToastError(false);
    setShowToast(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
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
        title={`Auction Dashboard${shopInfo.shop ? ` - ${shopInfo.shop}` : ''}`}
        subtitle={shopInfo.storeName ? `Store: ${shopInfo.storeName}` : 'Manage your auctions and monitor performance'}
        primaryAction={{
          content: 'Create Auction',
          icon: PlusMinor,
          onAction: handleCreateAuction
        }}
        secondaryActions={[
          {
            content: 'View Customer Dashboard',
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

          {/* Customization shortcuts */}
          <Layout.Section>
            <Card sectioned>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <Text variant="headingMd">Visual customization</Text>
                  <Text variant="bodySm" color="subdued">
                    Update the storefront widget or marketplace appearance from dedicated customization studios.
                  </Text>
                </div>
                <ButtonGroup>
                  <Button disabled>Marketplace styles (coming soon)</Button>
                  <Button onClick={goToWidgetCustomization}>Widget styles</Button>
                  <Button onClick={() => navigate(`/plans${search}`)}>Manage plan</Button>
                </ButtonGroup>
              </div>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card sectioned>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  <BlockStack gap="tight">
                    <Text variant="headingMd">Subscription</Text>
                    {planLoading ? (
                      <Text tone="subdued">Loading plan…</Text>
                    ) : (
                      <Text tone="subdued">
                        Current plan: {planInfo.plan || 'none'}
                        {planInfo.pendingPlan && planInfo.pendingPlan !== planInfo.plan
                          ? ` · Pending: ${planInfo.pendingPlan}`
                          : ''}
                      </Text>
                    )}
                  </BlockStack>
                  <Button primary onClick={() => navigate(`/plans${search}`)}>
                    View plans
                  </Button>
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
            duration={5000}
          />
        )}
      </Page>
    </Frame>
  );
};

export default Dashboard;
