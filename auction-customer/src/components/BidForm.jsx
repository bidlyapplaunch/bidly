import React, { useState, useRef } from 'react';
import { 
  Card, 
  FormLayout, 
  TextField, 
  Button, 
  Text, 
  Banner,
  Spinner,
  Modal
} from '@shopify/polaris';

const BidForm = ({ auction, onBidPlaced, onBuyNow, isLoading }) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  const formRef = useRef(null);

  const minBid = auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingBid;
  const suggestedBid = minBid + 5; // Suggest $5 more than minimum

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!amount || isNaN(amount) || parseFloat(amount) < minBid) {
      if (auction.currentBid > 0) {
        setError(`Bid must be higher than current bid ($${auction.currentBid})`);
      } else {
        setError(`Bid must be at least the starting bid ($${auction.startingBid})`);
      }
      return;
    }

    onBidPlaced({
      amount: parseFloat(amount)
    });

    // Reset form
    setAmount('');
  };

  const handleBuyNow = () => {
    setShowBuyNowModal(true);
  };

  const confirmBuyNow = () => {
    if (onBuyNow) {
      onBuyNow();
    }
    setShowBuyNowModal(false);
    setAmount('');
  };

  const handleQuickBid = (quickAmount) => {
    setAmount(quickAmount.toString());
    setError('');
  };

  return (
    <>
    <div
      style={{
        padding: '0.5rem 0',
        fontFamily: 'var(--bidly-marketplace-font-family, Inter, sans-serif)',
        color: 'var(--bidly-marketplace-color-text-primary, #222222)'
      }}
    >
      <Text
        variant="headingMd"
        as="h3"
        style={{
          marginBottom: 'var(--bidly-marketplace-spacing, 1rem)',
          color: 'var(--bidly-marketplace-color-text-primary, #222222)'
        }}
      >
        Place Your Bid
      </Text>
      
      {error && (
        <div style={{ marginBottom: '1rem' }}>
          <Banner status="critical">
            <Text variant="bodyMd">{error}</Text>
          </Banner>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit}>
        <FormLayout>
          <TextField
            label="Bid Amount"
            type="number"
            value={amount}
            onChange={setAmount}
            placeholder={`Minimum: $${minBid}`}
            min={minBid}
            step="0.01"
            prefix="$"
            required
            disabled={isLoading}
            helpText={auction.currentBid > 0 ? 
              `Current highest bid: $${auction.currentBid}` : 
              `Starting bid: $${auction.startingBid}`
            }
          />

          {/* Quick bid buttons */}
          <div style={{ marginTop: '0.5rem' }}>
            <Text variant="bodySm" style={{ color: 'var(--bidly-marketplace-color-text-secondary, #666666)' }}>Quick bid:</Text>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <Button 
                size="slim" 
                onClick={() => handleQuickBid(minBid)}
                disabled={isLoading}
                style={{
                  backgroundColor: 'var(--bidly-marketplace-color-surface, #ffffff)',
                  borderColor: 'var(--bidly-marketplace-color-border, #dddddd)',
                  color: 'var(--bidly-marketplace-color-text-primary, #222222)',
                  fontFamily: 'var(--bidly-marketplace-font-family, Inter, sans-serif)'
                }}
              >
                ${minBid}
              </Button>
              <Button 
                size="slim" 
                onClick={() => handleQuickBid(suggestedBid)}
                disabled={isLoading}
                style={{
                  backgroundColor: 'var(--bidly-marketplace-color-surface, #ffffff)',
                  borderColor: 'var(--bidly-marketplace-color-border, #dddddd)',
                  color: 'var(--bidly-marketplace-color-text-primary, #222222)',
                  fontFamily: 'var(--bidly-marketplace-font-family, Inter, sans-serif)'
                }}
              >
                ${suggestedBid}
              </Button>
              <Button 
                size="slim" 
                onClick={() => handleQuickBid(minBid + 10)}
                disabled={isLoading}
              >
                ${minBid + 10}
              </Button>
            </div>
          </div>
        </FormLayout>

        {/* Hidden buy now trigger for modal button */}
        {auction.buyNowPrice && auction.buyNowPrice > 0 && (
          <button 
            type="button"
            data-buy-now-trigger
            onClick={handleBuyNow}
            style={{ display: 'none' }}
          />
        )}
      </form>
    </div>

    {/* Buy Now Confirmation Modal - only show if buy now price exists */}
    {auction.buyNowPrice && auction.buyNowPrice > 0 && (
      <Modal
        open={showBuyNowModal}
        onClose={() => setShowBuyNowModal(false)}
        title="Confirm Buy Now"
        primaryAction={{
          content: 'Yes, Buy Now',
          onAction: confirmBuyNow,
          loading: isLoading,
          tone: 'critical'
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowBuyNowModal(false)
          }
        ]}
      >
        <Modal.Section>
          <div style={{ fontFamily: 'var(--bidly-marketplace-font-family, Inter, sans-serif)' }}>
            <Text variant="bodyMd" style={{ color: 'var(--bidly-marketplace-color-text-primary, #222222)' }}>
              Are you sure you want to buy this item for <Text variant="bodyMd" fontWeight="bold" style={{ color: 'var(--bidly-marketplace-color-success, #00c851)' }}>${auction.buyNowPrice}</Text>?
            </Text>
            <div style={{ marginTop: '0.5rem' }}>
              <Text variant="bodyMd" style={{ color: 'var(--bidly-marketplace-color-text-secondary, #666666)' }}>
                This will end the auction immediately and you will be the winner.
              </Text>
            </div>
          </div>
        </Modal.Section>
      </Modal>
    )}
    </>
  );
};

export default BidForm;
