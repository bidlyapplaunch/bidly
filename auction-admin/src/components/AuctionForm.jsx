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
import { useLocation, useNavigate } from 'react-router-dom';
import { shopifyAPI } from '../services/api';
import useAdminI18n from '../hooks/useAdminI18n';

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

const AuctionForm = ({ isOpen, onClose, auction, onSave, planInfo }) => {
  const i18n = useAdminI18n();
  const navigate = useNavigate();
  const location = useLocation();
  // Helper function to create a safe date
  const createSafeDate = (dateInput = null) => {
    if (dateInput && dateInput instanceof Date && !isNaN(dateInput.getTime())) {
      return dateInput;
    }
    return new Date();
  };

  const mergeDateWithExistingTime = (datePart, timeSource) => {
    const merged = createSafeDate(datePart);
    if (timeSource && timeSource instanceof Date && !isNaN(timeSource.getTime())) {
      merged.setHours(
        timeSource.getHours(),
        timeSource.getMinutes(),
        timeSource.getSeconds(),
        timeSource.getMilliseconds()
      );
    }
    return merged;
  };

  const planKey = (planInfo?.plan || 'free').toLowerCase();
  const allowAuctions = ['free', 'basic', 'pro', 'enterprise'].includes(planKey);
  const allowPopcorn = planKey === 'pro' || planKey === 'enterprise';
  const allowChat = planKey === 'enterprise';
  const auctionHasBids = Boolean(auction?.bidHistory?.length);

  const [formData, setFormData] = useState({
    shopifyProductId: '',
    startTime: createSafeDate(new Date(Date.now() + 60 * 60 * 1000)), // 1 hour from now
    endTime: createSafeDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // Tomorrow
    startingBid: 0,
    buyNowPrice: '',
    reservePrice: 0,
    status: 'pending',
    productData: null,
    // Popcorn auction settings
    popcornEnabled: false,
    popcornExtendSeconds: 15,
    popcornTriggerSeconds: 10,
    chatEnabled: allowChat
  });
  const [errors, setErrors] = useState({});
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [shopifyConfigured, setShopifyConfigured] = useState(false);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    if (!allowPopcorn && formData.popcornEnabled) {
      setFormData((prev) => ({
        ...prev,
        popcornEnabled: false
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowPopcorn]);

  useEffect(() => {
    if (!allowChat && formData.chatEnabled) {
      setFormData((prev) => ({
        ...prev,
        chatEnabled: false
      }));
    }
  }, [allowChat, formData.chatEnabled]);

  useEffect(() => {
    if (auction) {
      setFormData({
        shopifyProductId: auction.shopifyProductId || '',
        startTime: createSafeDate(auction.startTime ? new Date(auction.startTime) : null),
        endTime: createSafeDate(auction.endTime ? new Date(auction.endTime) : new Date(Date.now() + 24 * 60 * 60 * 1000)),
        startingBid: auction.startingBid || 0,
        buyNowPrice: auction.buyNowPrice || '',
        reservePrice: auction.reservePrice || 0,
        status: auction.status || 'pending',
        productData: auction.productData || null,
        // Popcorn auction settings
        popcornEnabled: auction.popcornEnabled || false,
        popcornExtendSeconds: auction.popcornExtendSeconds || 15,
        popcornTriggerSeconds: auction.popcornTriggerSeconds || 10,
        chatEnabled: allowChat ? (auction.chatEnabled !== undefined ? auction.chatEnabled : true) : false,
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
              reservePrice: 0,
              status: 'pending',
              productData: null,
              // Popcorn auction settings
              popcornEnabled: false,
              popcornExtendSeconds: 15,
              popcornTriggerSeconds: 10,
              chatEnabled: allowChat,
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
        setSearchError(
          i18n.translate('admin.auctions.form.search.apiFallback', {
            message: error.message
          })
        );
      } finally {
        setSearching(false);
      }
    } else {
      console.log('🔍 Search query too short, clearing results');
      setSearchResults([]);
    }
  }, [i18n]);


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
      newErrors.shopifyProductId = i18n.translate('admin.auctions.form.errors.productRequired');
    }
    if (formData.startingBid <= 0) {
      newErrors.startingBid = i18n.translate('admin.auctions.form.errors.startingBidPositive');
    }
    if (formData.endTime <= formData.startTime) {
      newErrors.endTime = i18n.translate('admin.auctions.form.errors.endTime');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const payload = {
        ...formData,
        startTime: formData.startTime.toISOString(),
        endTime: formData.endTime.toISOString(),
        startingBid: parseFloat(formData.startingBid),
        buyNowPrice: formData.buyNowPrice ? parseFloat(formData.buyNowPrice) : undefined,
        reservePrice: formData.reservePrice ? parseFloat(formData.reservePrice) : 0,
      };

      if (auction) {
        delete payload.shopifyProductId;
        if (auctionHasBids) {
          delete payload.startingBid;
        }
      }

      await onSave(payload);
      onClose();
    } catch (err) {
      console.error('Error saving auction:', err);
      setErrors({ general: err.message || i18n.translate('admin.auctions.form.errors.save') });
    }
  }, [formData, onSave, onClose, auctionHasBids, i18n]);

  const today = new Date();
  const { month, year } = { month: today.getMonth(), year: today.getFullYear() };
  const { search } = location || { search: '' };
  const handleUpgradeClick = useCallback(() => {
    navigate(`/plans${search || ''}`);
  }, [navigate, search]);

  if (!allowAuctions) {
    return (
      <Modal
        open={isOpen}
        onClose={onClose}
        title={i18n.translate('admin.auctions.form.planGate.title')}
        primaryAction={{
          content: i18n.translate('admin.common.viewPlans'),
          onAction: handleUpgradeClick
        }}
        secondaryActions={[{ content: i18n.translate('admin.common.close'), onAction: onClose }]}
      >
        <Modal.Section>
          <Card sectioned>
            <Text variant="bodyMd">
              {i18n.translate('admin.auctions.form.planGate.description')}
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Button primary onClick={handleUpgradeClick}>
                {i18n.translate('admin.auctions.form.planGate.explore')}
              </Button>
            </div>
          </Card>
        </Modal.Section>
      </Modal>
    );
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={
        auction
          ? i18n.translate('admin.auctions.form.titleEdit')
          : i18n.translate('admin.auctions.form.titleCreate')
      }
      primaryAction={{
        content: auction ? i18n.translate('admin.common.saveChanges') : i18n.translate('admin.common.createAuction'),
        onAction: handleSubmit
      }}
      secondaryActions={[{ content: i18n.translate('admin.common.cancel'), onAction: onClose }]}
    >
      <Modal.Section>
        <FormLayout>
          {!shopifyConfigured && (
            <Banner status="warning">
              {i18n.translate('admin.auctions.form.shopifyWarning')}
            </Banner>
          )}

          <Card sectioned>
            <Text variant="headingLg">{i18n.translate('admin.auctions.form.search.title')}</Text>
            <div style={{ marginTop: '16px' }}>
              <TextField
                label={i18n.translate('admin.auctions.form.search.label')}
                value={productSearchQuery}
                onChange={handleProductSearchChange}
                connectedRight={
                  searching ? (
                    <Spinner
                      accessibilityLabel={i18n.translate('admin.auctions.form.search.loadingLabel')}
                      size="small"
                    />
                  ) : null
                }
                autoComplete="off"
                placeholder={i18n.translate('admin.auctions.form.search.placeholder')}
              />
              {searchError && <Text color="critical">{searchError}</Text>}
              <Text variant="bodySm">
                {i18n.translate('admin.auctions.form.search.debug', { count: searchResults.length })}
              </Text>
              {searchResults.length > 0 && (
                <Card sectioned>
                  <Text variant="headingMd">{i18n.translate('admin.auctions.form.search.resultsTitle')}</Text>
                  <List type="bullet">
                    {searchResults.map((product) => (
                      <List.Item key={product.id}>
                        <Button plain onClick={() => handleProductSelect(product)}>
                          {i18n.translate('admin.auctions.form.search.resultLabel', {
                            title: product.title,
                            id: product.id,
                            price: product.price
                          })}
                        </Button>
                      </List.Item>
                    ))}
                  </List>
                </Card>
              )}
              {formData.productData && (
                <Card sectioned title={i18n.translate('admin.auctions.form.selectedProduct.title')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Text variant="bodyMd">
                      {i18n.translate('admin.auctions.form.selectedProduct.name', {
                        value: formData.productData.title
                      })}
                    </Text>
                    <Text variant="bodyMd">
                      {i18n.translate('admin.auctions.form.selectedProduct.vendor', {
                        value: formData.productData.vendor
                      })}
                    </Text>
                    <Text variant="bodyMd">
                      {i18n.translate('admin.auctions.form.selectedProduct.price', {
                        value: formData.productData.price
                      })}
                    </Text>
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
            label={i18n.translate('admin.auctions.form.fields.productId')}
            value={formData.shopifyProductId}
            onChange={(value) => handleChange(value, 'shopifyProductId')}
            error={errors.shopifyProductId}
            placeholder={i18n.translate('admin.auctions.form.fields.productIdPlaceholder')}
            disabled={Boolean(auction)}
          />

          <FormLayout.Group>
            <TextField
              label={i18n.translate('admin.auctions.form.fields.startDate')}
              type="date"
              value={formData.startTime.toISOString().split('T')[0]}
              onChange={(value) => {
                const [year, month, day] = value.split('-');
                const dateOnly = new Date(year, month - 1, day);
                const newDate = mergeDateWithExistingTime(dateOnly, formData.startTime);
                handleChange(newDate, 'startTime');
              }}
            />
            <TextField
              label={i18n.translate('admin.auctions.form.fields.startTime')}
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
              label={i18n.translate('admin.auctions.form.fields.endDate')}
              type="date"
              value={formData.endTime.toISOString().split('T')[0]}
              onChange={(value) => {
                const [year, month, day] = value.split('-');
                const dateOnly = new Date(year, month - 1, day);
                const newDate = mergeDateWithExistingTime(dateOnly, formData.endTime);
                handleChange(newDate, 'endTime');
              }}
            />
            <TextField
              label={i18n.translate('admin.auctions.form.fields.endTime')}
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
            label={i18n.translate('admin.auctions.form.fields.startingBid')}
            type="number"
            value={String(formData.startingBid)}
            onChange={(value) => handleChange(value, 'startingBid')}
            error={errors.startingBid}
            disabled={auctionHasBids}
            helpText={
              auctionHasBids
                ? i18n.translate('admin.auctions.form.fields.startingBidLocked')
                : undefined
            }
          />
          <TextField
            label={i18n.translate('admin.auctions.form.fields.buyNow')}
            type="number"
            value={String(formData.buyNowPrice)}
            onChange={(value) => handleChange(value, 'buyNowPrice')}
            error={errors.buyNowPrice}
          />
          <TextField
            label={i18n.translate('admin.auctions.form.fields.reservePrice')}
            type="number"
            value={String(formData.reservePrice)}
            onChange={(value) => handleChange(value, 'reservePrice')}
            error={errors.reservePrice}
            helpText={i18n.translate('admin.auctions.form.fields.reserveHelp')}
            min="0"
          />

          <Card sectioned>
            <Text variant="headingMd">{i18n.translate('admin.auctions.form.popcorn.title')}</Text>
            <Text variant="bodyMd" color="subdued">
              {i18n.translate('admin.auctions.form.popcorn.description')}
            </Text>
            
            <div style={{ marginTop: '16px' }}>
              <Checkbox
                label={i18n.translate('admin.auctions.form.popcorn.enable')}
                checked={formData.popcornEnabled}
                onChange={(checked) => handleChange(checked, 'popcornEnabled')}
                disabled={!allowPopcorn}
                helpText={
                  allowPopcorn
                    ? i18n.translate('admin.auctions.form.popcorn.help')
                    : i18n.translate('admin.auctions.form.popcorn.upgradeHelp')
                }
              />
            </div>

            {formData.popcornEnabled && (
              <FormLayout.Group>
                <TextField
                  label={i18n.translate('admin.auctions.form.popcorn.trigger')}
                  type="number"
                  value={String(formData.popcornTriggerSeconds)}
                  onChange={(value) => handleChange(parseInt(value) || 10, 'popcornTriggerSeconds')}
                  helpText={i18n.translate('admin.auctions.form.popcorn.triggerHelp')}
                  min="1"
                  max="60"
                />
                <TextField
                  label={i18n.translate('admin.auctions.form.popcorn.extension')}
                  type="number"
                  value={String(formData.popcornExtendSeconds)}
                  onChange={(value) => handleChange(parseInt(value) || 15, 'popcornExtendSeconds')}
                  helpText={i18n.translate('admin.auctions.form.popcorn.extensionHelp')}
                  min="5"
                  max="300"
                />
              </FormLayout.Group>
            )}
          </Card>

          {allowChat && (
            <Card sectioned>
              <Text variant="headingMd">{i18n.translate('admin.auctions.form.chat.title')}</Text>
              <Text variant="bodyMd" color="subdued">
                {i18n.translate('admin.auctions.form.chat.description')}
              </Text>
              <div style={{ marginTop: '16px' }}>
                <Checkbox
                  label={i18n.translate('admin.auctions.form.chat.toggle')}
                  checked={formData.chatEnabled}
                  onChange={(checked) => handleChange(checked, 'chatEnabled')}
                  helpText={i18n.translate('admin.auctions.form.chat.help')}
                />
              </div>
            </Card>
          )}

          {!allowChat && (
            <Card sectioned>
              <Text variant="headingMd">{i18n.translate('admin.auctions.form.chatPremium.title')}</Text>
              <Text variant="bodyMd" color="subdued">
                {i18n.translate('admin.auctions.form.chatPremium.description')}
              </Text>
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Text variant="bodySm" color="subdued">
                  {i18n.translate('admin.auctions.form.chatPremium.available')}
                </Text>
                <Button onClick={handleUpgradeClick} primary>
                  {i18n.translate('admin.common.viewPlans')}
                </Button>
              </div>
            </Card>
          )}

          {errors.general && <Text color="critical">{errors.general}</Text>}
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
};

export default AuctionForm;