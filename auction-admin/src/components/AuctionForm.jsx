import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  FormLayout,
  TextField,
  Button,
  Select,
  Card,
  Text,
  List,
  Spinner,
  Banner,
  Checkbox
} from '@shopify/polaris';
import { shopifyAPI } from '../services/api';

// Mock products for development
const getMockProducts = (query) => {
  const mockProducts = [
    {
      id: 1,
      title: 'Yellow Snowboard',
      vendor: 'SnowSports Co',
      price: '$299.99',
      images: [{ src: 'https://via.placeholder.com/150x150/FFFF00/000000?text=Yellow+Snowboard', alt: 'Yellow Snowboard' }]
    },
    {
      id: 2,
      title: 'Blue Winter Jacket',
      vendor: 'WinterWear',
      price: '$149.99',
      images: [{ src: 'https://via.placeholder.com/150x150/0000FF/FFFFFF?text=Blue+Jacket', alt: 'Blue Winter Jacket' }]
    },
    {
      id: 3,
      title: 'Red Ski Boots',
      vendor: 'SkiGear Pro',
      price: '$199.99',
      images: [{ src: 'https://via.placeholder.com/150x150/FF0000/FFFFFF?text=Red+Boots', alt: 'Red Ski Boots' }]
    }
  ];

  // Filter based on query
  return mockProducts.filter(product => 
    product.title.toLowerCase().includes(query.toLowerCase()) ||
    product.vendor.toLowerCase().includes(query.toLowerCase())
  );
};

const AuctionForm = ({ isOpen, onClose, auction, onSave }) => {
  // Helper function to create a safe date
  const createSafeDate = (dateInput = null) => {
    if (dateInput && dateInput instanceof Date && !isNaN(dateInput.getTime())) {
      return dateInput;
    }
    return new Date();
  };

  const [formData, setFormData] = useState({
    shopifyProductId: '',
    startTime: createSafeDate(new Date(Date.now() + 60 * 60 * 1000)), // 1 hour from now
    endTime: createSafeDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // Tomorrow
    startingBid: 0,
    buyNowPrice: '',
    status: 'pending',
    productData: null,
    // Popcorn auction settings
    popcornEnabled: false,
    popcornExtendSeconds: 15,
    popcornTriggerSeconds: 10,
  });
  const [errors, setErrors] = useState({});
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [shopifyConfigured, setShopifyConfigured] = useState(false);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    if (auction) {
      setFormData({
        shopifyProductId: auction.shopifyProductId || '',
        startTime: createSafeDate(auction.startTime ? new Date(auction.startTime) : null),
        endTime: createSafeDate(auction.endTime ? new Date(auction.endTime) : new Date(Date.now() + 24 * 60 * 60 * 1000)),
        startingBid: auction.startingBid || 0,
        buyNowPrice: auction.buyNowPrice || '',
        status: auction.status || 'pending',
        productData: auction.productData || null,
        // Popcorn auction settings
        popcornEnabled: auction.popcornEnabled || false,
        popcornExtendSeconds: auction.popcornExtendSeconds || 15,
        popcornTriggerSeconds: auction.popcornTriggerSeconds || 10,
      });
      if (auction.productData?.title) {
        setProductSearchQuery(auction.productData.title);
      }
          } else {
            setFormData({
              shopifyProductId: '',
              startTime: createSafeDate(new Date(Date.now() + 60 * 60 * 1000)), // 1 hour from now
              endTime: createSafeDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // Tomorrow
              startingBid: 0,
              buyNowPrice: '',
              status: 'pending',
              productData: null,
              // Popcorn auction settings
              popcornEnabled: false,
              popcornExtendSeconds: 15,
              popcornTriggerSeconds: 10,
            });
            setProductSearchQuery('');
          }
    setErrors({});
    setSearchResults([]);
    setSearchError(null);
  }, [auction, isOpen]);

  useEffect(() => {
    const checkShopifyStatus = async () => {
      try {
        const status = await shopifyAPI.getServiceStatus();
        console.log('Shopify status:', status);
        setShopifyConfigured(status.configured || true); // Temporarily allow search
      } catch (error) {
        console.error('Error checking Shopify service status:', error);
        setShopifyConfigured(true); // Temporarily enable search even if status check fails
      }
    };
    checkShopifyStatus();
  }, []);

  const handleChange = useCallback((value, id) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: undefined }));
  }, []);


  const handleProductSearchChange = useCallback(async (value) => {
    console.log('🔍 Search input changed:', value);
    setProductSearchQuery(value);
    setSearchError(null);
    
    if (value.length > 2) {
      console.log('🔍 Search query is long enough, starting search...');
      setSearching(true);
      
      // Try real API first
      try {
        console.log('🔍 Trying real Shopify API...');
        console.log('🔍 API call details:', { query: value, endpoint: '/shopify/products/search' });
        const response = await shopifyAPI.searchProducts(value);
        console.log('🔍 Real API response:', response);
        
        // Check if the response has the expected structure
        if (response && Array.isArray(response)) {
          const products = response;
          console.log('🔍 Products found:', products.length);
          if (products.length > 0) {
            setSearchResults(products);
            console.log('✅ Using real Shopify data');
          } else {
            throw new Error('No products found from real API');
          }
        } else {
          console.log('🔍 Unexpected response structure:', response);
          throw new Error('Invalid response structure from API');
        }
      } catch (error) {
        console.log('❌ Real API failed:', error);
        console.log('❌ Error details:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        console.log('🔍 Falling back to mock data...');
        
        // Fallback to mock data
        const mockProducts = getMockProducts(value);
        console.log('🔍 Mock products found:', mockProducts);
        setSearchResults(mockProducts);
        setSearchError(`Real API failed: ${error.message}. Using demo data.`);
      } finally {
        setSearching(false);
      }
    } else {
      console.log('🔍 Search query too short, clearing results');
      setSearchResults([]);
    }
  }, []);


  const handleProductSelect = useCallback(async (product) => {
    setFormData((prev) => ({
      ...prev,
      shopifyProductId: product.id,
      productData: product,
    }));
    setProductSearchQuery(product.title);
    setSearchResults([]);
    setErrors((prev) => ({ ...prev, shopifyProductId: undefined }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const newErrors = {};
    if (!formData.shopifyProductId) {
      newErrors.shopifyProductId = 'Shopify Product is required';
    }
    if (formData.startingBid <= 0) {
      newErrors.startingBid = 'Starting bid must be greater than 0';
    }
    if (formData.endTime <= formData.startTime) {
      newErrors.endTime = 'End time must be after start time';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSave({
        ...formData,
        startTime: formData.startTime.toISOString(),
        endTime: formData.endTime.toISOString(),
        startingBid: parseFloat(formData.startingBid),
        buyNowPrice: formData.buyNowPrice ? parseFloat(formData.buyNowPrice) : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Error saving auction:', err);
      setErrors({ general: err.message || 'Failed to save auction' });
    }
  }, [formData, onSave, onClose]);

  const today = new Date();
  const { month, year } = { month: today.getMonth(), year: today.getFullYear() };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={auction ? 'Edit Auction' : 'Create New Auction'}
      primaryAction={{
        content: auction ? 'Save Changes' : 'Create Auction',
        onAction: handleSubmit,
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <FormLayout>
          {!shopifyConfigured && (
            <Banner status="warning">
              Shopify API is not configured. Product search will be disabled. Please check your backend .env settings.
            </Banner>
          )}

          <Card sectioned>
            <Text variant="headingLg">🔍 Search Shopify Products</Text>
            <div style={{ marginTop: '16px' }}>
              <TextField
                label="Search for Shopify Product"
                value={productSearchQuery}
                onChange={handleProductSearchChange}
                connectedRight={searching ? <Spinner accessibilityLabel="Searching products" size="small" /> : null}
                autoComplete="off"
                placeholder="Type product name to search..."
              />
              {searchError && <Text color="critical">{searchError}</Text>}
              <Text variant="bodySm">Debug: {searchResults.length} results found</Text>
              {searchResults.length > 0 && (
                <Card sectioned>
                  <Text variant="headingMd">Search Results:</Text>
                  <List type="bullet">
                    {searchResults.map((product) => (
                      <List.Item key={product.id}>
                        <Button plain onClick={() => handleProductSelect(product)}>
                          {product.title} (ID: {product.id}) - {product.price}
                        </Button>
                      </List.Item>
                    ))}
                  </List>
                </Card>
              )}
              {formData.productData && (
                <Card sectioned title="Selected Product Details">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <Text variant="bodyMd">Title: {formData.productData.title}</Text>
                          <Text variant="bodyMd">Vendor: {formData.productData.vendor}</Text>
                          <Text variant="bodyMd">Price: {formData.productData.price}</Text>
                          {formData.productData.images && formData.productData.images.length > 0 && (
                            <img
                              src={formData.productData.images[0].src}
                              alt={formData.productData.title}
                              style={{ maxWidth: '100px', maxHeight: '100px' }}
                            />
                          )}
                        </div>
                </Card>
              )}
            </div>
          </Card>

          <TextField
            label="Shopify Product ID"
            value={formData.shopifyProductId}
            onChange={(value) => handleChange(value, 'shopifyProductId')}
            error={errors.shopifyProductId}
            placeholder="Product ID will be filled automatically when you select a product"
          />

          <FormLayout.Group>
            <TextField
              label="Start Date"
              type="date"
              value={formData.startTime.toISOString().split('T')[0]}
              onChange={(value) => {
                const [year, month, day] = value.split('-');
                const newDate = createSafeDate(new Date(year, month - 1, day));
                handleChange(newDate, 'startTime');
              }}
            />
            <TextField
              label="Start Time"
              type="time"
              value={formData.startTime.toTimeString().slice(0, 5)}
              onChange={(value) => {
                const [hours, minutes] = value.split(':');
                const newTime = createSafeDate(new Date(formData.startTime));
                newTime.setHours(parseInt(hours, 10));
                newTime.setMinutes(parseInt(minutes, 10));
                handleChange(newTime, 'startTime');
              }}
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <TextField
              label="End Date"
              type="date"
              value={formData.endTime.toISOString().split('T')[0]}
              onChange={(value) => {
                const [year, month, day] = value.split('-');
                const newDate = createSafeDate(new Date(year, month - 1, day));
                handleChange(newDate, 'endTime');
              }}
            />
            <TextField
              label="End Time"
              type="time"
              value={formData.endTime.toTimeString().slice(0, 5)}
              onChange={(value) => {
                const [hours, minutes] = value.split(':');
                const newTime = createSafeDate(new Date(formData.endTime));
                newTime.setHours(parseInt(hours, 10));
                newTime.setMinutes(parseInt(minutes, 10));
                handleChange(newTime, 'endTime');
              }}
            />
          </FormLayout.Group>

          <TextField
            label="Starting Bid"
            type="number"
            value={String(formData.startingBid)}
            onChange={(value) => handleChange(value, 'startingBid')}
            error={errors.startingBid}
          />
          <TextField
            label="Buy Now Price (Optional)"
            type="number"
            value={String(formData.buyNowPrice)}
            onChange={(value) => handleChange(value, 'buyNowPrice')}
            error={errors.buyNowPrice}
          />

          <Card sectioned>
            <Text variant="headingMd">🍿 Popcorn Auction Settings (Premium Feature)</Text>
            <Text variant="bodyMd" color="subdued">
              Enable automatic time extension when bids are placed near the end of the auction.
            </Text>
            
            <div style={{ marginTop: '16px' }}>
              <Checkbox
                label="Enable Popcorn Bidding"
                checked={formData.popcornEnabled}
                onChange={(checked) => handleChange(checked, 'popcornEnabled')}
                helpText="Automatically extend auction time when bids are placed near the end"
              />
            </div>

            {formData.popcornEnabled && (
              <FormLayout.Group>
                <TextField
                  label="Trigger Threshold (seconds)"
                  type="number"
                  value={String(formData.popcornTriggerSeconds)}
                  onChange={(value) => handleChange(parseInt(value) || 10, 'popcornTriggerSeconds')}
                  helpText="Extend auction when this many seconds remain"
                  min="1"
                  max="60"
                />
                <TextField
                  label="Extension Duration (seconds)"
                  type="number"
                  value={String(formData.popcornExtendSeconds)}
                  onChange={(value) => handleChange(parseInt(value) || 15, 'popcornExtendSeconds')}
                  helpText="How many seconds to add to the auction"
                  min="5"
                  max="300"
                />
              </FormLayout.Group>
            )}
          </Card>

          {errors.general && <Text color="critical">{errors.general}</Text>}
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
};

export default AuctionForm;