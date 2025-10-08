import React, { useState } from 'react';
import { 
  Card, 
  FormLayout, 
  TextField, 
  Button, 
  Text, 
  Banner,
  Spinner
} from '@shopify/polaris';

const BidForm = ({ auction, onBidPlaced, isLoading }) => {
  const [bidder, setBidder] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const minBid = auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingBid;
  const suggestedBid = minBid + 5; // Suggest $5 more than minimum

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!bidder.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!amount || isNaN(amount) || parseFloat(amount) < minBid) {
      setError(`Bid must be at least $${minBid}`);
      return;
    }

    onBidPlaced({
      bidder: bidder.trim(),
      amount: parseFloat(amount)
    });
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
            label="Your Name"
            value={bidder}
            onChange={setBidder}
            placeholder="Enter your name"
            required
            disabled={isLoading}
          />

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
            helpText={`Current highest bid: $${auction.currentBid || 0}`}
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

          <Button 
            primary 
            submit 
            loading={isLoading}
            disabled={!bidder.trim() || !amount}
          >
            {isLoading ? 'Placing Bid...' : 'Place Bid'}
          </Button>
        </FormLayout>
      </form>
    </Card>
  );
};

export default BidForm;
