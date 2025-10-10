import React, { useState, useEffect } from 'react';
import {
  Modal,
  FormLayout,
  TextField,
  Button,
  Select,
  Text,
  Card,
  Banner
} from '@shopify/polaris';
import { auctionAPI, shopifyAPI } from '../services/api';

const AuctionFormNew = ({ isOpen, onClose, auction, onSave }) => {
  const [formData, setFormData] = useState({
    shopifyProductId: '',
    startTime: '',
    endTime: '',
    startingBid: '',
    buyNowPrice: '',
    status: 'pending'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (auction) {
      setFormData({
        shopifyProductId: auction.shopifyProductId || '',
        startTime: auction.startTime ? new Date(auction.startTime).toISOString().slice(0, 16) : '',
        endTime: auction.endTime ? new Date(auction.endTime).toISOString().slice(0, 16) : '',
        startingBid: auction.startingBid?.toString() || '',
        buyNowPrice: auction.buyNowPrice?.toString() || '',
        status: auction.status || 'pending'
      });
    } else {
      setFormData({
        shopifyProductId: '',
        startTime: '',
        endTime: '',
        startingBid: '',
        buyNowPrice: '',
        status: 'pending'
      });
    }
    setError('');
  }, [auction, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = {
        ...formData,
        startingBid: parseFloat(formData.startingBid),
        buyNowPrice: formData.buyNowPrice ? parseFloat(formData.buyNowPrice) : undefined,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString()
      };

      if (auction) {
        await auctionAPI.updateAuction(auction._id, data);
      } else {
        await auctionAPI.createAuction(data);
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await shopifyAPI.searchProducts(query, 10);
      setSearchResults(response.data || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleProductSearchChange = (value) => {
    setProductSearchQuery(value);
    searchProducts(value);
  };

  const handleProductSelect = (product) => {
    setFormData(prev => ({
      ...prev,
      shopifyProductId: product.id
    }));
    setProductSearchQuery(product.title);
    setSearchResults([]);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={auction ? 'Edit Auction' : 'Create New Auction'}
      primaryAction={{
        content: auction ? 'Update' : 'Create',
        onAction: handleSubmit,
        loading
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose
        }
      ]}
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <Banner status="critical" onDismiss={() => setError('')}>
            {error}
          </Banner>
        )}
        
        <FormLayout>
          {/* SHOPIFY PRODUCT SEARCH - VERY VISIBLE */}
          <Card sectioned>
            <Text variant="headingLg">🔍 SEARCH SHOPIFY PRODUCTS</Text>
            <div style={{ marginTop: '16px' }}>
              <TextField
                label="Product Search"
                value={productSearchQuery}
                onChange={handleProductSearchChange}
                placeholder="Type to search for products..."
                loading={searching}
                helpText="Start typing to search for Shopify products"
              />
              
              {searchResults.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <Text variant="headingMd">Search Results:</Text>
                  {searchResults.map((product) => (
                    <div 
                      key={product.id}
                      style={{ 
                        padding: '8px', 
                        border: '1px solid #ccc', 
                        margin: '4px 0',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: '#f6f6f7'
                      }}
                      onClick={() => handleProductSelect(product)}
                    >
                      <div><strong>{product.title}</strong></div>
                      <div>ID: {product.id} | Price: ${product.price}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <FormLayout.Group>
            <TextField
              label="Shopify Product ID"
              value={formData.shopifyProductId}
              onChange={(value) => setFormData(prev => ({ ...prev, shopifyProductId: value }))}
              placeholder="e.g., prod_123"
              required
            />
            <TextField
              label="Start Time"
              type="datetime-local"
              value={formData.startTime}
              onChange={(value) => setFormData(prev => ({ ...prev, startTime: value }))}
              required
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <TextField
              label="End Time"
              type="datetime-local"
              value={formData.endTime}
              onChange={(value) => setFormData(prev => ({ ...prev, endTime: value }))}
              required
            />
            <Select
              label="Status"
              options={[
                { label: 'Pending', value: 'pending' },
                { label: 'Active', value: 'active' },
                { label: 'Ended', value: 'ended' },
                { label: 'Closed', value: 'closed' }
              ]}
              value={formData.status}
              onChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <TextField
              label="Starting Bid"
              type="number"
              value={formData.startingBid}
              onChange={(value) => setFormData(prev => ({ ...prev, startingBid: value }))}
              placeholder="0.00"
              required
            />
            <TextField
              label="Buy Now Price (Optional)"
              type="number"
              value={formData.buyNowPrice}
              onChange={(value) => setFormData(prev => ({ ...prev, buyNowPrice: value }))}
              placeholder="0.00"
            />
          </FormLayout.Group>
        </FormLayout>
      </form>
    </Modal>
  );
};

export default AuctionFormNew;
