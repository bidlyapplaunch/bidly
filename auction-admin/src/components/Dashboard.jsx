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
  ButtonGroup
} from '@shopify/polaris';
import { PlusMinor, AnalyticsMinor } from '@shopify/polaris-icons';
import AuctionTable from './AuctionTable';
import AuctionForm from './AuctionForm';
import AuctionDetails from './AuctionDetails';
import { auctionAPI, shopifyAPI } from '../services/api';

const Dashboard = () => {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [shopifyProducts, setShopifyProducts] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchStats();
    fetchShopifyProducts();
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
        title="Auction Dashboard"
        subtitle="Manage your auctions and monitor performance"
        primaryAction={{
          content: 'Create Auction',
          icon: PlusMinor,
          onAction: handleCreateAuction
        }}
        secondaryActions={[
          {
            content: 'Refresh',
            onAction: handleRefresh
          }
        ]}
      >
        <Layout>
          
          {/* Statistics Cards */}
          <Layout.Section>
            <Layout>
              <Layout.Section oneHalf>
                <Card sectioned>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Text variant="headingMd">Total Auctions</Text>
                    <Text variant="heading2xl" as="div">
                      {stats?.totalAuctions || 0}
                    </Text>
                  </div>
                </Card>
              </Layout.Section>
              <Layout.Section oneHalf>
                <Card sectioned>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Text variant="headingMd">Active Auctions</Text>
                    <Text variant="heading2xl" as="div">
                      {stats?.activeAuctions || 0}
                    </Text>
                  </div>
                </Card>
              </Layout.Section>
            </Layout>
          </Layout.Section>

          {/* Quick Stats */}
          <Layout.Section>
            <Card sectioned>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Text variant="headingMd">Auction Statistics</Text>
                <Layout>
                  <Layout.Section oneThird>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Text variant="bodyMd" color="subdued">Active Auctions</Text>
                      <Text variant="headingLg">{stats?.activeAuctions || 0}</Text>
                    </div>
                  </Layout.Section>
                  <Layout.Section oneThird>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Text variant="bodyMd" color="subdued">Closed Auctions</Text>
                      <Text variant="headingLg">{stats?.closedAuctions || 0}</Text>
                    </div>
                  </Layout.Section>
                  <Layout.Section oneThird>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Text variant="bodyMd" color="subdued">Total Bids</Text>
                      <Text variant="headingLg">
                        {stats?.statusBreakdown?.reduce((total, status) => 
                          total + (status.totalBids || 0), 0) || 0}
                      </Text>
                    </div>
                  </Layout.Section>
                </Layout>
              </div>
            </Card>
          </Layout.Section>


          {/* Auctions Table */}
          <Layout.Section>
            <AuctionTable
              onEdit={handleEditAuction}
              onView={handleViewAuction}
              onRefresh={handleRefresh}
              refreshTrigger={refreshTrigger}
            />
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

        {/* Toast */}
        {showToast && (
          <Toast
            content={toastMessage}
            onDismiss={() => setShowToast(false)}
          />
        )}
      </Page>
    </Frame>
  );
};

export default Dashboard;
