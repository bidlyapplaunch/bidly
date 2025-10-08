import React, { useState, useEffect } from 'react';
import { AppProvider, Page, Card, Text, Button, Layout, Banner, Spinner, Modal, FormLayout, TextField, Toast, ButtonGroup, Badge, Frame } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import { auctionAPI } from './services/api';

function Dashboard() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    shopifyProductId: '',
    startTime: '',
    endTime: '',
    startingBid: '',
    buyNowPrice: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [editingAuction, setEditingAuction] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [auctionToDelete, setAuctionToDelete] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchAuctions();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await auctionAPI.getAuctionStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setStats(null); // Set null on error
    }
  };

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await auctionAPI.getAllAuctions();
      console.log('Fetched auctions:', response.data);
      setAuctions(response.data || []);
    } catch (err) {
      console.error('Error fetching auctions:', err);
      setError('Failed to fetch auctions. Make sure the backend is running on port 5000.');
      setAuctions([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAuction = () => {
    setEditingAuction(null);
    setFormModalOpen(true);
    setFormData({
      shopifyProductId: '',
      startTime: '',
      endTime: '',
      startingBid: '',
      buyNowPrice: ''
    });
  };

  const handleEditAuction = (auction) => {
    setEditingAuction(auction);
    setFormModalOpen(true);
    setFormData({
      shopifyProductId: auction.shopifyProductId,
      startTime: new Date(auction.startTime).toISOString().slice(0, 16),
      endTime: new Date(auction.endTime).toISOString().slice(0, 16),
      startingBid: auction.startingBid.toString(),
      buyNowPrice: auction.buyNowPrice ? auction.buyNowPrice.toString() : ''
    });
  };

  const handleDeleteAuction = (auction) => {
    setAuctionToDelete(auction);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      const auctionId = auctionToDelete._id || auctionToDelete.id;
      await auctionAPI.deleteAuction(auctionId);
      setToastMessage('Auction deleted successfully!');
      setShowToast(true);
      setDeleteModalOpen(false);
      setAuctionToDelete(null);
      fetchAuctions();
      fetchStats();
    } catch (err) {
      setError('Failed to delete auction: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleViewAuction = async (auction) => {
    const auctionId = auction._id || auction.id;
    console.log('Viewing auction:', auction);
    console.log('Auction ID:', auctionId);
    
    if (!auctionId) {
      setError('Auction ID is missing. Cannot view auction details.');
      return;
    }
    
    try {
      const response = await auctionAPI.getAuctionById(auctionId);
      setSelectedAuction(response.data);
      setDetailsModalOpen(true);
    } catch (err) {
      console.error('Error fetching auction details:', err);
      setError('Failed to fetch auction details: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleFormSubmit = async () => {
    try {
      setFormLoading(true);
      setError(null); // Clear any previous errors
      
      const auctionData = {
        shopifyProductId: formData.shopifyProductId,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        startingBid: parseFloat(formData.startingBid),
        ...(formData.buyNowPrice && { buyNowPrice: parseFloat(formData.buyNowPrice) })
      };

      if (editingAuction) {
        const auctionId = editingAuction._id || editingAuction.id;
        await auctionAPI.updateAuction(auctionId, auctionData);
        setToastMessage('Auction updated successfully!');
      } else {
        await auctionAPI.createAuction(auctionData);
        setToastMessage('Auction created successfully!');
      }
      
      // Close modal first
      setFormModalOpen(false);
      setEditingAuction(null);
      
      // Show success message
      setShowToast(true);
      
      // Refresh data
      await fetchAuctions();
      await fetchStats();
      
    } catch (err) {
      console.error('Error saving auction:', err);
      setError('Failed to save auction: ' + (err.response?.data?.message || err.message));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <Frame>
      <Page title="Auction Dashboard">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Text variant="headingLg">Welcome to Bidly Auction Admin</Text>
            <Text variant="bodyMd">
              Manage your auctions and monitor bid activity.
            </Text>
            <Button primary onClick={handleCreateAuction}>
              Create Auction
            </Button>
          </Card>
        </Layout.Section>

        {/* Statistics Section */}
        {stats && (
          <Layout.Section>
            <Layout>
              <Layout.Section oneThird>
                <Card sectioned>
                  <Text variant="headingMd">Total Auctions</Text>
                  <Text variant="headingLg">{stats.totalAuctions || 0}</Text>
                </Card>
              </Layout.Section>
              <Layout.Section oneThird>
                <Card sectioned>
                  <Text variant="headingMd">Active Auctions</Text>
                  <Text variant="headingLg">{stats.activeAuctions || 0}</Text>
                </Card>
              </Layout.Section>
              <Layout.Section oneThird>
                <Card sectioned>
                  <Text variant="headingMd">Closed Auctions</Text>
                  <Text variant="headingLg">{stats.closedAuctions || 0}</Text>
                </Card>
              </Layout.Section>
            </Layout>
          </Layout.Section>
        )}
        
        <Layout.Section>
          {error && (
            <Banner status="critical">
              <Text variant="bodyMd">{error}</Text>
            </Banner>
          )}
          
          {loading ? (
            <Card sectioned>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Spinner size="large" />
                <Text variant="bodyMd" style={{ marginTop: '1rem' }}>
                  Loading auctions...
                </Text>
              </div>
            </Card>
          ) : (
            <Card sectioned>
              <Text variant="headingMd">Auctions</Text>
              <Text variant="bodyMd">
                Found {auctions.length} auctions
              </Text>
              {auctions.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  {auctions.map((auction, index) => (
                    <div key={auction._id || auction.id || index} style={{ 
                      padding: '1rem', 
                      border: '1px solid #e1e3e5', 
                      marginBottom: '0.5rem',
                      borderRadius: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Text variant="bodyMd">
                            <strong>{auction.shopifyProductId}</strong>
                          </Text>
                          <div style={{ marginTop: '0.25rem' }}>
                            <Text variant="bodyMd" color="subdued">
                              Starting: ${auction.startingBid} | Current: ${auction.currentBid} | 
                              Bids: {auction.bidHistory?.length || 0}
                            </Text>
                          </div>
                          <div style={{ marginTop: '0.25rem' }}>
                            <Badge status={auction.status === 'active' ? 'success' : 'critical'}>
                              {auction.status}
                            </Badge>
                          </div>
                        </div>
                        <ButtonGroup>
                          <Button 
                            size="slim" 
                            onClick={() => handleViewAuction(auction)}
                          >
                            View
                          </Button>
                          <Button 
                            size="slim" 
                            onClick={() => handleEditAuction(auction)}
                            disabled={auction.bidHistory?.length > 0}
                          >
                            Edit
                          </Button>
                          <Button 
                            size="slim" 
                            destructive
                            onClick={() => handleDeleteAuction(auction)}
                            disabled={auction.bidHistory?.length > 0}
                          >
                            Delete
                          </Button>
                        </ButtonGroup>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </Layout.Section>
      </Layout>

      {/* Create/Edit Auction Modal */}
      <Modal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={editingAuction ? "Edit Auction" : "Create New Auction"}
        primaryAction={{
          content: editingAuction ? 'Update Auction' : 'Create Auction',
          onAction: handleFormSubmit,
          loading: formLoading
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setFormModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Shopify Product ID"
              value={formData.shopifyProductId}
              onChange={(value) => setFormData({ ...formData, shopifyProductId: value })}
              placeholder="e.g., prod_123"
            />
            <TextField
              label="Start Time"
              type="datetime-local"
              value={formData.startTime}
              onChange={(value) => setFormData({ ...formData, startTime: value })}
            />
            <TextField
              label="End Time"
              type="datetime-local"
              value={formData.endTime}
              onChange={(value) => setFormData({ ...formData, endTime: value })}
            />
            <TextField
              label="Starting Bid"
              type="number"
              value={formData.startingBid}
              onChange={(value) => setFormData({ ...formData, startingBid: value })}
              prefix="$"
              step="0.01"
            />
            <TextField
              label="Buy Now Price (Optional)"
              type="number"
              value={formData.buyNowPrice}
              onChange={(value) => setFormData({ ...formData, buyNowPrice: value })}
              prefix="$"
              step="0.01"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Auction Details Modal */}
      <Modal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Auction Details"
        primaryAction={{
          content: 'Close',
          onAction: () => setDetailsModalOpen(false)
        }}
        large
      >
        <Modal.Section>
          {selectedAuction && (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <Text variant="headingMd">Auction Information</Text>
                <div style={{ marginTop: '0.5rem' }}>
                  <Text variant="bodyMd"><strong>Product ID:</strong> {selectedAuction.shopifyProductId}</Text>
                  <Text variant="bodyMd"><strong>Status:</strong> 
                    <Badge status={selectedAuction.status === 'active' ? 'success' : 'critical'} style={{ marginLeft: '0.5rem' }}>
                      {selectedAuction.status}
                    </Badge>
                  </Text>
                  <Text variant="bodyMd"><strong>Start Time:</strong> {new Date(selectedAuction.startTime).toLocaleString()}</Text>
                  <Text variant="bodyMd"><strong>End Time:</strong> {new Date(selectedAuction.endTime).toLocaleString()}</Text>
                  <Text variant="bodyMd"><strong>Starting Bid:</strong> ${selectedAuction.startingBid}</Text>
                  <Text variant="bodyMd"><strong>Current Bid:</strong> ${selectedAuction.currentBid}</Text>
                  {selectedAuction.buyNowPrice && (
                    <Text variant="bodyMd"><strong>Buy Now Price:</strong> ${selectedAuction.buyNowPrice}</Text>
                  )}
                </div>
              </div>
              
              {selectedAuction.bidHistory && selectedAuction.bidHistory.length > 0 && (
                <div>
                  <Text variant="headingMd">Bid History</Text>
                  <div style={{ marginTop: '0.5rem' }}>
                    {selectedAuction.bidHistory
                      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                      .map((bid, index) => (
                        <div key={index} style={{ 
                          padding: '0.5rem', 
                          border: '1px solid #e1e3e5', 
                          marginBottom: '0.25rem',
                          borderRadius: '4px'
                        }}>
                          <Text variant="bodyMd">
                            <strong>{bid.bidder}</strong> - ${bid.amount} - {new Date(bid.timestamp).toLocaleString()}
                          </Text>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Section>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Auction"
        primaryAction={{
          content: 'Delete',
          onAction: confirmDelete,
          destructive: true
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setDeleteModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <Text variant="bodyMd">
            Are you sure you want to delete this auction? This action cannot be undone.
            {auctionToDelete?.bidHistory?.length > 0 && (
              <Text variant="bodyMd" color="critical">
                Note: This auction has bids and cannot be deleted.
              </Text>
            )}
          </Text>
        </Modal.Section>
      </Modal>

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
}

function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}

export default App;