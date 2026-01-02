import React, { useState, useEffect } from 'react';
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticatedFetch, getSessionToken } from "@shopify/app-bridge/utilities";
import AuctionTable from './AuctionTable';
import AuctionForm from './AuctionForm';
import AuctionDetails from './AuctionDetails';
import Analytics from './Analytics';
import { auctionAPI, shopifyAPI, analyticsAPI } from '../services/api';
import socketService from '../services/socket';

const Dashboard = ({ onLogout }) => {
  const app = useAppBridge();
  const authFetch = authenticatedFetch(app);
  
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
    if (app) {
      getSessionToken(app).catch(() => {
        // Silently fail - token generation happens automatically
      });
    }
    
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
      const response = await authFetch('/api/auctions/stats');
      const data = await response.json();
      setStats(data);
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
      const response = await authFetch('/api/shopify/products?limit=20');
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
      
      // Use regular fetch for now
      
      if (selectedAuction) {
        // Update existing auction
        const response = await authFetch(`/api/auctions/${selectedAuction._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(auctionData)
        });
        if (!response.ok) throw new Error('Failed to update auction');
        setToastMessage('Auction updated successfully');
      } else {
        // Create new auction
        const response = await authFetch('/api/auctions', {
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
