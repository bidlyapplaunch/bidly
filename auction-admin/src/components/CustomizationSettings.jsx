import React, { useState, useEffect } from 'react';
import {
  Card,
  FormLayout,
  Select,
  Button,
  Banner,
  Spinner,
  Text,
  Divider,
  TextField
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { customizationAPI } from '../services/api';
import { useAppBridgeActions } from '../hooks/useAppBridge';

const CustomizationSettings = () => {
  const navigate = useNavigate();
  const { getShopInfo } = useAppBridgeActions();
  const shopInfo = getShopInfo();
  const shopDomain = shopInfo?.shop;

  const [customization, setCustomization] = useState({
    template: 'Classic',
    font: 'Inter',
    colors: {
      primary: '#007bff',
      background: '#f5f5f5',
      surface: '#ffffff',
      textPrimary: '#222222',
      textSecondary: '#666666',
      border: '#dddddd',
      accent: '#00b894',
      success: '#00c851',
      error: '#ff4444',
      hover: '#0056b3'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Font options
  const fontOptions = [
    { label: 'Inter', value: 'Inter' },
    { label: 'Poppins', value: 'Poppins' },
    { label: 'Roboto', value: 'Roboto' },
    { label: 'Montserrat', value: 'Montserrat' }
  ];

  // Template options
  const templateOptions = [
    { label: 'Classic', value: 'Classic' },
    { label: 'Modern', value: 'Modern' },
    { label: 'Minimal', value: 'Minimal' },
    { label: 'Bold', value: 'Bold' }
  ];

  // Color field definitions
  const colorFields = [
    { key: 'primary', label: 'Primary Color', description: 'Main action buttons and highlights' },
    { key: 'background', label: 'Background Color', description: 'Main page background' },
    { key: 'surface', label: 'Surface Color', description: 'Card and widget backgrounds' },
    { key: 'textPrimary', label: 'Primary Text', description: 'Main text color' },
    { key: 'textSecondary', label: 'Secondary Text', description: 'Muted text and labels' },
    { key: 'border', label: 'Border Color', description: 'Borders and dividers' },
    { key: 'accent', label: 'Accent Color', description: 'Prices, timers, and highlights' },
    { key: 'success', label: 'Success Color', description: 'Success messages and winning bids' },
    { key: 'error', label: 'Error Color', description: 'Error messages and failed actions' },
    { key: 'hover', label: 'Hover Color', description: 'Button hover states' }
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

  const handleColorChange = (colorKey, value) => {
    setCustomization(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorKey]: value
      }
    }));
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
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <Button onClick={() => navigate(-1)}>Back</Button>
        </div>
        <Text variant="headingMd" as="h1">
          Customization Settings
        </Text>
        
        <Text variant="bodyMd" color="subdued">
          Customize every aspect of your auction marketplace and product widgets with comprehensive color and design controls.
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
              Design Template & Font
            </Text>

            {/* Font Selection */}
            <Select
              label="Font Family"
              options={fontOptions}
              value={customization.font}
              onChange={handleFontChange}
              helpText="Choose the font for your auction interface"
            />

            {/* Template Selection */}
            <Select
              label="Design Template"
              options={templateOptions}
              value={customization.template}
              onChange={handleTemplateChange}
              helpText="Select a pre-designed layout template"
            />

            <Divider />

            <Text variant="headingSm" as="h2">
              Color Customization
            </Text>
            <Text variant="bodyMd" color="subdued" as="p">
              Customize every color in your auction interface. Each color affects different UI elements.
            </Text>

            {/* Color Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
              {colorFields.map((field) => (
                <div key={field.key}>
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    {field.label}
                  </Text>
                  <Text variant="bodyMd" color="subdued" as="p" style={{ fontSize: '12px', marginBottom: '8px' }}>
                    {field.description}
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="color"
                      value={customization.colors[field.key]}
                      onChange={(e) => handleColorChange(field.key, e.target.value)}
                      style={{
                        width: '50px',
                        height: '40px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    />
                    <TextField
                      value={customization.colors[field.key]}
                      onChange={(value) => handleColorChange(field.key, value)}
                      placeholder="#000000"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Divider />

            {/* Live Preview */}
            <div>
              <Text variant="headingSm" as="h2">
                Live Preview
              </Text>
              <Text variant="bodyMd" color="subdued" as="p" style={{ marginBottom: '16px' }}>
                See how your customization will look in the auction interface.
              </Text>
              <div
                style={{
                  padding: '24px',
                  border: `1px solid ${customization.colors.border}`,
                  borderRadius: 'var(--bidly-border-radius, 6px)',
                  backgroundColor: customization.colors.background,
                  fontFamily: `'${customization.font}', sans-serif`,
                  boxShadow: 'var(--bidly-shadow, 0 2px 4px 0 rgba(0, 0, 0, 0.1))'
                }}
              >
                {/* Auction Card Preview */}
                <div
                  style={{
                    backgroundColor: customization.colors.surface,
                    border: `1px solid ${customization.colors.border}`,
                    borderRadius: 'var(--bidly-border-radius, 6px)',
                    padding: '20px',
                    marginBottom: '16px'
                  }}
                >
                  <Text variant="headingMd" as="h3" style={{ color: customization.colors.textPrimary, marginBottom: '8px' }}>
                    Sample Auction Item
                  </Text>
                  <Text variant="bodyMd" as="p" style={{ color: customization.colors.textSecondary, marginBottom: '12px' }}>
                    Current Bid: <span style={{ color: customization.colors.accent, fontWeight: 'bold' }}>$150.00</span>
                  </Text>
                  <Text variant="bodyMd" as="p" style={{ color: customization.colors.textSecondary, marginBottom: '16px' }}>
                    Time Remaining: <span style={{ color: customization.colors.accent }}>2h 15m</span>
                  </Text>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Button
                      primary
                      onClick={() => alert('Simulated Bid!')}
                      style={{
                        backgroundColor: customization.colors.primary,
                        borderColor: customization.colors.primary,
                        color: 'white',
                        padding: 'var(--bidly-button-padding, 0.625rem 1.25rem)',
                        borderRadius: 'var(--bidly-border-radius, 6px)',
                        fontFamily: `'${customization.font}', sans-serif`
                      }}
                    >
                      Place Bid
                    </Button>
                    <Button
                      onClick={() => alert('Simulated Buy Now!')}
                      style={{
                        backgroundColor: customization.colors.success,
                        borderColor: customization.colors.success,
                        color: 'white',
                        padding: 'var(--bidly-button-padding, 0.625rem 1.25rem)',
                        borderRadius: 'var(--bidly-border-radius, 6px)',
                        fontFamily: `'${customization.font}', sans-serif`
                      }}
                    >
                      Buy Now
                    </Button>
                  </div>
                </div>

                {/* Status Messages Preview */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: customization.colors.success,
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    Success Message
                  </div>
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: customization.colors.error,
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    Error Message
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
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