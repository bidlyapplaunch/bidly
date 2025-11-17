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
  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false);
  const [bidModalOpen, setBidModalOpen] = React.useState(false);

  const getBidderName = (bid) => bid?.displayName || bid?.bidder || 'Anonymous';

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
            <Text variant="bodyMd">
              Product ID: {auction.shopifyProductId}
            </Text>
          </div>
          <Badge status={getStatusColor(auction.status)}>
            {auction.status.toUpperCase()}
          </Badge>
        </div>

        {/* Product Image */}
        {auction.productData?.image?.src ? (
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 'var(--bidly-marketplace-spacing, 1rem)'
            }}
          >
            <img
              src={auction.productData.image.src}
              alt={auction.productData?.title || 'Product image'}
              style={{ 
                maxWidth: '100%',
                maxHeight: '250px',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: 'var(--bidly-marketplace-border-radius, 8px)',
                border: '1px solid var(--bidly-marketplace-color-border, #d4d8dd)',
                backgroundColor: 'var(--bidly-marketplace-color-surface, #ffffff)'
              }}
            />
          </div>
        ) : (
          <div style={{ 
            width: '100%', 
            height: '200px', 
            backgroundColor: 'var(--bidly-marketplace-color-surface, #ffffff)', 
            borderRadius: 'var(--bidly-marketplace-border-radius, 8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--bidly-marketplace-spacing, 1rem)',
            border: '1px solid var(--bidly-marketplace-color-border, #d4d8dd)'
          }}>
            <Text variant="bodyMd">
              Product Image
            </Text>
          </div>
        )}

        <Layout>
          <Layout.Section oneHalf>
            <div style={{ marginBottom: '1rem' }}>
              <Text variant="bodyMd" fontWeight="bold">Current Bid</Text>
              <Text variant="headingLg" as="p" style={{ color: 'var(--bidly-marketplace-color-accent, #2563eb)' }}>
                {formatCurrency(auction.currentBid || 0)}
              </Text>
              {auction.status === 'ended' && auction.bidHistory && auction.bidHistory.length > 0 && (
                <Text variant="bodySm" style={{ color: 'var(--bidly-marketplace-color-accent, #2563eb)', fontWeight: 'bold' }}>
                  Winner: {getBidderName(auction.bidHistory[auction.bidHistory.length - 1])}
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
          <div style={{ marginBottom: 'var(--bidly-marketplace-spacing, 1rem)' }}>
            <Text variant="bodyMd" fontWeight="bold">Buy Now Price</Text>
            <Text variant="bodyLg" as="p" style={{ color: 'var(--bidly-marketplace-color-accent, #2563eb)' }}>
              {formatCurrency(auction.buyNowPrice)}
            </Text>
          </div>
        )}

        <div style={{ marginBottom: 'var(--bidly-marketplace-spacing, 1rem)' }}>
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

        <div style={{ marginBottom: 'var(--bidly-marketplace-spacing, 1rem)' }}>
          <Text variant="bodyMd" fontWeight="bold">Bid Count</Text>
          <Text variant="bodyLg" as="p">
            {auction.bidHistory?.length || 0} bids
          </Text>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button 
            primary 
            onClick={() => setBidModalOpen(true)}
            disabled={auction.status !== 'active'}
          >
            {auction.status === 'active' ? 'Place Bid' : 
             auction.status === 'pending' ? 'Starting Soon' : 'View Details'}
          </Button>
          <Button 
            onClick={() => setDetailsModalOpen(true)}
          >
            View Details
          </Button>
        </div>
      </Card>

      {/* View Details Modal - Read-only information */}
      <Modal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={`Auction Details: ${auction.productData?.title || auction.shopifyProductId || 'Unknown Product'}`}
        large
        primaryAction={{
          content: 'Close',
          onAction: () => setDetailsModalOpen(false)
        }}
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
                    <div
                      key={index}
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid var(--bidly-marketplace-color-border, #d4d8dd)',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Text variant="bodyMd">{getBidderName(bid)}</Text>
                      <Text variant="bodyMd" fontWeight="bold">{formatCurrency(bid.amount)}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Frame>
        </Modal.Section>
      </Modal>

      {/* Bid Modal - Contains bidding functionality */}
      <Modal
        open={bidModalOpen}
        onClose={() => setBidModalOpen(false)}
        title={`Place Bid: ${auction.productData?.title || auction.shopifyProductId || 'Unknown Product'}`}
        primaryAction={auction.status === 'active' ? {
          content: 'Place Bid',
          onAction: () => {
            // Trigger form submission
            const form = document.querySelector('form');
            if (form) {
              const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
              form.dispatchEvent(submitEvent);
            }
          },
          disabled: isLoading
        } : undefined}
        secondaryActions={auction.status === 'active' && auction.buyNowPrice ? [{
          content: `Buy Now ($${auction.buyNowPrice})`,
          onAction: () => {
            // This will be handled by the BidForm component
            const buyNowButton = document.querySelector('[data-buy-now-trigger]');
            if (buyNowButton) buyNowButton.click();
          },
          disabled: isLoading,
          tone: 'critical'
        }] : undefined}
      >
        <Modal.Section>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <Text variant="headingMd">Auction Information</Text>
              <div style={{ marginTop: '0.5rem' }}>
                <Text variant="bodyMd"><strong>Current Bid:</strong> {formatCurrency(auction.currentBid || 0)}</Text>
                <Text variant="bodyMd"><strong>Starting Bid:</strong> {formatCurrency(auction.startingBid)}</Text>
                {auction.buyNowPrice && (
                  <Text variant="bodyMd"><strong>Buy Now Price:</strong> {formatCurrency(auction.buyNowPrice)}</Text>
                )}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <Text variant="headingMd">Time Remaining</Text>
              <div style={{ marginTop: '0.5rem' }}>
                <CountdownTimer 
                  endTime={auction.endTime}
                  startTime={auction.startTime}
                  status={auction.status}
                  onTimeUp={handleTimeUp}
                />
              </div>
            </div>
          </div>

          {/* Bid Form - Only shown for active auctions */}
          {auction.status === 'active' && (
            <BidForm 
              auction={auction} 
              onBidPlaced={(bidData) => {
                onBidPlaced(bidData);
                setBidModalOpen(false); // Close modal after successful bid
              }}
              onBuyNow={() => {
                onBuyNow();
                setBidModalOpen(false); // Close modal after buy now
              }}
              isLoading={isLoading}
            />
          )}

          {auction.status !== 'active' && (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <Text variant="headingMd" color="subdued">
                {auction.status === 'pending' ? 'Auction has not started yet' : 
                 auction.status === 'ended' ? 'Auction has ended' : 'Auction is not available'}
              </Text>
            </div>
          )}
        </Modal.Section>
      </Modal>
    </>
  );
};

export default AuctionCard;
