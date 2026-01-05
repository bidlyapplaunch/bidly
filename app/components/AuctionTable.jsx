import React, { useState } from 'react';
import { useFetcher } from 'react-router';
import {
  IndexTable,
  Text,
  Badge,
  Button,
  InlineStack,
  Modal,
  BlockStack,
  TextField,
  Select
} from '@shopify/polaris';
import { EditIcon, DeleteIcon, ViewIcon, StoreIcon } from '@shopify/polaris-icons';

const AuctionTable = ({ initialAuctions = [], onEdit, onView, onRefresh }) => {
  const fetcher = useFetcher();
  const auctions = fetcher.data?.auctions || initialAuctions;
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState({ status: '', shopifyProductId: '' });

  const handleDelete = async () => {
    if (!selectedAuction) return;
    
    const response = await fetch(`/api/auctions/${selectedAuction._id || selectedAuction.id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      return;
    }
    
    setDeleteModalOpen(false);
    setSelectedAuction(null);
    onRefresh?.();
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'draft': { status: 'warning', children: 'DRAFT' },
      'active': { status: 'success', children: 'ACTIVE' },
      'ended': { status: 'info', children: 'ENDED' },
      'closed': { status: 'critical', children: 'CLOSED' },
      'cancelled': { status: 'critical', children: 'CANCELLED' }
    };
    
    const config = statusMap[status?.toLowerCase()] || { status: 'info', children: status?.toUpperCase() || 'UNKNOWN' };
    return <Badge {...config} />;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Use a fixed timezone to avoid SSR/client hydration mismatches (Render runs in UTC).
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      }).format(new Date(date));
    } catch {
      return 'Invalid Date';
    }
  };

  const getProductLabel = (auction) => {
    const title =
      auction?.productData?.title ||
      auction?.productName ||
      auction?.shopifyProductId ||
      'Unknown product';
    const short = String(title);
    return short.length > 30 ? `${short.slice(0, 30)}...` : short;
  };

  const handleViewInStore = (auction) => {
    const shop = new URLSearchParams(window.location.search).get('shop');
    const productId = auction?.shopifyProductId;
    if (!shop || !productId) return;
    const url = `https://${shop}/admin/products/${productId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const rowMarkup = auctions.map((auction, index) => (
    <IndexTable.Row id={auction._id || auction.id || index} key={auction._id || auction.id || index} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {getProductLabel(auction)}
          </Text>
          <Text variant="bodySm" tone="subdued" as="span">
            ID: {auction.shopifyProductId}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">{formatDate(auction.startTime)}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">{formatDate(auction.endTime)}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">{formatCurrency(auction.startingBid || 0)}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatCurrency(auction.currentBid ?? auction.startingBid ?? 0)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {auction.buyNowPrice ? formatCurrency(auction.buyNowPrice) : '-'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {auction.reservePrice ? formatCurrency(auction.reservePrice) : '-'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {getStatusBadge(auction.status)}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {auction.bidHistory?.length || 0}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button
            icon={StoreIcon}
            variant="plain"
            size="micro"
            accessibilityLabel="View in store admin"
            onClick={() => handleViewInStore(auction)}
          />
          <Button
            icon={ViewIcon}
            variant="plain"
            size="micro"
            accessibilityLabel="View details"
            onClick={() => onView?.(auction)}
          />
          <Button
            icon={EditIcon}
            variant="plain"
            size="micro"
            accessibilityLabel="Edit"
            onClick={() => onEdit?.(auction)}
          />
          <Button
            icon={DeleteIcon}
            variant="plain"
            size="micro"
            tone="critical"
            accessibilityLabel="Delete"
            onClick={() => {
              setSelectedAuction(auction);
              setDeleteModalOpen(true);
            }}
          />
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  if (auctions.length === 0) {
    return (
      <BlockStack gap="200">
        <Text variant="headingMd" as="h2">No auctions found</Text>
        <Text variant="bodyMd" tone="subdued">
          Create your first auction to get started.
        </Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="400">
      <IndexTable
        resourceName={{
          singular: 'auction',
          plural: 'auctions',
        }}
        itemCount={auctions.length}
        headings={[
          { title: 'Product' },
          { title: 'Start' },
          { title: 'End' },
          { title: 'Start Bid' },
          { title: 'Current Bid' },
          { title: 'Buy Now' },
          { title: 'Reserve' },
          { title: 'Status' },
          { title: 'Bids' },
          { title: 'Actions' }
        ]}
        selectable={false}
      >
        {rowMarkup}
      </IndexTable>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Auction"
        primaryAction={{
          content: 'Delete',
          destructive: true,
          onAction: handleDelete
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setDeleteModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <Text variant="bodyMd" as="p">
            Are you sure you want to delete this auction? This action cannot be undone.
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
          onAction: () => {
            setFilterModalOpen(false);
            onRefresh?.();
          }
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setFilterModalOpen(false)
          }
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Select
              label="Status"
              options={[
                { label: 'All Statuses', value: '' },
                { label: 'Draft', value: 'draft' },
                { label: 'Active', value: 'active' },
                { label: 'Ended', value: 'ended' },
                { label: 'Cancelled', value: 'cancelled' }
              ]}
              value={filters.status}
              onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            />
            <TextField
              label="Product ID"
              value={filters.shopifyProductId}
              onChange={(value) => setFilters(prev => ({ ...prev, shopifyProductId: value }))}
              placeholder="Enter product ID"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
};

export default AuctionTable;
