import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Text,
  Button,
  DataTable,
  Badge,
  Banner,
  Frame,
  Toast,
  ButtonGroup,
  Divider,
  Stack,
  TextContainer
} from '@shopify/polaris';
import { format } from 'date-fns';
import { auctionAPI } from '../services/api';

const AuctionDetails = ({ isOpen, onClose, auction, onRefresh }) => {
  const [auctionData, setAuctionData] = useState(auction);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (auction && isOpen) {
      fetchAuctionDetails();
    }
  }, [auction, isOpen]);

  const fetchAuctionDetails = async () => {
    if (!auction?.id) return;
    
    try {
      setLoading(true);
      const response = await auctionAPI.getAuctionById(auction.id);
      setAuctionData(response.data);
    } catch (error) {
      console.error('Error fetching auction details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAuction = async () => {
    try {
      await auctionAPI.closeAuction(auctionData.id);
      setToastMessage('Auction closed successfully');
      setShowToast(true);
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

  const formatDate = (date) => {
    return format(new Date(date), 'MMM dd, yyyy HH:mm:ss');
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { status: 'success', children: 'Active' },
      closed: { status: 'critical', children: 'Closed' }
    };
    return <Badge {...statusMap[status]} />;
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
        bid.bidder,
        formatCurrency(bid.amount),
        formatDate(bid.timestamp)
      ]);
  };

  if (!auctionData) {
    return null;
  }

  const bidHistoryRows = getBidHistoryRows();

  return (
    <Frame>
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
          <Stack vertical spacing="loose">
            {/* Auction Overview */}
            <Card sectioned>
              <Stack vertical spacing="tight">
                <Text variant="headingMd">Auction Overview</Text>
                <Stack distribution="equalSpacing">
                  <div>
                    <Text variant="bodyMd" color="subdued">Product ID</Text>
                    <Text variant="bodyLg">{auctionData.shopifyProductId}</Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">Status</Text>
                    <div>{getStatusBadge(auctionData.status)}</div>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">Time Status</Text>
                    <div>{getTimeStatus()}</div>
                  </div>
                </Stack>
              </Stack>
            </Card>

            {/* Auction Details */}
            <Card sectioned>
              <Stack vertical spacing="tight">
                <Text variant="headingMd">Auction Details</Text>
                <Stack distribution="equalSpacing">
                  <div>
                    <Text variant="bodyMd" color="subdued">Start Time</Text>
                    <Text variant="bodyLg">{formatDate(auctionData.startTime)}</Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">End Time</Text>
                    <Text variant="bodyLg">{formatDate(auctionData.endTime)}</Text>
                  </div>
                </Stack>
                <Divider />
                <Stack distribution="equalSpacing">
                  <div>
                    <Text variant="bodyMd" color="subdued">Starting Bid</Text>
                    <Text variant="bodyLg">{formatCurrency(auctionData.startingBid)}</Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">Current Bid</Text>
                    <Text variant="bodyLg" fontWeight="bold">
                      {formatCurrency(auctionData.currentBid)}
                    </Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">Buy Now Price</Text>
                    <Text variant="bodyLg">
                      {auctionData.buyNowPrice ? formatCurrency(auctionData.buyNowPrice) : 'Not set'}
                    </Text>
                  </div>
                </Stack>
                <Divider />
                <Stack distribution="equalSpacing">
                  <div>
                    <Text variant="bodyMd" color="subdued">Total Bids</Text>
                    <Text variant="bodyLg">{auctionData.bidHistory?.length || 0}</Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">Created</Text>
                    <Text variant="bodyLg">{formatDate(auctionData.createdAt)}</Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" color="subdued">Last Updated</Text>
                    <Text variant="bodyLg">{formatDate(auctionData.updatedAt)}</Text>
                  </div>
                </Stack>
              </Stack>
            </Card>

            {/* Bid History */}
            {bidHistoryRows.length > 0 ? (
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Text variant="headingMd">Bid History</Text>
                  <DataTable
                    columnContentTypes={['numeric', 'text', 'text', 'text']}
                    headings={['#', 'Bidder', 'Amount', 'Time']}
                    rows={bidHistoryRows}
                  />
                </Stack>
              </Card>
            ) : (
              <Card sectioned>
                <TextContainer>
                  <Text variant="bodyMd" color="subdued">
                    No bids placed yet
                  </Text>
                </TextContainer>
              </Card>
            )}

            {/* Actions */}
            {auctionData.status === 'active' && (
              <Card sectioned>
                <Stack distribution="trailing">
                  <ButtonGroup>
                    <Button onClick={fetchAuctionDetails} loading={loading}>
                      Refresh
                    </Button>
                    <Button onClick={handleCloseAuction} destructive>
                      Close Auction
                    </Button>
                  </ButtonGroup>
                </Stack>
              </Card>
            )}
          </Stack>
        </Modal.Section>
      </Modal>

      {showToast && (
        <Toast
          content={toastMessage}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </Frame>
  );
};

export default AuctionDetails;
