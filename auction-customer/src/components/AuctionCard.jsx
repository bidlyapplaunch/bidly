import React from 'react';
import { 
  Card, 
  Text, 
  Badge, 
  Button, 
  Modal, 
  Frame,
  Layout,
  Spinner
} from '@shopify/polaris';
import CountdownTimer from './CountdownTimer';
import BidForm from './BidForm';

const AuctionCard = ({ auction, onBidPlaced, onBuyNow, isLoading }) => {
  const [modalOpen, setModalOpen] = React.useState(false);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'info';
      case 'closed':
        return 'critical';
      default:
        return 'info';
    }
  };

  const handleTimeUp = () => {
    // Auction has ended, could trigger a refresh or update
    console.log('Auction ended:', auction.shopifyProductId);
  };

  return (
    <>
      <Card sectioned>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <Text variant="headingLg" as="h2">
              {auction.productData?.title || auction.shopifyProductId || 'Unknown Product'}
            </Text>
            <Text variant="bodyMd" color="subdued">
              Product ID: {auction.shopifyProductId}
            </Text>
          </div>
          <Badge status={getStatusColor(auction.status)}>
            {auction.status.toUpperCase()}
          </Badge>
        </div>

        {/* Product Image */}
        {auction.productData?.image?.src ? (
          <img
            src={auction.productData.image.src}
            alt={auction.productData?.title || 'Product image'}
            style={{ 
              width: '100%', 
              height: '200px', 
              objectFit: 'cover',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}
          />
        ) : (
          <div style={{ 
            width: '100%', 
            height: '200px', 
            backgroundColor: '#f6f6f7', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <Text variant="bodyMd" color="subdued">
              Product Image
            </Text>
          </div>
        )}

        <Layout>
          <Layout.Section oneHalf>
            <div style={{ marginBottom: '1rem' }}>
              <Text variant="bodyMd" fontWeight="bold">Current Bid</Text>
              <Text variant="headingLg" as="p">
                {formatCurrency(auction.currentBid || 0)}
              </Text>
              {auction.status === 'ended' && auction.bidHistory && auction.bidHistory.length > 0 && (
                <Text variant="bodySm" color="success" fontWeight="bold">
                  Winner: {auction.bidHistory[auction.bidHistory.length - 1].bidder}
                </Text>
              )}
            </div>
          </Layout.Section>
          <Layout.Section oneHalf>
            <div style={{ marginBottom: '1rem' }}>
              <Text variant="bodyMd" fontWeight="bold">Starting Bid</Text>
              <Text variant="bodyLg" as="p">
                {formatCurrency(auction.startingBid)}
              </Text>
            </div>
          </Layout.Section>
        </Layout>

        {auction.buyNowPrice && (
          <div style={{ marginBottom: '1rem' }}>
            <Text variant="bodyMd" fontWeight="bold">Buy Now Price</Text>
            <Text variant="bodyLg" as="p" color="success">
              {formatCurrency(auction.buyNowPrice)}
            </Text>
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <Text variant="bodyMd" fontWeight="bold">
            {auction.status === 'pending' ? 'Starts In' : 'Time Remaining'}
          </Text>
          <CountdownTimer 
            endTime={auction.endTime}
            startTime={auction.startTime}
            status={auction.status}
            onTimeUp={handleTimeUp}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <Text variant="bodyMd" fontWeight="bold">Bid Count</Text>
          <Text variant="bodyLg" as="p">
            {auction.bidHistory?.length || 0} bids
          </Text>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button 
            primary 
            onClick={() => setModalOpen(true)}
            disabled={auction.status !== 'active'}
          >
            {auction.status === 'active' ? 'Place Bid' : 
             auction.status === 'pending' ? 'Starting Soon' : 'View Details'}
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            View Details
          </Button>
        </div>
      </Card>

      {/* Auction Details Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Auction: ${auction.productData?.title || auction.shopifyProductId || 'Unknown Product'}`}
        large
      >
        <Modal.Section>
          <Frame>
            <Layout>
              <Layout.Section oneHalf>
                <div style={{ marginBottom: '1rem' }}>
                  <Text variant="headingMd">Auction Information</Text>
                  <div style={{ marginTop: '0.5rem' }}>
                    <Text variant="bodyMd"><strong>Product ID:</strong> {auction.shopifyProductId}</Text>
                    <Text variant="bodyMd"><strong>Status:</strong> {auction.status}</Text>
                    <Text variant="bodyMd"><strong>Start Time:</strong> {formatDate(auction.startTime)}</Text>
                    <Text variant="bodyMd"><strong>End Time:</strong> {formatDate(auction.endTime)}</Text>
                    <Text variant="bodyMd"><strong>Starting Bid:</strong> {formatCurrency(auction.startingBid)}</Text>
                    <Text variant="bodyMd"><strong>Current Bid:</strong> {formatCurrency(auction.currentBid || 0)}</Text>
                    {auction.buyNowPrice && (
                      <Text variant="bodyMd"><strong>Buy Now Price:</strong> {formatCurrency(auction.buyNowPrice)}</Text>
                    )}
                  </div>
                </div>
              </Layout.Section>
              <Layout.Section oneHalf>
                <div style={{ marginBottom: '1rem' }}>
                  <Text variant="headingMd">
                    {auction.status === 'pending' ? 'Starts In' : 'Time Remaining'}
                  </Text>
                  <div style={{ marginTop: '0.5rem' }}>
                    <CountdownTimer 
                      endTime={auction.endTime}
                      startTime={auction.startTime}
                      status={auction.status}
                      onTimeUp={handleTimeUp}
                    />
                  </div>
                </div>
              </Layout.Section>
            </Layout>

            {/* Product Information */}
            {auction.productData && (
              <div style={{ marginBottom: '1rem' }}>
                <Text variant="headingMd">Product Information</Text>
                <div style={{ marginTop: '0.5rem' }}>
                  <Text variant="bodyMd"><strong>Title:</strong> {auction.productData.title}</Text>
                  {auction.productData.vendor && (
                    <Text variant="bodyMd"><strong>Vendor:</strong> {auction.productData.vendor}</Text>
                  )}
                  {auction.productData.productType && (
                    <Text variant="bodyMd"><strong>Type:</strong> {auction.productData.productType}</Text>
                  )}
                  {auction.productData.price && (
                    <Text variant="bodyMd"><strong>Shopify Price:</strong> {formatCurrency(auction.productData.price)}</Text>
                  )}
                  {auction.productData.description && (
                    <Text variant="bodyMd"><strong>Description:</strong> {auction.productData.description}</Text>
                  )}
                </div>
              </div>
            )}

            {/* Bid History */}
            {auction.bidHistory && auction.bidHistory.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <Text variant="headingMd">Bid History</Text>
                <div style={{ marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {auction.bidHistory.map((bid, index) => (
                    <div key={index} style={{ 
                      padding: '0.5rem', 
                      borderBottom: '1px solid #e1e3e5',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <Text variant="bodyMd">{bid.bidder}</Text>
                      <Text variant="bodyMd" fontWeight="bold">{formatCurrency(bid.amount)}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bid Form */}
            {auction.status === 'active' && (
              <BidForm 
                auction={auction} 
                onBidPlaced={onBidPlaced}
                onBuyNow={onBuyNow}
                isLoading={isLoading}
              />
            )}
          </Frame>
        </Modal.Section>
      </Modal>
    </>
  );
};

export default AuctionCard;
