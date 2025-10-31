import React, { useState, useEffect } from 'react';
import { 
  Page, 
  Card, 
  FormLayout, 
  TextField, 
  Select, 
  Button, 
  Text,
  Divider,
  Banner
} from '@shopify/polaris';
import { marketplaceCustomizationAPI } from '../services/api.js';

const MarketplaceCustomizationSettings = () => {
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
      hover: '#0056b3',
      gradient1: '#007bff',
      gradient2: '#0056b3'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const templates = [
    { label: 'Classic', value: 'Classic' },
    { label: 'Modern', value: 'Modern' },
    { label: 'Minimal', value: 'Minimal' },
    { label: 'Bold', value: 'Bold' }
  ];

  const fonts = [
    { label: 'Poppins', value: 'Poppins' },
    { label: 'Roboto', value: 'Roboto' },
    { label: 'Montserrat', value: 'Montserrat' },
    { label: 'Inter', value: 'Inter' }
  ];

  useEffect(() => {
    loadCustomization();
  }, []);

  const loadCustomization = async () => {
    try {
      setLoading(true);
      const response = await marketplaceCustomizationAPI.getCustomization();
      if (response.success) {
        setCustomization(response.customization);
      }
    } catch (error) {
      console.error('Error loading marketplace customization:', error);
      setMessage('Failed to load customization settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      const response = await marketplaceCustomizationAPI.saveCustomization(customization);
      if (response.success) {
        setMessage('Marketplace customization settings saved successfully!');
      } else {
        setMessage('Failed to save customization settings');
      }
    } catch (error) {
      console.error('Error saving marketplace customization:', error);
      setMessage('Failed to save customization settings');
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = (colorKey, color) => {
    setCustomization(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorKey]: color
      }
    }));
  };

  const ColorInput = ({ label, colorKey }) => (
    <div style={{ minWidth: 220 }}>
      <Text as="p" variant="bodySm" tone="subdued">
        {label}
      </Text>
      <input
        type="color"
        value={customization.colors[colorKey]}
        onChange={(e) => handleColorChange(colorKey, e.target.value)}
        style={{ width: 220, height: 40, border: '1px solid #DFE3E8', borderRadius: 6, background: '#fff' }}
      />
      <TextField
        label="Hex"
        labelHidden
        value={customization.colors[colorKey]}
        onChange={(v) => handleColorChange(colorKey, v)}
        autoComplete="off"
      />
    </div>
  );

  const handleTemplateChange = (value) => {
    setCustomization(prev => ({
      ...prev,
      template: value
    }));
  };

  const handleFontChange = (value) => {
    setCustomization(prev => ({
      ...prev,
      font: value
    }));
  };

  if (loading) {
    return (
      <Page title="Marketplace Customization">
        <Card>
          <Text>Loading customization settings...</Text>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Marketplace Customization" subtitle="Customize the appearance of your auction marketplace">
      {message && (
        <Banner
          title={message}
          status={message.includes('success') ? 'success' : 'critical'}
          onDismiss={() => setMessage('')}
        />
      )}
      
      <Card>
        <FormLayout>
          <Text variant="headingMd">Design Template</Text>
          <Select
            label="Template"
            options={templates}
            value={customization.template}
            onChange={handleTemplateChange}
          />
          
          <Select
            label="Font Family"
            options={fonts}
            value={customization.font}
            onChange={handleFontChange}
          />
          
          <Divider />
          
          <Text variant="headingMd">Color Scheme</Text>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Primary" colorKey="primary" />
              <ColorInput label="Background" colorKey="background" />
              <ColorInput label="Surface" colorKey="surface" />
            </div>
            
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Text Primary" colorKey="textPrimary" />
              <ColorInput label="Text Secondary" colorKey="textSecondary" />
              <ColorInput label="Border" colorKey="border" />
            </div>
            
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Accent" colorKey="accent" />
              <ColorInput label="Success" colorKey="success" />
              <ColorInput label="Error" colorKey="error" />
            </div>
            
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Hover" colorKey="hover" />
            </div>
            
            <Text variant="headingSm">Gradients</Text>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Gradient Start" colorKey="gradient1" />
              <ColorInput label="Gradient End" colorKey="gradient2" />
            </div>
            <div style={{
              marginTop: 8,
              padding: 16,
              background: `linear-gradient(135deg, ${customization.colors.gradient1 || '#007bff'}, ${customization.colors.gradient2 || '#0056b3'})`,
              borderRadius: 8,
              textAlign: 'center',
              color: '#fff',
              fontWeight: 600
            }}>
              Gradient Preview
            </div>

            {/* Live preview */}
            <div style={{
              marginTop: 16,
              border: `1px solid ${customization.colors.border}`,
              borderRadius: 8,
              overflow: 'hidden',
              fontFamily: customization.font || 'Inter, sans-serif',
              background: customization.colors.background
            }}>
              <div style={{
                background: customization.colors.surface,
                padding: 16,
                borderBottom: `1px solid ${customization.colors.border}`
              }}>
                <div style={{ 
                  fontSize: 20, 
                  fontWeight: 600, 
                  color: customization.colors.textPrimary,
                  marginBottom: 8
                }}>
                  Auction Product Title
                </div>
                <div style={{ 
                  fontSize: 14,
                  color: customization.colors.textSecondary 
                }}>
                  Product ID: 123456789
                </div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: customization.colors.textSecondary, marginBottom: 4 }}>
                      Current Bid
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: customization.colors.accent }}>
                      $89.00
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: customization.colors.textSecondary, marginBottom: 4 }}>
                      Starting Bid
                    </div>
                    <div style={{ fontSize: 18, color: customization.colors.textSecondary }}>
                      $50.00
                    </div>
                  </div>
                </div>
                <div style={{ 
                  fontSize: 14,
                  color: customization.colors.textSecondary,
                  marginBottom: 12
                }}>
                  Time Remaining: 2d 5h 30m
                </div>
                <button style={{
                  background: customization.colors.primary,
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}>Place Bid</button>
              </div>
            </div>
          </div>
          
          <Divider />
          
          <Button
            primary
            onClick={handleSave}
            loading={saving}
            disabled={saving}
          >
            Save Marketplace Customization
          </Button>
        </FormLayout>
      </Card>
    </Page>
  );
};

export default MarketplaceCustomizationSettings;
