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
      <Card 
        sectioned
        style={{
          fontFamily: 'var(--bidly-font-family, Inter, sans-serif)',
          borderRadius: 'var(--bidly-border-radius, 6px)',
          boxShadow: 'var(--bidly-shadow, 0 2px 4px 0 rgba(0, 0, 0, 0.1))',
          border: '1px solid var(--bidly-color-border, #dddddd)',
          backgroundColor: 'var(--bidly-color-surface, #ffffff)',
          color: 'var(--bidly-color-text-primary, #222222)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <Text variant="headingLg" as="h2" style={{ color: 'var(--bidly-color-text-primary, #222222)' }}>
              {auction.productData?.title || auction.shopifyProductId || 'Unknown Product'}
            </Text>
            <Text variant="bodyMd" style={{ color: 'var(--bidly-color-text-secondary, #666666)' }}>
              Product ID: {auction.shopifyProductId}
            </Text>
          </div>
          <Badge status={getStatusColor(auction.status)}>
            {auction.status.toUpperCase()}
          </Badge>
        </div>

        {/* Product Image */}
        {auction.productData?.image?.src ? (
          <div style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <img
              src={auction.productData.image.src}
              alt={auction.productData?.title || 'Product image'}
              style={{ 
                maxWidth: '100%',
                maxHeight: '250px',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '8px',
                border: '1px solid #e1e3e5',
                backgroundColor: '#fafbfb'
              }}
            />
          </div>
        ) : (
          <div style={{ 
            width: '100%', 
            height: '200px', 
            backgroundColor: 'var(--bidly-color-background, #f5f5f5)', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            border: '1px solid var(--bidly-color-border, #dddddd)'
          }}>
            <Text variant="bodyMd" style={{ color: 'var(--bidly-color-text-secondary, #666666)' }}>
              Product Image
            </Text>
          </div>
        )}

        <Layout>
          <Layout.Section oneHalf>
            <div style={{ marginBottom: '1rem' }}>
              <Text variant="bodyMd" fontWeight="bold" style={{ color: 'var(--bidly-color-text-primary, #222222)' }}>Current Bid</Text>
              <Text variant="headingLg" as="p" style={{ color: 'var(--bidly-color-accent, #00b894)' }}>
                {formatCurrency(auction.currentBid || 0)}
              </Text>
              {auction.status === 'ended' && auction.bidHistory && auction.bidHistory.length > 0 && (
                <Text variant="bodySm" style={{ color: 'var(--bidly-color-success, #00c851)', fontWeight: 'bold' }}>
                  Winner: {auction.bidHistory[auction.bidHistory.length - 1].bidder}
                </Text>
              )}
            </div>
          </Layout.Section>
          <Layout.Section oneHalf>
            <div style={{ marginBottom: '1rem' }}>
              <Text variant="bodyMd" fontWeight="bold" style={{ color: 'var(--bidly-color-text-primary, #222222)' }}>Starting Bid</Text>
              <Text variant="bodyLg" as="p" style={{ color: 'var(--bidly-color-text-secondary, #666666)' }}>
                {formatCurrency(auction.startingBid)}
              </Text>
            </div>
          </Layout.Section>
        </Layout>

        {auction.buyNowPrice && (
          <div style={{ marginBottom: '1rem' }}>
            <Text variant="bodyMd" fontWeight="bold" style={{ color: 'var(--bidly-color-text-primary, #222222)' }}>Buy Now Price</Text>
            <Text variant="bodyLg" as="p" style={{ color: 'var(--bidly-color-success, #00c851)' }}>
              {formatCurrency(auction.buyNowPrice)}
            </Text>
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <Text variant="bodyMd" fontWeight="bold" style={{ color: 'var(--bidly-color-text-primary, #222222)' }}>
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
            onClick={() => setBidModalOpen(true)}
            disabled={auction.status !== 'active'}
            style={{
              backgroundColor: 'var(--bidly-color-primary, #007bff)',
              borderColor: 'var(--bidly-color-primary, #007bff)',
              padding: 'var(--bidly-button-padding, 0.625rem 1.25rem)',
              borderRadius: 'var(--bidly-border-radius, 6px)',
              fontFamily: 'var(--bidly-font-family, Inter, sans-serif)'
            }}
          >
            {auction.status === 'active' ? 'Place Bid' : 
             auction.status === 'pending' ? 'Starting Soon' : 'View Details'}
          </Button>
          <Button 
            onClick={() => setDetailsModalOpen(true)}
            style={{
              padding: 'var(--bidly-button-padding, 0.625rem 1.25rem)',
              borderRadius: 'var(--bidly-border-radius, 6px)',
              fontFamily: 'var(--bidly-font-family, Inter, sans-serif)',
              backgroundColor: 'var(--bidly-color-surface, #ffffff)',
              borderColor: 'var(--bidly-color-border, #dddddd)',
              color: 'var(--bidly-color-text-primary, #222222)'
            }}
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
              onBuyNow={(bidder) => {
                onBuyNow(bidder);
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
