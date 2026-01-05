import React, { useState, useEffect, useMemo } from 'react';
import { authenticatedFetch, getSessionToken } from "@shopify/app-bridge/utilities";
import AuctionTable from './AuctionTable';
import AuctionForm from './AuctionForm';
import AuctionDetails from './AuctionDetails';
import Analytics from './Analytics';
import { getEmbeddedAppBridgeApp } from "../utils/appBridgeClient";
// Removed direct backend API imports - all calls now go through authenticated /api/* routes

const Dashboard = ({ onLogout }) => {
  const app = useMemo(() => getEmbeddedAppBridgeApp(), []);

  const authFetch = useMemo(() => {
    if (!app) {
      return null;
    }
    try {
      return authenticatedFetch(app);
    } catch (e) {
      console.error('Failed to create authenticatedFetch:', e);
      return null;
    }
  }, [app]);
  
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
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    // Explicit getSessionToken call for Shopify Embedded App Checks
    if (app) getSessionToken(app).catch(() => {});
    
    if (authFetch) {
      fetchStats();
      fetchShopifyProducts();
      
      // WebSocket connections disabled - all backend calls must go through authenticated /api/* routes
      // Using polling instead for real-time updates
      const pollingInterval = setInterval(() => {
        fetchStats();
        setRefreshTrigger(prev => prev + 1);
      }, 30000); // Poll every 30 seconds
      
      return () => {
        clearInterval(pollingInterval);
      };
    }
  }, [app, authFetch]);

  const fetchStats = async () => {
    if (!authFetch) return; // Ensure authenticatedFetch is ready
    try {
      setLoading(true);
      const response = await authFetch('/api/auctions/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }
      
      const data = await response.json();
      setStats(data.data || data); // Handle both response formats
    } catch (err) {
      setError('Failed to load dashboard statistics');
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchShopifyProducts = async () => {
    if (!authFetch) return; // Ensure authenticatedFetch is ready
    try {
      // Fetch real products from Shopify API
      const response = await authFetch('/api/shopify/products?limit=20');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }
      
      const data = await response.json();
      setShopifyProducts(data || []);
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
    if (!authFetch) {
      console.error('authFetch not ready');
      return;
    }
    
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
      
      // Ensure relative URL - never use absolute URLs
      const relativePath = selectedAuction 
        ? `/api/auctions/${selectedAuction._id}`
        : '/api/auctions';
      
      console.log('🔗 Making request to relative path:', relativePath);
      
      if (selectedAuction) {
        // Update existing auction
        const response = await authFetch(relativePath, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(auctionData)
        });
        if (!response.ok) throw new Error('Failed to update auction');
        setToastMessage('Auction updated successfully');
      } else {
        // Create new auction - ensure relative URL
        const response = await authFetch(relativePath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(auctionData)
        });
        if (!response.ok) throw new Error('Failed to create auction');
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
      setToastMessage(`Error saving auction: ${error.message}`);
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
      <s-banner status="critical">
        <s-text variant="bodyMd">{error}</s-text>
      </s-banner>
    );
  }

  return (
    <div>
      {/* Statistics Cards */}
      <s-section heading="Auction Overview">
        <s-layout>
          <s-layout-section>
            <s-card>
              <div style={{ display: 'flex', gap: '32px', alignItems: 'center', padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <s-text variant="bodyMd" tone="subdued">Total Auctions</s-text>
                  <s-text variant="heading2xl">
                    {stats?.totalAuctions || 0}
                  </s-text>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <s-text variant="bodyMd" tone="subdued">Active Auctions</s-text>
                  <s-text variant="heading2xl" style={{ color: '#008060' }}>
                    {stats?.activeAuctions || 0}
                  </s-text>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <s-text variant="bodyMd" tone="subdued">Total Bids</s-text>
                  <s-text variant="heading2xl">
                    {stats?.totalBids || 0}
                  </s-text>
                </div>
              </div>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>

      {/* Action Buttons */}
      <s-section>
        <s-stack direction="inline" gap="base">
          <s-button variant="primary" onClick={handleCreateAuction}>
            Create Auction
          </s-button>
          <s-button onClick={handleRefresh}>
            Refresh
          </s-button>
        </s-stack>
      </s-section>

      {/* Tabbed Interface */}
      <s-section>
        <s-tabs>
          <s-tabs-list>
            <s-tabs-tab 
              selected={selectedTab === 0}
              onClick={() => setSelectedTab(0)}
            >
              📋 Auctions
            </s-tabs-tab>
            <s-tabs-tab 
              selected={selectedTab === 1}
              onClick={() => setSelectedTab(1)}
            >
              📊 Analytics
            </s-tabs-tab>
          </s-tabs-list>
          
          {selectedTab === 0 && (
            <s-tabs-panel>
              <AuctionTable
                onEdit={handleEditAuction}
                onView={handleViewAuction}
                onRefresh={handleRefresh}
                refreshTrigger={refreshTrigger}
              />
            </s-tabs-panel>
          )}
          {selectedTab === 1 && (
            <s-tabs-panel>
              <Analytics />
            </s-tabs-panel>
          )}
        </s-tabs>
      </s-section>

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
        <s-toast
          content={toastMessage}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
