import React, { useState, useEffect } from 'react';
import {
  Modal,
  TextField,
  Select,
  Button,
  Banner,
  BlockStack,
  InlineStack
} from '@shopify/polaris';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const auctionData = {
        ...formData,
        startingBid: parseFloat(formData.startingBid),
        buyNowPrice: formData.buyNowPrice ? parseFloat(formData.buyNowPrice) : null,
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

  const productOptions = [
    { label: 'Select a product', value: '' },
    ...(Array.isArray(products) ? products.map(product => ({
      label: product.title,
      value: product.id.toString()
    })) : [])
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={auction ? 'Edit Auction' : 'Create New Auction'}
      primaryAction={{
        content: auction ? 'Update Auction' : 'Create Auction',
        onAction: handleSubmit,
        loading
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose
        }
      ]}
      large
    >
      <form onSubmit={handleSubmit}>
        <Modal.Section>
          <BlockStack gap="400">
            {error && (
              <Banner status="critical">
                <p>{error}</p>
              </Banner>
            )}

            <Select
              label="Product"
              options={productOptions}
              value={formData.shopifyProductId}
              onChange={(value) => setFormData(prev => ({ ...prev, shopifyProductId: value }))}
            />

            <InlineStack gap="400">
              <TextField
                label="Starting Bid ($)"
                type="number"
                step="0.01"
                value={formData.startingBid}
                onChange={(value) => setFormData(prev => ({ ...prev, startingBid: value }))}
                placeholder="0.00"
                autoComplete="off"
              />
              <TextField
                label="Buy Now Price ($)"
                type="number"
                step="0.01"
                value={formData.buyNowPrice}
                onChange={(value) => setFormData(prev => ({ ...prev, buyNowPrice: value }))}
                placeholder="0.00"
                autoComplete="off"
              />
            </InlineStack>

            <InlineStack gap="400">
              <TextField
                label="Start Time"
                type="datetime-local"
                value={formData.startTime}
                onChange={(value) => setFormData(prev => ({ ...prev, startTime: value }))}
              />
              <TextField
                label="End Time"
                type="datetime-local"
                value={formData.endTime}
                onChange={(value) => setFormData(prev => ({ ...prev, endTime: value }))}
              />
            </InlineStack>

            <Select
              label="Status"
              options={[
                { label: 'Draft', value: 'draft' },
                { label: 'Active', value: 'active' },
                { label: 'Ended', value: 'ended' },
                { label: 'Cancelled', value: 'cancelled' }
              ]}
              value={formData.status}
              onChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            />
          </BlockStack>
        </Modal.Section>
      </form>
    </Modal>
  );
};

export default AuctionForm;
