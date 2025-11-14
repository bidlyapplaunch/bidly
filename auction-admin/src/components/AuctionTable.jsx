import React, { useState, useEffect } from 'react';
import {
  Card,
  DataTable,
  Button,
  Badge,
  Modal,
  Text,
  ButtonGroup,
  Toast,
  Frame,
  Banner,
  EmptyState,
  Pagination,
  Filters,
  ChoiceList,
  TextField,
  Select
} from '@shopify/polaris';
import { EditMinor, DeleteMinor, ViewMinor, StoreMinor } from '@shopify/polaris-icons';
import { format } from 'date-fns';
import { auctionAPI } from '../services/api';

const AuctionTable = ({ onEdit, onView, onRefresh, refreshTrigger }) => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize] = useState(10);
  
  // Filters state
  const [filters, setFilters] = useState({
    status: '',
    shopifyProductId: ''
  });
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  useEffect(() => {
    fetchAuctions();
  }, [currentPage, filters, refreshTrigger]);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: currentPage,
        limit: pageSize,
        ...(filters.status && { status: filters.status }),
        ...(filters.shopifyProductId && { shopifyProductId: filters.shopifyProductId })
      };
      
      const response = await auctionAPI.getAllAuctions(params);
      console.log('🔍 Fetched auctions:', response.data);
      if (response.data && response.data.length > 0) {
        console.log('🔍 First auction structure:', response.data[0]);
        console.log('🔍 First auction ID:', response.data[0]._id || response.data[0].id);
      }
      setAuctions(response.data || []);
      setTotalPages(response.pagination?.pages || 1);
      setTotalItems(response.pagination?.total || 0);
    } catch (err) {
      setError('Failed to fetch auctions');
      console.error('Error fetching auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      console.log('🗑️ Delete auction debug:', {
        selectedAuction,
        auctionId: selectedAuction?.id,
        auctionIdAlt: selectedAuction?._id
      });
      
      const auctionId = selectedAuction?.id || selectedAuction?._id;
      if (!auctionId) {
        throw new Error('No auction ID found');
      }
      
      await auctionAPI.deleteAuction(auctionId);
      setToastMessage('Auction deleted successfully');
      setShowToast(true);
      setDeleteModalOpen(false);
      setSelectedAuction(null);
      fetchAuctions();
      onRefresh?.();
    } catch (err) {
      setError('Failed to delete auction');
      console.error('Error deleting auction:', err);
    }
  };

  const handleClose = async () => {
    try {
      const auctionId = selectedAuction?._id || selectedAuction?.id;
      
      if (!auctionId) {
        console.error('❌ No auction ID found in selectedAuction:', selectedAuction);
        setError('Failed to close auction: Auction ID not found');
        return;
      }
      
      console.log('🔍 Closing auction with ID:', auctionId);
      await auctionAPI.closeAuction(auctionId);
      setToastMessage('Auction closed successfully');
      setShowToast(true);
      setCloseModalOpen(false);
      setSelectedAuction(null);
      fetchAuctions();
      onRefresh?.();
    } catch (err) {
      setError('Failed to close auction');
      console.error('Error closing auction:', err);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { status: 'warning', children: 'Pending' },
      active: { status: 'success', children: 'Active' },
      ended: { status: 'info', children: 'Ended' },
      closed: { status: 'critical', children: 'Closed' }
    };
    return <Badge {...statusMap[status]} />;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date, formatStr = 'MMM dd, yyyy HH:mm') => {
    return format(new Date(date), formatStr);
  };

  const rows = auctions.map((auction) => [
    // Product Name - truncated for better fit
    (auction.productData?.title || auction.shopifyProductId || 'Unknown Product').substring(0, 30) + 
    ((auction.productData?.title || auction.shopifyProductId || 'Unknown Product').length > 30 ? '...' : ''),
    // Start Date - more compact format
    formatDate(auction.startTime, 'dd/MM HH:mm'),
    // End Date - more compact format
    formatDate(auction.endTime, 'dd/MM HH:mm'),
    // Starting Bid
    formatCurrency(auction.startingBid),
    // Current Bid
    formatCurrency(auction.currentBid),
    // Buy Now Price
    auction.buyNowPrice ? formatCurrency(auction.buyNowPrice) : '-',
    // Reserve Price
    auction.reservePrice ? formatCurrency(auction.reservePrice) : '-',
    // Status
    getStatusBadge(auction.status),
    // Bid Count
    auction.bidHistory?.length || 0,
    <ButtonGroup key={auction.id}>
      <Button
        icon={StoreMinor}
        onClick={() => handleViewInStore(auction)}
        size="slim"
        accessibilityLabel="View in store"
      />
      <Button
        icon={ViewMinor}
        onClick={() => onView(auction)}
        size="slim"
        accessibilityLabel="View auction details"
      />
      <Button
        icon={EditMinor}
        onClick={() => onEdit(auction)}
        size="slim"
        accessibilityLabel="Edit auction"
      />
      <Button
        icon={DeleteMinor}
        onClick={() => {
          setSelectedAuction(auction);
          setDeleteModalOpen(true);
        }}
        size="slim"
        destructive
        accessibilityLabel="Delete auction"
      />
      {auction.status === 'active' && (
        <Button
          onClick={() => {
            setSelectedAuction(auction);
            setCloseModalOpen(true);
          }}
          size="slim"
          accessibilityLabel="Close auction"
        >
          Close
        </Button>
      )}
    </ButtonGroup>
  ]);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    setFilterModalOpen(false);
  };

  const clearFilters = () => {
    setFilters({ status: '', shopifyProductId: '' });
    setCurrentPage(1);
  };

  const handleViewInStore = async (auction) => {
    try {
      console.log('🏪 Opening product in store for auction:', auction.id);
      
      // Get the shop domain from the current context
      const urlParams = new URLSearchParams(window.location.search);
      const shop = urlParams.get('shop');
      
      if (!shop) {
        console.error('❌ No shop domain found in URL');
        setToastMessage('Error: No shop domain found');
        setShowToast(true);
        return;
      }

      // Get the Shopify product ID
      const shopifyProductId = auction.shopifyProductId;
      if (!shopifyProductId) {
        console.error('❌ No Shopify product ID found for auction:', auction.id);
        setToastMessage('Error: No product ID found for this auction');
        setShowToast(true);
        return;
      }

      // Try to get product details from Shopify API
      try {
        const response = await auctionAPI.getShopifyProduct(shopifyProductId, shop);
        const product = response.data;
        
        if (product && product.handle) {
          // Use the product handle to construct the URL
          const productUrl = `https://${shop}/products/${product.handle}`;
          console.log('🔗 Opening Shopify product URL:', productUrl);
          window.open(productUrl, '_blank');
        } else {
          // Fallback: try to construct URL with product ID
          const productUrl = `https://${shop}/products/${shopifyProductId}`;
          console.log('🔗 Opening Shopify product URL (fallback):', productUrl);
          window.open(productUrl, '_blank');
        }
      } catch (apiError) {
        console.warn('⚠️ Could not fetch product details, using fallback URL:', apiError);
        // Fallback: construct URL with product ID
        const productUrl = `https://${shop}/products/${shopifyProductId}`;
        console.log('🔗 Opening Shopify product URL (fallback):', productUrl);
        window.open(productUrl, '_blank');
      }
      
    } catch (error) {
      console.error('❌ Error opening product in store:', error);
      setToastMessage('Error opening product in store');
      setShowToast(true);
    }
  };

  if (error) {
    return (
      <Card>
        <Banner status="critical">
          <Text variant="bodyMd">{error}</Text>
        </Banner>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <Text variant="bodyMd">Loading auctions...</Text>
        </div>
      </Card>
    );
  }

  if (auctions.length === 0) {
    return (
      <Card>
        <EmptyState
          heading="No auctions found"
          action={{
            content: 'Create auction',
            onAction: () => onEdit(null)
          }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <Text variant="bodyMd">
            Get started by creating your first auction.
          </Text>
        </EmptyState>
      </Card>
    );
  }

  return (
    <Frame>
      <Card>
        <div style={{ marginBottom: '1rem' }}>
          <Button onClick={() => setFilterModalOpen(true)}>
            Filter
          </Button>
          {(filters.status || filters.shopifyProductId) && (
            <Button onClick={clearFilters} style={{ marginLeft: '0.5rem' }}>
              Clear filters
            </Button>
          )}
        </div>

        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <DataTable
            columnContentTypes={[
              'text',
              'text',
              'text',
              'text',
              'text',
              'text',
              'text',
              'text',
              'numeric',
              'text'
            ]}
            headings={[
              'Product',
              'Start',
              'End',
              'Start Bid',
              'Current Bid',
              'Buy Now',
              'Reserve',
              'Status',
              'Bids',
              'Actions'
            ]}
            rows={rows}
            footerContent={`Showing ${auctions.length} of ${totalItems} auctions`}
          />
        </div>

        {totalPages > 1 && (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Pagination
              hasPrevious={currentPage > 1}
              onPrevious={() => setCurrentPage(currentPage - 1)}
              hasNext={currentPage < totalPages}
              onNext={() => setCurrentPage(currentPage + 1)}
              label={`Page ${currentPage} of ${totalPages}`}
            />
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Auction"
        primaryAction={{
          content: 'Delete',
          onAction: handleDelete,
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
            {selectedAuction?.bidHistory?.length > 0 && (
              <Text variant="bodyMd" color="critical">
                Note: This auction has bids and cannot be deleted.
              </Text>
            )}
          </Text>
        </Modal.Section>
      </Modal>

      {/* Close Auction Modal */}
      <Modal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title="Close Auction"
        primaryAction={{
          content: 'Close Auction',
          onAction: handleClose
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setCloseModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <Text variant="bodyMd">
            Are you sure you want to close this auction? This will prevent new bids from being placed.
          </Text>
        </Modal.Section>
      </Modal>

      {/* Filter Modal */}
      <Modal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filter Auctions"
        primaryAction={{
          content: 'Apply Filters',
          onAction: () => handleFiltersChange(filters)
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setFilterModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <div style={{ marginBottom: '1rem' }}>
            <Text variant="headingMd">Status</Text>
            <ChoiceList
              title=""
              choices={[
                { label: 'Active', value: 'active' },
                { label: 'Closed', value: 'closed' }
              ]}
              selected={filters.status ? [filters.status] : []}
              onChange={(value) => setFilters({ ...filters, status: value[0] || '' })}
            />
          </div>
          <div>
            <TextField
              label="Shopify Product ID"
              value={filters.shopifyProductId}
              onChange={(value) => setFilters({ ...filters, shopifyProductId: value })}
              placeholder="Enter product ID"
            />
          </div>
        </Modal.Section>
      </Modal>

      {/* Toast */}
      {showToast && (
        <Toast
          content={toastMessage}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </Frame>
  );
};

export default AuctionTable;
