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
  Stack,
  DisplayText,
  ResourceList,
  ResourceItem,
  Avatar,
  Badge,
  ButtonGroup
} from '@shopify/polaris';
import { PlusIcon, AnalyticsIcon } from '@shopify/polaris-icons';
import AuctionTable from './AuctionTable';
import AuctionForm from './AuctionForm';
import AuctionDetails from './AuctionDetails';
import { auctionAPI } from '../services/api';

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
    // Mock Shopify products - in a real app, this would come from Shopify API
    const mockProducts = [
      { id: 'prod_123', title: 'Vintage Guitar' },
      { id: 'prod_456', title: 'Art Painting' },
      { id: 'prod_789', title: 'Antique Watch' },
      { id: 'prod_101', title: 'Rare Book' },
      { id: 'prod_202', title: 'Collectible Coin' }
    ];
    setShopifyProducts(mockProducts);
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

  const handleFormSave = () => {
    setFormModalOpen(false);
    setSelectedAuction(null);
    setToastMessage('Auction saved successfully');
    setShowToast(true);
  };

  const handleRefresh = () => {
    fetchStats();
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
          icon: PlusIcon,
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
                  <Stack vertical spacing="tight">
                    <Text variant="headingMd">Total Auctions</Text>
                    <DisplayText size="large">
                      {stats?.totalAuctions || 0}
                    </DisplayText>
                  </Stack>
                </Card>
              </Layout.Section>
              <Layout.Section oneHalf>
                <Card sectioned>
                  <Stack vertical spacing="tight">
                    <Text variant="headingMd">Active Auctions</Text>
                    <DisplayText size="large">
                      {stats?.activeAuctions || 0}
                    </DisplayText>
                  </Stack>
                </Card>
              </Layout.Section>
            </Layout>
          </Layout.Section>

          {/* Quick Stats */}
          <Layout.Section>
            <Card sectioned>
              <Stack vertical spacing="loose">
                <Text variant="headingMd">Auction Statistics</Text>
                <Layout>
                  <Layout.Section oneThird>
                    <Stack vertical spacing="tight">
                      <Text variant="bodyMd" color="subdued">Active Auctions</Text>
                      <Text variant="headingLg">{stats?.activeAuctions || 0}</Text>
                    </Stack>
                  </Layout.Section>
                  <Layout.Section oneThird>
                    <Stack vertical spacing="tight">
                      <Text variant="bodyMd" color="subdued">Closed Auctions</Text>
                      <Text variant="headingLg">{stats?.closedAuctions || 0}</Text>
                    </Stack>
                  </Layout.Section>
                  <Layout.Section oneThird>
                    <Stack vertical spacing="tight">
                      <Text variant="bodyMd" color="subdued">Total Bids</Text>
                      <Text variant="headingLg">
                        {stats?.statusBreakdown?.reduce((total, status) => 
                          total + (status.totalBids || 0), 0) || 0}
                      </Text>
                    </Stack>
                  </Layout.Section>
                </Layout>
              </Stack>
            </Card>
          </Layout.Section>

          {/* Auctions Table */}
          <Layout.Section>
            <AuctionTable
              onEdit={handleEditAuction}
              onView={handleViewAuction}
              onRefresh={handleRefresh}
            />
          </Layout.Section>
        </Layout>

        {/* Modals */}
        <AuctionForm
          isOpen={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          auction={selectedAuction}
          onSave={handleFormSave}
          shopifyProducts={shopifyProducts}
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
