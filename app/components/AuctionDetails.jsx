import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Text,
  Button,
  DataTable,
  Badge,
  ButtonGroup,
  Divider,
  BlockStack,
  InlineStack
} from '@shopify/polaris';

const AuctionDetails = ({ isOpen, onClose, auction, onRefresh }) => {
  const [auctionData, setAuctionData] = useState(auction);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auction && isOpen) {
      fetchAuctionDetails();
    }
  }, [auction, isOpen]);

  const fetchAuctionDetails = async () => {
    const auctionId = auction?.id || auction?._id;
    if (!auctionId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/auctions/${auctionId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch auction: ${response.status}`);
      }
      
      const data = await response.json();
      setAuctionData(data.data || data);
    } catch (error) {
      console.error('Error fetching auction details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAuction = async () => {
    try {
      const auctionId = auctionData?.id || auctionData?._id;
      if (!auctionId) return;
      
      const response = await fetch(`/api/auctions/${auctionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to close auction: ${response.status}`);
      }
      
      fetchAuctionDetails();
      onRefresh?.();
    } catch (error) {
      console.error('Error closing auction:', error);
    }
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
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      }).format(new Date(date));
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { status: 'success', children: 'Active' },
      closed: { status: 'critical', children: 'Closed' },
      ended: { status: 'info', children: 'Ended' },
      draft: { status: 'warning', children: 'Draft' }
    };
    const config = statusMap[status] || { status: 'info', children: status?.toUpperCase() || 'UNKNOWN' };
    return <Badge {...config} />;
  };

  const getTimeStatus = () => {
    if (!auctionData) return null;
    
    const now = new Date();
    const start = new Date(auctionData.startTime);
    const end = new Date(auctionData.endTime);
    
    if (now < start) {
      return <Badge status="info">Not Started</Badge>;
    } else if (now > end) {
      return <Badge status="critical">Ended</Badge>;
    } else {
      return <Badge status="success">Live</Badge>;
    }
  };

  const getBidHistoryRows = () => {
    if (!auctionData?.bidHistory?.length) {
      return [];
    }

    return auctionData.bidHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map((bid, index) => [
        index + 1,
        bid.bidder || 'Anonymous',
        formatCurrency(bid.amount),
        formatDate(bid.timestamp)
      ]);
  };

  if (!auctionData) {
    return null;
  }

  const bidHistoryRows = getBidHistoryRows();

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Auction Details"
      primaryAction={{
        content: 'Close',
        onAction: onClose
      }}
      large
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Auction Overview */}
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Auction Overview</Text>
              <InlineStack gap="400" align="space-between">
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">Product ID</Text>
                  <Text variant="bodyLg">{auctionData.shopifyProductId}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">Status</Text>
                  {getStatusBadge(auctionData.status)}
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">Time Status</Text>
                  {getTimeStatus()}
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Auction Details */}
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Auction Details</Text>
              <InlineStack gap="400" align="space-between">
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">Start Time</Text>
                  <Text variant="bodyLg">{formatDate(auctionData.startTime)}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">End Time</Text>
                  <Text variant="bodyLg">{formatDate(auctionData.endTime)}</Text>
                </BlockStack>
              </InlineStack>
              <Divider />
              <InlineStack gap="400" align="space-between">
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">Starting Bid</Text>
                  <Text variant="bodyLg">{formatCurrency(auctionData.startingBid)}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">Current Bid</Text>
                  <Text variant="bodyLg" fontWeight="bold">
                    {formatCurrency(auctionData.currentBid || auctionData.startingBid)}
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">Buy Now Price</Text>
                  <Text variant="bodyLg">
                    {auctionData.buyNowPrice ? formatCurrency(auctionData.buyNowPrice) : 'Not set'}
                  </Text>
                </BlockStack>
              </InlineStack>
              <Divider />
              <InlineStack gap="400" align="space-between">
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">Total Bids</Text>
                  <Text variant="bodyLg">{auctionData.bidHistory?.length || 0}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">Created</Text>
                  <Text variant="bodyLg">{formatDate(auctionData.createdAt)}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodyMd" tone="subdued">Last Updated</Text>
                  <Text variant="bodyLg">{formatDate(auctionData.updatedAt)}</Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Bid History */}
          {bidHistoryRows.length > 0 ? (
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Bid History</Text>
                <DataTable
                  columnContentTypes={['numeric', 'text', 'text', 'text']}
                  headings={['#', 'Bidder', 'Amount', 'Time']}
                  rows={bidHistoryRows}
                />
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <Text variant="bodyMd" tone="subdued">
                No bids placed yet
              </Text>
            </Card>
          )}

          {/* Actions */}
          {auctionData.status === 'active' && (
            <Card>
              <InlineStack align="end">
                <ButtonGroup>
                  <Button onClick={fetchAuctionDetails} loading={loading}>
                    Refresh
                  </Button>
                  <Button onClick={handleCloseAuction} destructive>
                    Close Auction
                  </Button>
                </ButtonGroup>
              </InlineStack>
            </Card>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
};

export default AuctionDetails;
