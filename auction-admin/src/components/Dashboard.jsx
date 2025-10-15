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
  Tabs
} from '@shopify/polaris';
import { PlusMinor, AnalyticsMinor } from '@shopify/polaris-icons';
import AuctionTable from './AuctionTable';
import AuctionForm from './AuctionForm';
import AuctionDetails from './AuctionDetails';
import Analytics from './Analytics';
import AppBridgeToast from './AppBridgeToast';
import { auctionAPI, shopifyAPI, analyticsAPI } from '../services/api';
import socketService from '../services/socket';
import { useAppBridgeActions } from '../hooks/useAppBridge';

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

  useEffect(() => {
    fetchStats();
    fetchShopifyProducts();
    
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
