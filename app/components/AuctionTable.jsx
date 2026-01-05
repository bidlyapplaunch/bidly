import React, { useState, useEffect, useMemo } from 'react';
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticatedFetch } from "@shopify/app-bridge/utilities";
import { format } from 'date-fns';
// Removed direct backend API imports - all calls now go through authenticated /api/* routes

const AuctionTable = ({ onEdit, onView, onRefresh, refreshTrigger }) => {
  const app = useAppBridge();

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
  
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState({
    status: '',
    shopifyProductId: ''
  });
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  useEffect(() => {
    if (authFetch) {
      fetchAuctions();
    }
  }, [currentPage, filters, refreshTrigger, authFetch]);

  const fetchAuctions = async () => {
    if (!authFetch) return; // Ensure authenticatedFetch is ready
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage,
        limit: pageSize,
        ...(filters.status && { status: filters.status }),
        ...(filters.shopifyProductId && { shopifyProductId: filters.shopifyProductId })
      });
      
      const response = await authFetch(`/api/auctions?${params}`);
      const data = await response.json();
      
      console.log('🔍 Fetched auctions response:', data);
      console.log('🔍 Data type:', typeof data);
      console.log('🔍 Is array:', Array.isArray(data));
      
      // Handle different response formats
      let auctionsArray = [];
      if (Array.isArray(data)) {
        auctionsArray = data;
      } else if (data && Array.isArray(data.auctions)) {
        auctionsArray = data.auctions;
      } else if (data && Array.isArray(data.data)) {
        auctionsArray = data.data;
      } else if (data && typeof data === 'object') {
        // If it's an object but not an array, try to extract auctions
        auctionsArray = Object.values(data).find(item => Array.isArray(item)) || [];
      }
      
      console.log('🔍 Processed auctions array:', auctionsArray);
      if (auctionsArray.length > 0) {
        console.log('🔍 First auction structure:', auctionsArray[0]);
        console.log('🔍 First auction ID:', auctionsArray[0]._id || auctionsArray[0].id);
      }
      
      setAuctions(auctionsArray);
      setTotalPages(1); // Simplified for now
      setTotalItems(auctionsArray.length);
    } catch (err) {
      setError('Failed to fetch auctions');
      console.error('Error fetching auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!authFetch) return; // Ensure authenticatedFetch is ready
    try {
      const response = await authFetch(`/api/auctions/${selectedAuction._id || selectedAuction.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete auction');
      
      setToastMessage('Auction deleted successfully');
      setShowToast(true);
      setDeleteModalOpen(false);
      setSelectedAuction(null);
      fetchAuctions();
      onRefresh?.();
    } catch (err) {
      setToastMessage('Failed to delete auction');
      setShowToast(true);
      console.error('Error deleting auction:', err);
    }
  };

  const handleDeleteClick = (auction) => {
    setSelectedAuction(auction);
    setDeleteModalOpen(true);
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'draft': 'warning',
      'active': 'success',
      'ended': 'critical',
      'cancelled': 'critical'
    };
    
    return (
      <s-badge status={statusColors[status] || 'info'}>
        {status?.toUpperCase() || 'UNKNOWN'}
      </s-badge>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'MMM dd, yyyy HH:mm');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <s-card>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <s-text variant="bodyMd">Loading auctions...</s-text>
        </div>
      </s-card>
    );
  }

  if (error) {
    return (
      <s-banner status="critical">
        <s-text variant="bodyMd">{error}</s-text>
      </s-banner>
    );
  }

  if (auctions.length === 0) {
    return (
      <s-card>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <s-text variant="headingMd">No auctions found</s-text>
          <s-text variant="bodyMd" tone="subdued">
            Create your first auction to get started.
          </s-text>
        </div>
      </s-card>
    );
  }

  return (
    <div>
      <s-card>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <s-text variant="headingMd">Auctions ({totalItems})</s-text>
            <s-button variant="secondary" onClick={() => setFilterModalOpen(true)}>
              Filter
            </s-button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e1e3e5' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                    <s-text variant="bodyMd">Product</s-text>
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                    <s-text variant="bodyMd">Status</s-text>
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                    <s-text variant="bodyMd">Current Bid</s-text>
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                    <s-text variant="bodyMd">End Time</s-text>
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                    <s-text variant="bodyMd">Actions</s-text>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(auctions) && auctions.map((auction) => (
                  <tr key={auction._id || auction.id} style={{ borderBottom: '1px solid #f1f2f3' }}>
                    <td style={{ padding: '12px' }}>
                      <div>
                        <s-text variant="bodyMd" fontWeight="semibold">
                          {auction.productName || `Product ${auction.shopifyProductId}`}
                        </s-text>
                        <br />
                        <s-text variant="bodySm" tone="subdued">
                          ID: {auction.shopifyProductId}
                        </s-text>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {getStatusBadge(auction.status)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <s-text variant="bodyMd">
                        {auction.currentBid ? formatCurrency(auction.currentBid) : formatCurrency(auction.startingBid)}
                      </s-text>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <s-text variant="bodyMd">
                        {formatDate(auction.endTime)}
                      </s-text>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <s-button 
                          variant="plain" 
                          size="micro"
                          onClick={() => onView?.(auction)}
                        >
                          View
                        </s-button>
                        <s-button 
                          variant="plain" 
                          size="micro"
                          onClick={() => onEdit?.(auction)}
                        >
                          Edit
                        </s-button>
                        <s-button 
                          variant="plain" 
                          size="micro"
                          tone="critical"
                          onClick={() => handleDeleteClick(auction)}
                        >
                          Delete
                        </s-button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!Array.isArray(auctions) && (
                  <tr>
                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center' }}>
                      <s-text variant="bodyMd" tone="subdued">
                        Error: Invalid data format received
                      </s-text>
                    </td>
                  </tr>
                )}
                {Array.isArray(auctions) && auctions.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center' }}>
                      <s-text variant="bodyMd" tone="subdued">
                        No auctions found
                      </s-text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <s-button 
                variant="plain" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </s-button>
              <s-text variant="bodyMd" style={{ margin: '0 16px', alignSelf: 'center' }}>
                Page {currentPage} of {totalPages}
              </s-text>
              <s-button 
                variant="plain" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </s-button>
            </div>
          )}
        </div>
      </s-card>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <s-modal
          open={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Delete Auction"
        >
          <s-modal-content>
            <s-text variant="bodyMd">
              Are you sure you want to delete this auction? This action cannot be undone.
            </s-text>
          </s-modal-content>
          <s-modal-footer>
            <s-button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </s-button>
            <s-button variant="primary" tone="critical" onClick={handleDelete}>
              Delete
            </s-button>
          </s-modal-footer>
        </s-modal>
      )}

      {/* Filter Modal */}
      {filterModalOpen && (
        <s-modal
          open={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          title="Filter Auctions"
        >
          <s-modal-content>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <s-text variant="bodyMd" fontWeight="semibold">Status</s-text>
                <s-select
                  value={filters.status}
                  onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                  options={[
                    { label: 'All Statuses', value: '' },
                    { label: 'Draft', value: 'draft' },
                    { label: 'Active', value: 'active' },
                    { label: 'Ended', value: 'ended' },
                    { label: 'Cancelled', value: 'cancelled' }
                  ]}
                />
              </div>
              <div>
                <s-text variant="bodyMd" fontWeight="semibold">Product ID</s-text>
                <s-text-field
                  value={filters.shopifyProductId}
                  onChange={(value) => setFilters(prev => ({ ...prev, shopifyProductId: value }))}
                  placeholder="Enter product ID"
                />
              </div>
            </div>
          </s-modal-content>
          <s-modal-footer>
            <s-button variant="secondary" onClick={() => setFilterModalOpen(false)}>
              Cancel
            </s-button>
            <s-button variant="primary" onClick={() => setFilterModalOpen(false)}>
              Apply Filters
            </s-button>
          </s-modal-footer>
        </s-modal>
      )}

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

export default AuctionTable;