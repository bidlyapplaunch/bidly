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
import { t } from '../i18n';
import './AuctionCard.css';

const AuctionCard = ({ auction, shopDomain, onBidPlaced, onBuyNow, isLoading }) => {
  const productUrl = shopDomain && (auction.productData?.handle || auction.shopifyProductId)
    ? `https://${shopDomain}/products/${auction.productData?.handle || auction.shopifyProductId}`
    : null;
  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false);
  const [bidModalOpen, setBidModalOpen] = React.useState(false);
  // Tracks whether a bid/buy-now submitted from this modal is in flight, so the
  // modal stays open (showing a loading state) until the action resolves.
  const [bidSubmitting, setBidSubmitting] = React.useState(false);
  const bidFormRef = React.useRef(null);
  const prevLoadingRef = React.useRef(isLoading);

  // Close the bid modal once a submission we initiated has finished resolving
  // (isLoading transitions from true back to false).
  React.useEffect(() => {
    if (bidSubmitting && prevLoadingRef.current && !isLoading) {
      setBidSubmitting(false);
      setBidModalOpen(false);
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, bidSubmitting]);

  const getBidderName = (bid) => bid?.displayName || bid?.bidder || t('marketplace.anonymous');

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
    // Auction has ended
  };

  return (
    <>
      <Card sectioned>
        <div className="bidly-card-header">
          <div>
            <Text variant="headingLg" as="h2">
              {auction.productData?.title || auction.shopifyProductId || t('marketplace.auction_card.unknownProduct')}
            </Text>
            <Text variant="bodyMd">
              {t('marketplace.auction_card.productId', { id: auction.shopifyProductId })}
            </Text>
          </div>
          <Badge status={getStatusColor(auction.status)}>
            {t(`marketplace.status.${(auction.status || 'pending').toLowerCase()}`)}
          </Badge>
        </div>

        {/* Product Image - clickable to product page.
            The fixed-size box reserves layout space so lazy images don't cause
            reflow/CLS as they load. */}
        {auction.productData?.image?.src ? (
          <div className="bidly-card-image-wrap">
            <div className="bidly-card-image-box">
              {productUrl ? (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bidly-card-image-link"
                >
                  <img
                    src={auction.productData.image.src}
                    alt={auction.productData?.title || t('marketplace.auction_card.productImage')}
                    loading="lazy"
                    decoding="async"
                    className="bidly-card-image"
                  />
                </a>
              ) : (
                <img
                  src={auction.productData.image.src}
                  alt={auction.productData?.title || t('marketplace.auction_card.productImage')}
                  loading="lazy"
                  decoding="async"
                  className="bidly-card-image"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="bidly-card-image-placeholder">
            <Text variant="bodyMd">
              {t('marketplace.auction_card.productImage')}
            </Text>
          </div>
        )}

        <Layout>
          <Layout.Section oneHalf>
            <div style={{ marginBottom: '1rem' }}>
              <Text variant="bodyMd" fontWeight="bold">{t('marketplace.auction_card.currentBid')}</Text>
              <Text variant="headingLg" as="p" style={{ color: 'var(--bidly-marketplace-color-accent, #2563eb)' }}>
                {formatCurrency(auction.currentBid || 0)}
              </Text>
              {auction.status === 'ended' && auction.bidHistory && auction.bidHistory.length > 0 && (
                <Text variant="bodySm" style={{ color: 'var(--bidly-marketplace-color-accent, #2563eb)', fontWeight: 'bold' }}>
                  {t('marketplace.auction_card.winner', { name: getBidderName(auction.bidHistory[auction.bidHistory.length - 1]) })}
                </Text>
              )}
            </div>
          </Layout.Section>
          <Layout.Section oneHalf>
            <div style={{ marginBottom: '1rem' }}>
              <Text variant="bodyMd" fontWeight="bold">{t('marketplace.auction_card.startingBid')}</Text>
              <Text variant="bodyLg" as="p">
                {formatCurrency(auction.startingBid)}
              </Text>
            </div>
          </Layout.Section>
        </Layout>

        {auction.buyNowPrice && (
          <div style={{ marginBottom: 'var(--bidly-marketplace-spacing, 1rem)' }}>
            <Text variant="bodyMd" fontWeight="bold">{t('marketplace.auction_card.buyNowPrice')}</Text>
            <Text variant="bodyLg" as="p" style={{ color: 'var(--bidly-marketplace-color-accent, #2563eb)' }}>
              {formatCurrency(auction.buyNowPrice)}
            </Text>
          </div>
        )}

        <div style={{ marginBottom: 'var(--bidly-marketplace-spacing, 1rem)' }}>
              <Text variant="bodyMd" fontWeight="bold">
                {auction.status === 'pending' ? t('marketplace.auction_card.startsIn') : t('marketplace.auction_card.timeRemaining')}
              </Text>
          <CountdownTimer 
            endTime={auction.endTime}
            startTime={auction.startTime}
            status={auction.status}
            onTimeUp={handleTimeUp}
          />
        </div>

        <div style={{ marginBottom: 'var(--bidly-marketplace-spacing, 1rem)' }}>
          <Text variant="bodyMd" fontWeight="bold">{t('marketplace.auction_card.bidCount')}</Text>
          <Text variant="bodyLg" as="p">
            {t('marketplace.auction_card.bids', { count: auction.bidHistory?.length || 0 })}
          </Text>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button 
            primary 
            onClick={() => setBidModalOpen(true)}
            disabled={auction.status !== 'active'}
          >
            {auction.status === 'active' ? t('marketplace.auction_card.placeBid') : 
             auction.status === 'pending' ? t('marketplace.auction_card.startingSoon') : t('marketplace.auction_card.viewDetails')}
          </Button>
          <Button 
            onClick={() => setDetailsModalOpen(true)}
          >
            {t('marketplace.auction_card.viewDetails')}
          </Button>
          {productUrl && (
            <Button 
              url={productUrl}
              external
            >
              {t('marketplace.auction_card.viewProduct')}
            </Button>
          )}
        </div>
      </Card>

      {/* View Details Modal - Read-only information */}
      <Modal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={t('marketplace.auction_card.detailsModalTitle', { title: auction.productData?.title || auction.shopifyProductId || t('marketplace.auction_card.unknownProduct') })}
        large
        primaryAction={{
          content: t('marketplace.auction_card.close'),
          onAction: () => setDetailsModalOpen(false)
        }}
      >
        <Modal.Section>
          <Frame>
            <Layout>
              <Layout.Section oneHalf>
                <div style={{ marginBottom: '1rem' }}>
                  <Text variant="headingMd">{t('marketplace.auction_card.auctionInformation')}</Text>
                  <div style={{ marginTop: '0.5rem' }}>
                    <Text variant="bodyMd"><strong>{t('marketplace.auction_card.productId', { id: '' }).replace(': ', '')}</strong> {auction.shopifyProductId}</Text>
                    <Text variant="bodyMd"><strong>{t('marketplace.auction_card.status')}:</strong> {auction.status}</Text>
                    <Text variant="bodyMd"><strong>{t('marketplace.auction_card.startTime')}:</strong> {formatDate(auction.startTime)}</Text>
                    <Text variant="bodyMd"><strong>{t('marketplace.auction_card.endTime')}:</strong> {formatDate(auction.endTime)}</Text>
                    <Text variant="bodyMd"><strong>{t('marketplace.auction_card.startingBid')}:</strong> {formatCurrency(auction.startingBid)}</Text>
                    <Text variant="bodyMd"><strong>{t('marketplace.auction_card.currentBid')}:</strong> {formatCurrency(auction.currentBid || 0)}</Text>
                    {auction.buyNowPrice && (
                      <Text variant="bodyMd"><strong>{t('marketplace.auction_card.buyNowPrice')}:</strong> {formatCurrency(auction.buyNowPrice)}</Text>
                    )}
                  </div>
                </div>
              </Layout.Section>
              <Layout.Section oneHalf>
                <div style={{ marginBottom: '1rem' }}>
                  <Text variant="headingMd">
                    {auction.status === 'pending' ? t('marketplace.auction_card.startsIn') : t('marketplace.auction_card.timeRemaining')}
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
                <Text variant="headingMd">{t('marketplace.auction_card.productInformation')}</Text>
                <div style={{ marginTop: '0.5rem' }}>
                  <Text variant="bodyMd"><strong>{t('marketplace.auction_card.title')}</strong> {auction.productData.title}</Text>
                  {auction.productData.vendor && (
                    <Text variant="bodyMd"><strong>{t('marketplace.auction_card.vendor')}</strong> {auction.productData.vendor}</Text>
                  )}
                  {auction.productData.productType && (
                    <Text variant="bodyMd"><strong>{t('marketplace.auction_card.type')}</strong> {auction.productData.productType}</Text>
                  )}
                  {auction.productData.price && (
                    <Text variant="bodyMd"><strong>{t('marketplace.auction_card.shopifyPrice')}</strong> {formatCurrency(auction.productData.price)}</Text>
                  )}
                  {auction.productData.description && (
                    <Text variant="bodyMd"><strong>{t('marketplace.auction_card.description')}</strong> {auction.productData.description}</Text>
                  )}
                </div>
              </div>
            )}

            {/* Bid History */}
            {auction.bidHistory && auction.bidHistory.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <Text variant="headingMd">{t('marketplace.auction_card.bidHistory')}</Text>
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
        title={t('marketplace.auction_card.placeBidModalTitle', { title: auction.productData?.title || auction.shopifyProductId || t('marketplace.auction_card.unknownProduct') })}
        primaryAction={auction.status === 'active' ? {
          content: t('marketplace.auction_card.placeBid'),
          onAction: () => {
            // Submit this auction's specific bid form (via ref, not a global query)
            if (bidFormRef.current) {
              bidFormRef.current.submit();
            }
          },
          loading: isLoading,
          disabled: isLoading
        } : undefined}
        secondaryActions={auction.status === 'active' && auction.buyNowPrice ? [{
          content: t('marketplace.bid_form.buyNowPrice', { amount: auction.buyNowPrice }),
          onAction: () => {
            // This will be handled by the BidForm component
            const buyNowButton = document.querySelector('[data-buy-now-trigger]');
            if (buyNowButton) buyNowButton.click();
          },
          loading: isLoading,
          disabled: isLoading,
          tone: 'critical'
        }] : undefined}
      >
        <Modal.Section>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <Text variant="headingMd">{t('marketplace.auction_card.auctionInformation')}</Text>
              <div style={{ marginTop: '0.5rem' }}>
                <Text variant="bodyMd"><strong>{t('marketplace.auction_card.currentBid')}:</strong> {formatCurrency(auction.currentBid || 0)}</Text>
                <Text variant="bodyMd"><strong>{t('marketplace.auction_card.startingBid')}:</strong> {formatCurrency(auction.startingBid)}</Text>
                {auction.buyNowPrice && (
                  <Text variant="bodyMd"><strong>{t('marketplace.auction_card.buyNowPrice')}:</strong> {formatCurrency(auction.buyNowPrice)}</Text>
                )}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <Text variant="headingMd">{t('marketplace.auction_card.timeRemaining')}</Text>
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
              ref={bidFormRef}
              auction={auction}
              onBidPlaced={(bidData) => {
                // Keep the modal open until the bid resolves (closed by the effect
                // watching isLoading). This surfaces loading state and failures.
                setBidSubmitting(true);
                onBidPlaced(bidData);
              }}
              onBuyNow={() => {
                setBidSubmitting(true);
                onBuyNow();
              }}
              isLoading={isLoading}
            />
          )}

          {auction.status !== 'active' && (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <Text variant="headingMd" color="subdued">
                {auction.status === 'pending' ? t('marketplace.auction_card.auctionNotStarted') : 
                 auction.status === 'ended' ? t('marketplace.auction_card.auctionEnded') : t('marketplace.auction_card.auctionNotAvailable')}
              </Text>
            </div>
          )}
        </Modal.Section>
      </Modal>
    </>
  );
};

export default AuctionCard;
