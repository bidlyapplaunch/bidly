import React, { useEffect, useState } from 'react';
import {
  Card,
  DataTable,
  Button,
  Badge,
  Modal,
  Text,
  Banner,
  EmptyState,
  Pagination,
  ChoiceList,
  TextField
} from '@shopify/polaris';
import { EditMinor, DeleteMinor, ViewMinor, StoreMinor } from '@shopify/polaris-icons';
import { format } from 'date-fns';
import { auctionAPI } from '../services/api';
import AppBridgeToast from './AppBridgeToast';
import useAdminI18n from '../hooks/useAdminI18n';

const AuctionTable = ({ onEdit, onView, onRefresh, refreshTrigger }) => {
  const i18n = useAdminI18n();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
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
  }, [currentPage, filters, refreshTrigger, i18n]);

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
      setError(i18n.translate('admin.auctions.table.errors.fetch'));
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
      setToastMessage(i18n.translate('admin.auctions.table.toast.deleted'));
      setToastError(false);
      setShowToast(true);
      setDeleteModalOpen(false);
      setSelectedAuction(null);
      fetchAuctions();
      onRefresh?.();
    } catch (err) {
      setError(i18n.translate('admin.auctions.table.errors.delete'));
      console.error('Error deleting auction:', err);
    }
  };

  const handleClose = async () => {
    try {
      const auctionId = selectedAuction?._id || selectedAuction?.id;
      
      if (!auctionId) {
        console.error('❌ No auction ID found in selectedAuction:', selectedAuction);
        setError(i18n.translate('admin.auctions.table.errors.closeMissingId'));
        return;
      }
      
      console.log('🔍 Closing auction with ID:', auctionId);
      await auctionAPI.closeAuction(auctionId);
      setToastMessage(i18n.translate('admin.auctions.table.toast.closed'));
      setToastError(false);
      setShowToast(true);
      setCloseModalOpen(false);
      setSelectedAuction(null);
      fetchAuctions();
      onRefresh?.();
    } catch (err) {
      setError(i18n.translate('admin.auctions.table.errors.close'));
      console.error('Error closing auction:', err);
    }
  };

  const getStatusBadge = (status, auction) => {
    // Normalize legacy / special statuses into the same display rules
    if (status === 'reserve_not_met') {
      return <Badge status="warning">{i18n.translate('admin.auctions.table.status.reserveNotMet')}</Badge>;
    }

    // Reserve / winner aware statuses for ended auctions
    if (status === 'ended') {
      const hasBids = (auction.bidHistory?.length || 0) > 0;
      const hasReserve = auction.reservePrice != null && auction.reservePrice > 0;
      const currentBid = auction.currentBid != null ? Number(auction.currentBid) : null;

      if (hasBids && hasReserve && currentBid != null && currentBid < Number(auction.reservePrice)) {
          return <Badge status="warning">{i18n.translate('admin.auctions.table.status.reserveNotMet')}</Badge>;
      }

      if (!hasBids) {
        return <Badge status="attention">{i18n.translate('admin.auctions.table.status.noWinner')}</Badge>;
      }

      // Has bids and no reserve (or reserve met)
      return <Badge status="success">{i18n.translate('admin.auctions.table.status.ended')}</Badge>;
    }

    const statusMap = {
      pending: { status: 'warning', children: i18n.translate('admin.analytics.status.pending') },
      active: { status: 'success', children: i18n.translate('admin.analytics.status.active') },
      ended: { status: 'info', children: i18n.translate('admin.analytics.status.ended') },
      closed: { status: 'critical', children: i18n.translate('admin.analytics.status.closed') }
    };
    return <Badge {...statusMap[status]} />;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(i18n.locale || 'en', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date, formatStr = 'MMM dd, yyyy HH:mm') => {
    return format(new Date(date), formatStr);
  };

  const rows = auctions.map((auction) => [
    // Product Name - truncated for better fit
    (auction.productData?.title || auction.shopifyProductId || i18n.translate('admin.auctions.table.unknownProduct')).substring(0, 30) + 
    ((auction.productData?.title || auction.shopifyProductId || i18n.translate('admin.auctions.table.unknownProduct')).length > 30 ? '...' : ''),
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
    getStatusBadge(auction.status, auction),
    // Bid Count
    auction.bidHistory?.length || 0,
    <div key={auction.id} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <Button
        icon={StoreMinor}
        onClick={() => handleViewInStore(auction)}
        size="slim"
        accessibilityLabel={i18n.translate('admin.auctions.table.actions.viewInStore')}
      />
      <Button
        icon={ViewMinor}
        onClick={() => onView(auction)}
        size="slim"
        accessibilityLabel={i18n.translate('admin.auctions.table.actions.viewDetails')}
      />
      <Button
        icon={EditMinor}
        onClick={() => onEdit(auction)}
        size="slim"
        accessibilityLabel={i18n.translate('admin.auctions.table.actions.edit')}
      />
      <Button
        icon={DeleteMinor}
        onClick={() => {
          setSelectedAuction(auction);
          setDeleteModalOpen(true);
        }}
        size="slim"
        destructive
        accessibilityLabel={i18n.translate('admin.auctions.table.actions.delete')}
      />
      {auction.status === 'active' && (
        <Button
          onClick={() => {
            setSelectedAuction(auction);
            setCloseModalOpen(true);
          }}
          size="slim"
          accessibilityLabel={i18n.translate('admin.auctions.table.actions.close')}
        >
          {i18n.translate('admin.common.close')}
        </Button>
      )}
    </div>
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
        setToastMessage(i18n.translate('admin.auctions.table.errors.noShop'));
        setToastError(true);
        setShowToast(true);
        return;
      }

      // Get the Shopify product ID
      const shopifyProductId = auction.shopifyProductId;
      if (!shopifyProductId) {
        console.error('❌ No Shopify product ID found for auction:', auction.id);
        setToastMessage(i18n.translate('admin.auctions.table.errors.noProductId'));
        setToastError(true);
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
      setToastMessage(i18n.translate('admin.auctions.table.errors.openInStore'));
      setToastError(true);
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
          <Text variant="bodyMd">{i18n.translate('admin.auctions.table.loading')}</Text>
        </div>
      </Card>
    );
  }

  if (auctions.length === 0) {
    return (
      <Card>
        <EmptyState
          heading={i18n.translate('admin.auctions.table.empty.title')}
          action={{
            content: i18n.translate('admin.auctions.table.empty.action'),
            onAction: () => onEdit(null)
          }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <Text variant="bodyMd">
            {i18n.translate('admin.auctions.table.empty.description')}
          </Text>
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div style={{ marginBottom: '1rem' }}>
          <Button onClick={() => setFilterModalOpen(true)}>
            {i18n.translate('admin.auctions.table.filters.open')}
          </Button>
          {(filters.status || filters.shopifyProductId) && (
            <Button onClick={clearFilters} style={{ marginLeft: '0.5rem' }}>
              {i18n.translate('admin.auctions.table.filters.clear')}
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
              i18n.translate('admin.auctions.table.columns.product'),
              i18n.translate('admin.auctions.table.columns.start'),
              i18n.translate('admin.auctions.table.columns.end'),
              i18n.translate('admin.auctions.table.columns.startBid'),
              i18n.translate('admin.auctions.table.columns.currentBid'),
              i18n.translate('admin.auctions.table.columns.buyNow'),
              i18n.translate('admin.auctions.table.columns.reserve'),
              i18n.translate('admin.auctions.table.columns.status'),
              i18n.translate('admin.auctions.table.columns.bids'),
              i18n.translate('admin.auctions.table.columns.actions')
            ]}
            rows={rows}
            footerContent={i18n.translate('admin.auctions.table.footer', {
              visible: auctions.length,
              total: totalItems
            })}
          />
        </div>

        {totalPages > 1 && (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Pagination
              hasPrevious={currentPage > 1}
              onPrevious={() => setCurrentPage(currentPage - 1)}
              hasNext={currentPage < totalPages}
              onNext={() => setCurrentPage(currentPage + 1)}
              label={i18n.translate('admin.auctions.table.pagination', {
                current: currentPage,
                total: totalPages
              })}
            />
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={i18n.translate('admin.auctions.table.delete.title')}
        primaryAction={{
          content: i18n.translate('admin.auctions.table.delete.confirm'),
          onAction: handleDelete,
          destructive: true
        }}
        secondaryActions={[
          {
            content: i18n.translate('admin.common.cancel'),
            onAction: () => setDeleteModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <Text variant="bodyMd">
            {i18n.translate('admin.auctions.table.delete.message')}
            {selectedAuction?.bidHistory?.length > 0 && (
              <Text variant="bodyMd" color="critical">
                {i18n.translate('admin.auctions.table.delete.hasBids')}
              </Text>
            )}
          </Text>
        </Modal.Section>
      </Modal>

      {/* Close Auction Modal */}
      <Modal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title={i18n.translate('admin.auctions.table.close.title')}
        primaryAction={{
          content: i18n.translate('admin.auctions.table.close.confirm'),
          onAction: handleClose
        }}
        secondaryActions={[
          {
            content: i18n.translate('admin.common.cancel'),
            onAction: () => setCloseModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <Text variant="bodyMd">
            {i18n.translate('admin.auctions.table.close.message')}
          </Text>
        </Modal.Section>
      </Modal>

      {/* Filter Modal */}
      <Modal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title={i18n.translate('admin.auctions.table.filters.title')}
        primaryAction={{
          content: i18n.translate('admin.auctions.table.filters.apply'),
          onAction: () => handleFiltersChange(filters)
        }}
        secondaryActions={[
          {
            content: i18n.translate('admin.common.cancel'),
            onAction: () => setFilterModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <div style={{ marginBottom: '1rem' }}>
            <Text variant="headingMd">{i18n.translate('admin.auctions.table.filters.statusLabel')}</Text>
            <ChoiceList
              title=""
              choices={[
                { label: i18n.translate('admin.analytics.status.active'), value: 'active' },
                { label: i18n.translate('admin.analytics.status.closed'), value: 'closed' }
              ]}
              selected={filters.status ? [filters.status] : []}
              onChange={(value) => setFilters({ ...filters, status: value[0] || '' })}
            />
          </div>
          <div>
            <TextField
              label={i18n.translate('admin.auctions.form.fields.productId')}
              value={filters.shopifyProductId}
              onChange={(value) => setFilters({ ...filters, shopifyProductId: value })}
              placeholder={i18n.translate('admin.auctions.table.filters.productPlaceholder')}
            />
          </div>
        </Modal.Section>
      </Modal>

      {/* Toast */}
      {showToast && (
        <AppBridgeToast
          message={toastMessage}
          isError={toastError}
          duration={6000}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </>
  );
};

export default AuctionTable;
