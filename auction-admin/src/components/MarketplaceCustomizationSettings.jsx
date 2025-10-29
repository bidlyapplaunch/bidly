import React, { useState, useEffect } from 'react';
import { 
  Page, 
  Card, 
  FormLayout, 
  TextField, 
  Select, 
  Button, 
  ColorPicker,
  Stack,
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
      hover: '#0056b3'
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
          
          <Stack spacing="loose">
            <Stack distribution="fillEvenly">
              <ColorPicker
                label="Primary Color"
                color={customization.colors.primary}
                onChange={(color) => handleColorChange('primary', color)}
              />
              <ColorPicker
                label="Background Color"
                color={customization.colors.background}
                onChange={(color) => handleColorChange('background', color)}
              />
              <ColorPicker
                label="Surface Color"
                color={customization.colors.surface}
                onChange={(color) => handleColorChange('surface', color)}
              />
            </Stack>
            
            <Stack distribution="fillEvenly">
              <ColorPicker
                label="Primary Text"
                color={customization.colors.textPrimary}
                onChange={(color) => handleColorChange('textPrimary', color)}
              />
              <ColorPicker
                label="Secondary Text"
                color={customization.colors.textSecondary}
                onChange={(color) => handleColorChange('textSecondary', color)}
              />
              <ColorPicker
                label="Border Color"
                color={customization.colors.border}
                onChange={(color) => handleColorChange('border', color)}
              />
            </Stack>
            
            <Stack distribution="fillEvenly">
              <ColorPicker
                label="Accent Color"
                color={customization.colors.accent}
                onChange={(color) => handleColorChange('accent', color)}
              />
              <ColorPicker
                label="Success Color"
                color={customization.colors.success}
                onChange={(color) => handleColorChange('success', color)}
              />
              <ColorPicker
                label="Error Color"
                color={customization.colors.error}
                onChange={(color) => handleColorChange('error', color)}
              />
            </Stack>
            
            <Stack distribution="fillEvenly">
              <ColorPicker
                label="Hover Color"
                color={customization.colors.hover}
                onChange={(color) => handleColorChange('hover', color)}
              />
            </Stack>
          </Stack>
          
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
