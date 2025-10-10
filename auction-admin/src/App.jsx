import React, { useState, useEffect } from 'react';
import { AppProvider, Page, Card, Text, Button, Layout, Banner, Spinner, Modal, FormLayout, TextField, Toast, ButtonGroup, Badge, Frame } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import { auctionAPI } from './services/api';
import socketService from './services/socket';

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
  const [lastAutoCheck, setLastAutoCheck] = useState(null);
  const [isAutoChecking, setIsAutoChecking] = useState(false);

  useEffect(() => {
    fetchAuctions();
    fetchStats();
    
    // Check for expired auctions every minute
    const interval = setInterval(() => {
      checkExpiredAuctions();
    }, 60000); // Check every minute
    
    // Set up WebSocket connection for real-time updates
    socketService.connect();
    
    // Listen for real-time bid updates
    const handleBidUpdate = (bidData) => {
      console.log('📡 Received real-time bid update:', bidData);
      
      // Update the auction in the local state
      setAuctions(prevAuctions => 
        prevAuctions.map(auction => 
          auction._id === bidData.auctionId || auction.id === bidData.auctionId
            ? {
                ...auction,
                currentBid: bidData.currentBid,
                bidHistory: bidData.bidHistory
              }
            : auction
        )
      );
      
      // Show notification for new bid
      setToastMessage(`New bid: $${bidData.amount} by ${bidData.bidder}`);
      setShowToast(true);
      
      // Refresh stats to update counts
      fetchStats();
    };
    
    socketService.onBidUpdate(handleBidUpdate);
    
    return () => {
      clearInterval(interval);
      socketService.offBidUpdate(handleBidUpdate);
      socketService.disconnect();
    };
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

  const checkExpiredAuctions = async () => {
    try {
      setIsAutoChecking(true);
      const now = new Date();
      setLastAutoCheck(now);
      
      // Fetch fresh auction data first
      const response = await auctionAPI.getAllAuctions();
      const currentAuctions = response.data;
      
      // Find auctions that need status updates
      const expiredAuctions = currentAuctions.filter(auction => {
        const endTime = new Date(auction.endTime);
        return auction.status === 'active' && endTime <= now;
      });
      
      const pendingToActiveAuctions = currentAuctions.filter(auction => {
        const startTime = new Date(auction.startTime);
        return auction.status === 'pending' && startTime <= now;
      });
      
      if (expiredAuctions.length > 0) {
        // Close each expired auction
        for (const auction of expiredAuctions) {
          try {
            const auctionId = auction._id || auction.id;
            // Set status to 'ended' for auctions that ended naturally
            await auctionAPI.updateAuction(auctionId, { status: 'ended' });
          } catch (err) {
            console.error(`Failed to end auction ${auction.shopifyProductId}:`, err);
          }
        }
        
        // Refresh data to show updated status
        await fetchAuctions();
        await fetchStats();
        
        if (expiredAuctions.length === 1) {
          setToastMessage(`1 auction has ended automatically`);
        } else {
          setToastMessage(`${expiredAuctions.length} auctions have ended automatically`);
        }
        setShowToast(true);
      }
      
      // Activate pending auctions that have reached their start time
      if (pendingToActiveAuctions.length > 0) {
        for (const auction of pendingToActiveAuctions) {
          try {
            const auctionId = auction._id || auction.id;
            await auctionAPI.updateAuction(auctionId, { status: 'active' });
          } catch (err) {
            console.error(`Failed to activate auction ${auction.shopifyProductId}:`, err);
          }
        }
        
        // Refresh data to show updated status
        await fetchAuctions();
        await fetchStats();
        
        if (pendingToActiveAuctions.length === 1) {
          setToastMessage(`1 auction has started and been activated automatically`);
        } else {
          setToastMessage(`${pendingToActiveAuctions.length} auctions have started and been activated automatically`);
        }
        setShowToast(true);
      }
    } catch (err) {
      console.error('Error checking expired auctions:', err);
    } finally {
      setIsAutoChecking(false);
    }
  };

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await auctionAPI.getAllAuctions();
      setAuctions(response.data || []);
    } catch (err) {
      console.error('Error fetching auctions:', err);
      setError('Failed to fetch auctions. Make sure the backend is running on port 5002.');
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
    
    // Convert dates to local datetime-local format
    const startTime = new Date(auction.startTime);
    const endTime = new Date(auction.endTime);
    
    // Adjust for timezone offset to get local time
    const startTimeLocal = new Date(startTime.getTime() - startTime.getTimezoneOffset() * 60000);
    const endTimeLocal = new Date(endTime.getTime() - endTime.getTimezoneOffset() * 60000);
    
    setFormData({
      shopifyProductId: auction.shopifyProductId,
      startTime: startTimeLocal.toISOString().slice(0, 16),
      endTime: endTimeLocal.toISOString().slice(0, 16),
      startingBid: auction.startingBid.toString(),
      buyNowPrice: auction.buyNowPrice ? auction.buyNowPrice.toString() : ''
    });
    
    console.log('Original auction times:');
    console.log('  Start:', auction.startTime);
    console.log('  End:', auction.endTime);
    console.log('Converted form times:');
    console.log('  Start:', startTimeLocal.toISOString().slice(0, 16));
    console.log('  End:', endTimeLocal.toISOString().slice(0, 16));
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

  const handleCloseAuction = async (auction) => {
    try {
      const auctionId = auction._id || auction.id;
      await auctionAPI.closeAuction(auctionId);
      setToastMessage('Auction closed successfully!');
      setShowToast(true);
      fetchAuctions();
      fetchStats();
    } catch (err) {
      setError('Failed to close auction: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRelistAuction = (auction) => {
    // Pre-fill form with auction data for relisting
    const now = new Date();
    const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    setFormData({
      shopifyProductId: auction.shopifyProductId,
      startTime: now.toISOString().slice(0, 16), // Format for datetime-local
      endTime: futureTime.toISOString().slice(0, 16), // Format for datetime-local
      startingBid: auction.startingBid,
      buyNowPrice: auction.buyNowPrice || ''
    });
    
    setEditingAuction(auction);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      setFormLoading(true);
      setError(null); // Clear any previous errors
      
      // For editing, check if auction has bids to determine what can be updated
      const hasBids = editingAuction && editingAuction.bidHistory && editingAuction.bidHistory.length > 0;
      
      const auctionData = editingAuction ? {
        // If auction has bids, only allow buyNowPrice updates
        ...(hasBids ? {
          ...(formData.buyNowPrice && { buyNowPrice: parseFloat(formData.buyNowPrice) })
        } : {
          // If no bids, allow all field updates
          shopifyProductId: formData.shopifyProductId,
          startTime: new Date(formData.startTime).toISOString(),
          endTime: new Date(formData.endTime).toISOString(),
          startingBid: parseFloat(formData.startingBid),
          ...(formData.buyNowPrice && { buyNowPrice: parseFloat(formData.buyNowPrice) })
        })
      } : {
        // For new auctions, send all fields
        shopifyProductId: formData.shopifyProductId,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        startingBid: parseFloat(formData.startingBid),
        ...(formData.buyNowPrice && { buyNowPrice: parseFloat(formData.buyNowPrice) })
      };

      console.log('Form data:', formData);
      console.log('Auction has bids:', hasBids);
      console.log('Auction data to send:', auctionData);
      console.log('Editing auction bid history:', editingAuction?.bidHistory);
      console.log('Bid history length:', editingAuction?.bidHistory?.length);
      
      // Debug the date conversion
      console.log('Date conversion debug:');
      console.log('  Form startTime:', formData.startTime);
      console.log('  Form endTime:', formData.endTime);
      console.log('  Parsed startTime:', new Date(formData.startTime));
      console.log('  Parsed endTime:', new Date(formData.endTime));
      console.log('  Start ISO:', new Date(formData.startTime).toISOString());
      console.log('  End ISO:', new Date(formData.endTime).toISOString());
      console.log('  Time difference (ms):', new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime());
      console.log('  Time difference (hours):', (new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime()) / (1000 * 60 * 60));
      
      // Check if dates are valid
      const startDate = new Date(formData.startTime);
      const endDate = new Date(formData.endTime);
      console.log('  Start date valid:', !isNaN(startDate.getTime()));
      console.log('  End date valid:', !isNaN(endDate.getTime()));
      console.log('  Start < End:', startDate < endDate);
      console.log('  Start <= End:', startDate <= endDate);

      if (editingAuction) {
        const auctionId = editingAuction._id || editingAuction.id;
        console.log('Updating auction with ID:', auctionId);
        console.log('Editing auction:', editingAuction);
        
        // Check if this is a relist operation (auction is ended/closed and has no bids)
        const isRelist = (editingAuction.status === 'ended' || editingAuction.status === 'closed') && 
                        (!editingAuction.bidHistory || editingAuction.bidHistory.length === 0);
        
        if (isRelist) {
          await auctionAPI.relistAuction(auctionId, auctionData);
          setToastMessage('Auction relisted successfully!');
        } else {
          await auctionAPI.updateAuction(auctionId, auctionData);
          setToastMessage('Auction updated successfully!');
        }
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
      console.error('Error response:', err.response?.data);
      console.error('Validation errors:', err.response?.data?.errors);
      console.error('Full error details:', JSON.stringify(err.response?.data?.errors, null, 2));
      
      // Show detailed validation errors
      if (err.response?.data?.errors) {
        const errorDetails = err.response.data.errors.map(error => 
          `${error.field || 'Field'}: ${error.message}`
        ).join(', ');
        setError(`Validation failed: ${errorDetails}`);
      } else {
        setError('Failed to save auction: ' + (err.response?.data?.message || err.message));
      }
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
            <Button onClick={checkExpiredAuctions} style={{ marginLeft: '0.5rem' }}>
              Check Expired Now
            </Button>
            {lastAutoCheck && (
              <Text variant="bodySm" style={{ marginTop: '0.5rem', color: '#6B7280' }}>
                {isAutoChecking ? 'Checking for expired auctions...' : `Last auto-check: ${lastAutoCheck.toLocaleTimeString()}`}
              </Text>
            )}
          </Card>
        </Layout.Section>

        {/* Statistics Section */}
        {stats && (
          <Layout.Section>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <Card sectioned style={{ flex: 1, padding: '0.75rem' }}>
                <Text variant="bodyMd" fontWeight="bold">Total</Text>
                <Text variant="headingMd">{stats.totalAuctions || 0}</Text>
              </Card>
              <Card sectioned style={{ flex: 1, padding: '0.75rem' }}>
                <Text variant="bodyMd" fontWeight="bold">Pending</Text>
                <Text variant="headingMd">{stats.pendingAuctions || 0}</Text>
              </Card>
              <Card sectioned style={{ flex: 1, padding: '0.75rem' }}>
                <Text variant="bodyMd" fontWeight="bold">Active</Text>
                <Text variant="headingMd">{stats.activeAuctions || 0}</Text>
              </Card>
              <Card sectioned style={{ flex: 1, padding: '0.75rem' }}>
                <Text variant="bodyMd" fontWeight="bold">Ended</Text>
                <Text variant="headingMd">{stats.endedAuctions || 0}</Text>
              </Card>
              <Card sectioned style={{ flex: 1, padding: '0.75rem' }}>
                <Text variant="bodyMd" fontWeight="bold">Closed</Text>
                <Text variant="headingMd">{stats.closedAuctions || 0}</Text>
              </Card>
            </div>
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
                            <Badge 
                              status={
                                auction.status === 'active' ? 'success' : 
                                auction.status === 'pending' ? 'info' : 
                                auction.status === 'ended' ? 'success' :
                                'critical'
                              }
                              style={{
                                backgroundColor: 
                                  auction.status === 'pending' ? '#FFA500' : 
                                  auction.status === 'active' ? '#4CAF50' : 
                                  auction.status === 'ended' ? '#2196F3' :
                                  '#F44336',
                                color: 'white',
                                fontWeight: 'bold'
                              }}
                            >
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
                          
                          {/* Show different buttons based on auction status and bid history */}
                          {auction.status === 'pending' ? (
                            <>
                              <Button 
                                size="slim" 
                                onClick={() => handleEditAuction(auction)}
                              >
                                Edit
                              </Button>
                              <Button 
                                size="slim" 
                                onClick={() => handleCloseAuction(auction)}
                              >
                                Close
                              </Button>
                              <Button 
                                size="slim" 
                                destructive
                                onClick={() => handleDeleteAuction(auction)}
                              >
                                Delete
                              </Button>
                            </>
                          ) : auction.status === 'active' ? (
                            <>
                              <Button 
                                size="slim" 
                                onClick={() => handleEditAuction(auction)}
                                disabled={auction.bidHistory?.length > 0}
                              >
                                Edit
                              </Button>
                              <Button 
                                size="slim" 
                                onClick={() => handleCloseAuction(auction)}
                              >
                                Close
                              </Button>
                              <Button 
                                size="slim" 
                                destructive
                                onClick={() => handleDeleteAuction(auction)}
                                disabled={auction.bidHistory?.length > 0}
                              >
                                Delete
                              </Button>
                            </>
                          ) : auction.status === 'ended' ? (
                            // For ended auctions (naturally ended with bids)
                            <>
                              {(!auction.bidHistory || auction.bidHistory.length === 0) ? (
                                <>
                                  <Button 
                                    size="slim" 
                                    onClick={() => handleRelistAuction(auction)}
                                  >
                                    Relist
                                  </Button>
                                  <Button 
                                    size="slim" 
                                    destructive
                                    onClick={() => handleDeleteAuction(auction)}
                                  >
                                    Delete
                                  </Button>
                                </>
                              ) : (
                                // Ended auction with bids - only view and delete
                                <Button 
                                  size="slim" 
                                  destructive
                                  onClick={() => handleDeleteAuction(auction)}
                                >
                                  Delete
                                </Button>
                              )}
                            </>
                          ) : (
                            // For closed auctions (manually closed by admin)
                            <>
                              {(!auction.bidHistory || auction.bidHistory.length === 0) ? (
                                <>
                                  <Button 
                                    size="slim" 
                                    onClick={() => handleRelistAuction(auction)}
                                  >
                                    Relist
                                  </Button>
                                  <Button 
                                    size="slim" 
                                    destructive
                                    onClick={() => handleDeleteAuction(auction)}
                                  >
                                    Delete
                                  </Button>
                                </>
                              ) : (
                                // Closed auction with bids - only view and delete
                                <Button 
                                  size="slim" 
                                  destructive
                                  onClick={() => handleDeleteAuction(auction)}
                                >
                                  Delete
                                </Button>
                              )}
                            </>
                          )}
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
        title={editingAuction ? 
          ((editingAuction.status === 'ended' || editingAuction.status === 'closed') && (!editingAuction.bidHistory || editingAuction.bidHistory.length === 0) ? 
            "Relist Auction" : "Edit Auction") : 
          "Create New Auction"}
        primaryAction={{
          content: editingAuction ? 
            ((editingAuction.status === 'ended' || editingAuction.status === 'closed') && (!editingAuction.bidHistory || editingAuction.bidHistory.length === 0) ? 
              'Relist Auction' : 'Update Auction') : 
            'Create Auction',
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
              disabled={editingAuction && editingAuction.bidHistory && editingAuction.bidHistory.length > 0}
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
                    <Badge 
                      status={
                        selectedAuction.status === 'active' ? 'success' : 
                        selectedAuction.status === 'pending' ? 'info' : 
                        selectedAuction.status === 'ended' ? 'success' :
                        'critical'
                      } 
                      style={{ 
                        marginLeft: '0.5rem',
                        backgroundColor: 
                          selectedAuction.status === 'pending' ? '#FFA500' : 
                          selectedAuction.status === 'active' ? '#4CAF50' : 
                          selectedAuction.status === 'ended' ? '#2196F3' :
                          '#F44336',
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    >
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