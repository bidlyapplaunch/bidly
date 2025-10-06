import React, { useState, useEffect } from 'react';
import {
  Modal,
  FormLayout,
  TextField,
  Button,
  Card,
  Text,
  Banner,
  Toast,
  Frame,
  Select,
  DatePicker,
  ButtonGroup
} from '@shopify/polaris';
import { format, parseISO, isValid } from 'date-fns';
import { auctionAPI } from '../services/api';

const AuctionForm = ({ 
  isOpen, 
  onClose, 
  auction = null, 
  onSave, 
  shopifyProducts = [] 
}) => {
  const [formData, setFormData] = useState({
    shopifyProductId: '',
    startTime: '',
    endTime: '',
    startingBid: '',
    buyNowPrice: ''
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [selectedDates, setSelectedDates] = useState({
    start: null,
    end: null
  });

  useEffect(() => {
    if (auction) {
      // Edit mode - populate form with existing data
      setFormData({
        shopifyProductId: auction.shopifyProductId || '',
        startTime: auction.startTime ? format(new Date(auction.startTime), "yyyy-MM-dd'T'HH:mm") : '',
        endTime: auction.endTime ? format(new Date(auction.endTime), "yyyy-MM-dd'T'HH:mm") : '',
        startingBid: auction.startingBid?.toString() || '',
        buyNowPrice: auction.buyNowPrice?.toString() || ''
      });
      
      setSelectedDates({
        start: auction.startTime ? new Date(auction.startTime) : null,
        end: auction.endTime ? new Date(auction.endTime) : null
      });
    } else {
      // Create mode - reset form
      setFormData({
        shopifyProductId: '',
        startTime: '',
        endTime: '',
        startingBid: '',
        buyNowPrice: ''
      });
      setSelectedDates({ start: null, end: null });
    }
    setErrors({});
  }, [auction, isOpen]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.shopifyProductId.trim()) {
      newErrors.shopifyProductId = 'Product ID is required';
    }
    
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    } else {
      const startTime = new Date(formData.startTime);
      const now = new Date();
      if (startTime <= now) {
        newErrors.startTime = 'Start time must be in the future';
      }
    }
    
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    } else {
      const endTime = new Date(formData.endTime);
      const startTime = new Date(formData.startTime);
      if (endTime <= startTime) {
        newErrors.endTime = 'End time must be after start time';
      }
    }
    
    if (!formData.startingBid || isNaN(parseFloat(formData.startingBid))) {
      newErrors.startingBid = 'Starting bid must be a valid number';
    } else if (parseFloat(formData.startingBid) <= 0) {
      newErrors.startingBid = 'Starting bid must be greater than 0';
    }
    
    if (formData.buyNowPrice && (isNaN(parseFloat(formData.buyNowPrice)) || parseFloat(formData.buyNowPrice) <= 0)) {
      newErrors.buyNowPrice = 'Buy now price must be a valid positive number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const auctionData = {
        shopifyProductId: formData.shopifyProductId.trim(),
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        startingBid: parseFloat(formData.startingBid),
        ...(formData.buyNowPrice && { buyNowPrice: parseFloat(formData.buyNowPrice) })
      };
      
      if (auction) {
        // Update existing auction
        await auctionAPI.updateAuction(auction.id, auctionData);
        setToastMessage('Auction updated successfully');
      } else {
        // Create new auction
        await auctionAPI.createAuction(auctionData);
        setToastMessage('Auction created successfully');
      }
      
      setShowToast(true);
      onSave?.();
      onClose();
      
    } catch (error) {
      console.error('Error saving auction:', error);
      setErrors({ 
        general: error.response?.data?.message || 'Failed to save auction' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDateChange = (field, date) => {
    setSelectedDates(prev => ({ ...prev, [field]: date }));
    
    if (date) {
      const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm");
      handleInputChange(field === 'start' ? 'startTime' : 'endTime', formattedDate);
    }
  };

  const productOptions = shopifyProducts.map(product => ({
    label: `${product.title} (${product.id})`,
    value: product.id
  }));

  return (
    <Frame>
      <Modal
        open={isOpen}
        onClose={onClose}
        title={auction ? 'Edit Auction' : 'Create New Auction'}
        primaryAction={{
          content: auction ? 'Update Auction' : 'Create Auction',
          onAction: handleSubmit,
          loading: loading,
          disabled: loading
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: onClose,
            disabled: loading
          }
        ]}
        large
      >
        <Modal.Section>
          {errors.general && (
            <Banner status="critical">
              <Text variant="bodyMd">{errors.general}</Text>
            </Banner>
          )}
          
          <FormLayout>
            <FormLayout.Group>
              <Select
                label="Shopify Product"
                options={[
                  { label: 'Select a product', value: '' },
                  ...productOptions
                ]}
                value={formData.shopifyProductId}
                onChange={(value) => handleInputChange('shopifyProductId', value)}
                error={errors.shopifyProductId}
                disabled={auction?.bidHistory?.length > 0}
              />
            </FormLayout.Group>

            <FormLayout.Group>
              <DatePicker
                month={selectedDates.start?.getMonth() || new Date().getMonth()}
                year={selectedDates.start?.getFullYear() || new Date().getFullYear()}
                selected={selectedDates.start}
                onMonthChange={(month, year) => {
                  // Handle month change if needed
                }}
                onChange={(date) => handleDateChange('start', date)}
                disableDatesBefore={new Date()}
              />
              <TextField
                label="Start Time"
                type="datetime-local"
                value={formData.startTime}
                onChange={(value) => handleInputChange('startTime', value)}
                error={errors.startTime}
                disabled={auction?.bidHistory?.length > 0}
                helpText="When the auction will begin"
              />
            </FormLayout.Group>

            <FormLayout.Group>
              <DatePicker
                month={selectedDates.end?.getMonth() || new Date().getMonth()}
                year={selectedDates.end?.getFullYear() || new Date().getFullYear()}
                selected={selectedDates.end}
                onMonthChange={(month, year) => {
                  // Handle month change if needed
                }}
                onChange={(date) => handleDateChange('end', date)}
                disableDatesBefore={selectedDates.start || new Date()}
              />
              <TextField
                label="End Time"
                type="datetime-local"
                value={formData.endTime}
                onChange={(value) => handleInputChange('endTime', value)}
                error={errors.endTime}
                disabled={auction?.bidHistory?.length > 0}
                helpText="When the auction will end"
              />
            </FormLayout.Group>

            <FormLayout.Group>
              <TextField
                label="Starting Bid"
                type="number"
                value={formData.startingBid}
                onChange={(value) => handleInputChange('startingBid', value)}
                error={errors.startingBid}
                prefix="$"
                step="0.01"
                min="0"
                disabled={auction?.bidHistory?.length > 0}
                helpText="Minimum bid amount"
              />
              <TextField
                label="Buy Now Price"
                type="number"
                value={formData.buyNowPrice}
                onChange={(value) => handleInputChange('buyNowPrice', value)}
                error={errors.buyNowPrice}
                prefix="$"
                step="0.01"
                min="0"
                helpText="Optional: Price to buy immediately"
              />
            </FormLayout.Group>

            {auction?.bidHistory?.length > 0 && (
              <Banner status="info">
                <Text variant="bodyMd">
                  This auction has bids. You can only update the buy now price and status.
                </Text>
              </Banner>
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>

      {showToast && (
        <Toast
          content={toastMessage}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </Frame>
  );
};

export default AuctionForm;
