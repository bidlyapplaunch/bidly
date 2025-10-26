import React, { useState } from 'react';
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
    onBuyNow();
    setShowBuyNowModal(false);
    setAmount('');
  };

  const handleQuickBid = (quickAmount) => {
    setAmount(quickAmount.toString());
    setError('');
  };

  return (
    <Card sectioned>
      <Text variant="headingMd" as="h3">Place Your Bid</Text>
      
      {error && (
        <div style={{ marginBottom: '1rem' }}>
          <Banner status="critical">
            <Text variant="bodyMd">{error}</Text>
          </Banner>
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
            <Text variant="bodySm" color="subdued">Quick bid:</Text>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <Button 
                size="slim" 
                onClick={() => handleQuickBid(minBid)}
                disabled={isLoading}
              >
                ${minBid}
              </Button>
              <Button 
                size="slim" 
                onClick={() => handleQuickBid(suggestedBid)}
                disabled={isLoading}
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

        {/* Move buttons outside FormLayout to remove extra spacing */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <Button 
            primary 
            submit 
            loading={isLoading}
            disabled={!amount}
          >
            {isLoading ? 'Placing Bid...' : 'Place Bid'}
          </Button>
          
          {auction.buyNowPrice && auction.buyNowPrice > 0 && (
            <Button 
              onClick={handleBuyNow}
              loading={isLoading}
              tone="critical"
            >
              Buy Now (${auction.buyNowPrice})
            </Button>
          )}
        </div>
      </form>

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
            <div>
              <Text variant="bodyMd">
                Are you sure you want to buy this item for <Text variant="bodyMd" fontWeight="bold">${auction.buyNowPrice}</Text>?
              </Text>
              <div style={{ marginTop: '0.5rem' }}>
                <Text variant="bodyMd" color="subdued">
                  This will end the auction immediately and you will be the winner.
                </Text>
              </div>
            </div>
          </Modal.Section>
        </Modal>
      )}
    </Card>
  );
};

export default BidForm;
