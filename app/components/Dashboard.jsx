import React, { useState } from 'react';
import { useFetcher, useLoaderData, Form } from 'react-router';
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Banner,
  Tabs,
  InlineStack,
  BlockStack
} from '@shopify/polaris';
import AuctionTable from './AuctionTable';
import AuctionForm from './AuctionForm';
import AuctionDetails from './AuctionDetails';
import Analytics from './Analytics';

const Dashboard = () => {
  const { stats, auctions: initialAuctions, shopDomain } = useLoaderData();
  const fetcher = useFetcher();
  
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Use fetcher data if available, otherwise use initial data
  const auctions = fetcher.data?.auctions || initialAuctions;
  const currentStats = fetcher.data?.stats || stats;

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
    const formData = new FormData();
    Object.keys(auctionData).forEach(key => {
      if (auctionData[key] !== null && auctionData[key] !== undefined) {
        formData.append(key, typeof auctionData[key] === 'object' 
          ? JSON.stringify(auctionData[key]) 
          : auctionData[key].toString()
        );
      }
    });

    const url = selectedAuction 
      ? `/api/auctions/${selectedAuction._id || selectedAuction.id}`
      : '/api/auctions';
    
    const response = await fetch(url, {
      method: selectedAuction ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auctionData)
    });

    if (!response.ok) {
      setToastMessage('Error saving auction');
      setShowToast(true);
      return;
    }

    setToastMessage(selectedAuction ? 'Auction updated successfully' : 'Auction created successfully');
    setShowToast(true);
    setFormModalOpen(false);
    setSelectedAuction(null);
    
    // Refresh data
    fetcher.load('/app');
  };

  const handleRefresh = () => {
    fetcher.load('/app');
  };

  return (
    <Page
      title="Auction Dashboard"
      subtitle={shopDomain ? `(${shopDomain})` : undefined}
      primaryAction={{
        content: 'Create Auction',
        onAction: handleCreateAuction
      }}
      secondaryActions={[
        ...(shopDomain
          ? [
              {
                content: 'Auction Marketplace',
                url: `https://${shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/apps/bidly`,
                external: true,
              },
            ]
          : []),
        {
          content: 'Refresh',
          onAction: handleRefresh
        }
      ]}
    >
      <BlockStack gap="400">
        {/* Statistics Cards */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Auction Overview</Text>
                <InlineStack gap="400" align="start">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" tone="subdued">Total Auctions</Text>
                    <Text variant="heading2xl">{currentStats?.totalAuctions || 0}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="bodyMd" tone="subdued">Active Auctions</Text>
                    <Text variant="heading2xl" tone="success">{currentStats?.activeAuctions || 0}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="bodyMd" tone="subdued">Total Bids</Text>
                    <Text variant="heading2xl">{currentStats?.totalBids || 0}</Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Tabbed Interface */}
        <Card>
          <Tabs
            tabs={[
              { id: 'auctions', content: 'Auctions' },
              { id: 'analytics', content: 'Analytics' }
            ]}
            selected={selectedTab}
            onSelect={(selectedTabIndex) => setSelectedTab(selectedTabIndex)}
          >
            {selectedTab === 0 && (
              <AuctionTable
                initialAuctions={auctions}
                onEdit={handleEditAuction}
                onView={handleViewAuction}
                onRefresh={handleRefresh}
              />
            )}
            {selectedTab === 1 && (
              <Analytics />
            )}
          </Tabs>
        </Card>

        {/* Modals */}
        <AuctionForm
          isOpen={formModalOpen}
          onClose={() => {
            setFormModalOpen(false);
            setSelectedAuction(null);
          }}
          auction={selectedAuction}
          onSave={handleFormSave}
        />

        <AuctionDetails
          isOpen={detailsModalOpen}
          onClose={() => {
            setDetailsModalOpen(false);
            setSelectedAuction(null);
          }}
          auction={selectedAuction}
          onRefresh={handleRefresh}
        />
      </BlockStack>
    </Page>
  );
};

export default Dashboard;
