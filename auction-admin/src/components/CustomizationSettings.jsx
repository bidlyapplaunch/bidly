import React, { useState, useEffect } from 'react';
import {
  Card,
  FormLayout,
  Select,
  Button,
  Banner,
  Spinner,
  Text,
  Divider
} from '@shopify/polaris';
import { customizationAPI } from '../services/api';
import { useAppBridgeActions } from '../hooks/useAppBridge';

const CustomizationSettings = () => {
  const { getShopInfo } = useAppBridgeActions();
  const shopInfo = getShopInfo();
  const shopDomain = shopInfo?.shop;
  const [customization, setCustomization] = useState({
    primaryColor: '#3B82F6',
    font: 'Poppins',
    template: 'Classic'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Color options
  const colorOptions = [
    { label: 'Red', value: '#EF4444' },
    { label: 'Blue', value: '#3B82F6' },
    { label: 'Green', value: '#10B981' },
    { label: 'Black', value: '#000000' },
    { label: 'White', value: '#FFFFFF' },
    { label: 'Gold', value: '#F59E0B' },
    { label: 'Silver', value: '#6B7280' },
    { label: 'Purple', value: '#8B5CF6' }
  ];

  // Font options
  const fontOptions = [
    { label: 'Poppins', value: 'Poppins' },
    { label: 'Roboto', value: 'Roboto' },
    { label: 'Montserrat', value: 'Montserrat' },
    { label: 'Inter', value: 'Inter' }
  ];

  // Template options
  const templateOptions = [
    { label: 'Classic', value: 'Classic' },
    { label: 'Modern', value: 'Modern' },
    { label: 'Minimal', value: 'Minimal' },
    { label: 'Bold', value: 'Bold' }
  ];

  // Load customization settings on component mount
  useEffect(() => {
    if (shopDomain) {
      loadCustomizationSettings();
    }
  }, [shopDomain]);

  const loadCustomizationSettings = async () => {
    try {
      setLoading(true);
      const response = await customizationAPI.getCustomization(shopDomain);
      
      if (response.success) {
        setCustomization(response.customization);
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to load customization settings' });
      }
    } catch (error) {
      console.error('Error loading customization settings:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to load customization settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const response = await customizationAPI.saveCustomization(shopDomain, customization);

      if (response.success) {
        setMessage({ type: 'success', text: 'Customization settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving customization settings:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save customization settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = (color) => {
    setCustomization(prev => ({ ...prev, primaryColor: color }));
  };

  const handleFontChange = (font) => {
    setCustomization(prev => ({ ...prev, font }));
  };

  const handleTemplateChange = (template) => {
    setCustomization(prev => ({ ...prev, template }));
  };

  if (loading) {
    return (
      <Card sectioned>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <Spinner size="large" />
          <Text>Loading customization settings...</Text>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Text variant="headingMd" as="h1">
          Customization Settings
        </Text>
        
        <Text variant="bodyMd" color="subdued">
          Customize the appearance of your auction marketplace and product widgets.
        </Text>

        {message.text && (
          <Banner
            title={message.text}
            status={message.type === 'error' ? 'critical' : 'success'}
            onDismiss={() => setMessage({ type: '', text: '' })}
          />
        )}

        <Card sectioned>
          <FormLayout>
            <Text variant="headingSm" as="h2">
              Design Customization
            </Text>

            {/* Primary Color Selection */}
            <div>
              <Text variant="bodyMd" fontWeight="semibold" as="p">
                Primary Color
              </Text>
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {colorOptions.map((color) => (
                  <div
                    key={color.value}
                    onClick={() => handleColorChange(color.value)}
                    style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: color.value,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: customization.primaryColor === color.value ? '3px solid #000' : '2px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: color.value === '#FFFFFF' ? '#000' : '#fff',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                    title={color.label}
                  >
                    {customization.primaryColor === color.value && '✓'}
                  </div>
                ))}
              </div>
            </div>

            <Divider />

            {/* Font Selection */}
            <Select
              label="Font Family"
              options={fontOptions}
              value={customization.font}
              onChange={handleFontChange}
              helpText="Choose the font for your auction interface"
            />

            <Divider />

            {/* Template Selection */}
            <Select
              label="Design Template"
              options={templateOptions}
              value={customization.template}
              onChange={handleTemplateChange}
              helpText="Select a pre-designed layout template"
            />

            <Divider />

            {/* Preview Section */}
            <div>
              <Text variant="bodyMd" fontWeight="semibold" as="p">
                Preview
              </Text>
              <div
                style={{
                  marginTop: '12px',
                  padding: '20px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: '#f9fafb',
                  fontFamily: customization.font
                }}
              >
                <div
                  style={{
                    backgroundColor: customization.primaryColor,
                    color: customization.primaryColor === '#FFFFFF' ? '#000' : '#fff',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  Sample Button
                </div>
                <Text variant="bodyMd" as="p">
                  This is how your auction interface will look with the selected settings.
                </Text>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <Button
                primary
                onClick={handleSave}
                loading={saving}
                disabled={saving}
              >
                Save Customization Settings
              </Button>
            </div>
          </FormLayout>
        </Card>

        <Card sectioned>
          <Text variant="headingSm" as="h2">
            Template Descriptions
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <Text variant="bodyMd" fontWeight="semibold" as="p">Classic</Text>
              <Text variant="bodyMd" color="subdued" as="p">
                Clean and traditional design with moderate spacing and subtle shadows.
              </Text>
            </div>
            <div>
              <Text variant="bodyMd" fontWeight="semibold" as="p">Modern</Text>
              <Text variant="bodyMd" color="subdued" as="p">
                Contemporary design with rounded corners and enhanced shadows.
              </Text>
            </div>
            <div>
              <Text variant="bodyMd" fontWeight="semibold" as="p">Minimal</Text>
              <Text variant="bodyMd" color="subdued" as="p">
                Simple and clean design with minimal spacing and subtle effects.
              </Text>
            </div>
            <div>
              <Text variant="bodyMd" fontWeight="semibold" as="p">Bold</Text>
              <Text variant="bodyMd" color="subdued" as="p">
                Eye-catching design with larger spacing and prominent shadows.
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CustomizationSettings;
