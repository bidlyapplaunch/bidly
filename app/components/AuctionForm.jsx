import React, { useState, useEffect } from 'react';

const AuctionForm = ({ isOpen, onClose, auction, onSave }) => {
  const [formData, setFormData] = useState({
    shopifyProductId: '',
    startingBid: '',
    buyNowPrice: '',
    startTime: '',
    endTime: '',
    status: 'draft'
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      if (auction) {
        setFormData({
          shopifyProductId: auction.shopifyProductId || '',
          startingBid: auction.startingBid || '',
          buyNowPrice: auction.buyNowPrice || '',
          startTime: auction.startTime ? new Date(auction.startTime).toISOString().slice(0, 16) : '',
          endTime: auction.endTime ? new Date(auction.endTime).toISOString().slice(0, 16) : '',
          status: auction.status || 'draft'
        });
      } else {
        setFormData({
          shopifyProductId: '',
          startingBid: '',
          buyNowPrice: '',
          startTime: '',
          endTime: '',
          status: 'draft'
        });
      }
    }
  }, [isOpen, auction]);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/shopify/products?limit=20');
      const data = await response.json();
      setProducts(data || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setProducts([]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const auctionData = {
        ...formData,
        startingBid: parseFloat(formData.startingBid),
        buyNowPrice: parseFloat(formData.buyNowPrice),
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString()
      };

      await onSave(auctionData);
    } catch (err) {
      setError(err.message || 'Failed to save auction');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <s-modal
      open={isOpen}
      onClose={onClose}
      title={auction ? 'Edit Auction' : 'Create New Auction'}
      size="large"
    >
      <form onSubmit={handleSubmit}>
        <s-modal-content>
          {error && (
            <s-banner status="critical" style={{ marginBottom: '16px' }}>
              <s-text variant="bodyMd">{error}</s-text>
            </s-banner>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <s-select
                label="Product"
                value={formData.shopifyProductId}
                onChange={(value) => handleInputChange('shopifyProductId', value)}
                options={[
                  { label: 'Select a product', value: '' },
                  ...(Array.isArray(products) ? products.map(product => ({
                    label: product.title,
                    value: product.id.toString()
                  })) : [])
                ]}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <s-text-field
                  label="Starting Bid ($)"
                  type="number"
                  step="0.01"
                  value={formData.startingBid}
                  onChange={(value) => handleInputChange('startingBid', value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <s-text-field
                  label="Buy Now Price ($)"
                  type="number"
                  step="0.01"
                  value={formData.buyNowPrice}
                  onChange={(value) => handleInputChange('buyNowPrice', value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <s-text-field
                  label="Start Time"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(value) => handleInputChange('startTime', value)}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <s-text-field
                  label="End Time"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(value) => handleInputChange('endTime', value)}
                  required
                />
              </div>
            </div>

            <div>
              <s-select
                label="Status"
                value={formData.status}
                onChange={(value) => handleInputChange('status', value)}
                options={[
                  { label: 'Draft', value: 'draft' },
                  { label: 'Active', value: 'active' },
                  { label: 'Ended', value: 'ended' },
                  { label: 'Cancelled', value: 'cancelled' }
                ]}
              />
            </div>
          </div>
        </s-modal-content>

        <s-modal-footer>
          <s-button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </s-button>
          <s-button 
            variant="primary" 
            type="submit" 
            disabled={loading}
          >
            {loading ? 'Saving...' : (auction ? 'Update Auction' : 'Create Auction')}
          </s-button>
        </s-modal-footer>
      </form>
    </s-modal>
  );
};

export default AuctionForm;