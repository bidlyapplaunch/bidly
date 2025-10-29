import React, { useState, useEffect } from 'react';
import { 
  Page, 
  Card, 
  FormLayout, 
  TextField, 
  Select, 
  Button, 
  ColorPicker,
  Text,
  Divider,
  Banner,
  Collapsible
} from '@shopify/polaris';
import { widgetCustomizationAPI } from '../services/api.js';

const WidgetCustomizationSettings = () => {
  const [customization, setCustomization] = useState({
    template: 'Classic',
    font: 'Inter',
    colors: {
      primary: '#007bff',
      background: '#ffffff',
      surface: '#f8f9fa',
      textPrimary: '#212529',
      textSecondary: '#6c757d',
      textTitle: '#212529',
      textTimer: '#dc3545',
      textStatus: '#28a745',
      textCount: '#6c757d',
      textLabel: '#495057',
      textAmount: '#007bff',
      border: '#dee2e6',
      accent: '#28a745',
      success: '#28a745',
      error: '#dc3545',
      hover: '#0056b3',
      buttonPrimary: '#007bff',
      buttonSecondary: '#6c757d'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

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
      const response = await widgetCustomizationAPI.getCustomization();
      if (response.success) {
        setCustomization(response.customization);
      }
    } catch (error) {
      console.error('Error loading widget customization:', error);
      setMessage('Failed to load customization settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      const response = await widgetCustomizationAPI.saveCustomization(customization);
      if (response.success) {
        setMessage('Widget customization settings saved successfully!');
      } else {
        setMessage('Failed to save customization settings');
      }
    } catch (error) {
      console.error('Error saving widget customization:', error);
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
      <Page title="Widget Customization">
        <Card>
          <Text>Loading customization settings...</Text>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Widget Customization" subtitle="Customize the appearance of your auction widget">
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
            <Text variant="headingSm">Basic Colors</Text>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
            </div>
            
            <Text variant="headingSm">Text Colors</Text>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
                label="Title Text"
                color={customization.colors.textTitle}
                onChange={(color) => handleColorChange('textTitle', color)}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorPicker
                label="Timer Text"
                color={customization.colors.textTimer}
                onChange={(color) => handleColorChange('textTimer', color)}
              />
              <ColorPicker
                label="Status Text"
                color={customization.colors.textStatus}
                onChange={(color) => handleColorChange('textStatus', color)}
              />
              <ColorPicker
                label="Count Text"
                color={customization.colors.textCount}
                onChange={(color) => handleColorChange('textCount', color)}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorPicker
                label="Label Text"
                color={customization.colors.textLabel}
                onChange={(color) => handleColorChange('textLabel', color)}
              />
              <ColorPicker
                label="Amount Text"
                color={customization.colors.textAmount}
                onChange={(color) => handleColorChange('textAmount', color)}
              />
            </div>
            
            <Text variant="headingSm">UI Elements</Text>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorPicker
                label="Border Color"
                color={customization.colors.border}
                onChange={(color) => handleColorChange('border', color)}
              />
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
            </div>
            
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorPicker
                label="Error Color"
                color={customization.colors.error}
                onChange={(color) => handleColorChange('error', color)}
              />
              <ColorPicker
                label="Hover Color"
                color={customization.colors.hover}
                onChange={(color) => handleColorChange('hover', color)}
              />
            </div>
            
            <Text variant="headingSm">Buttons</Text>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorPicker
                label="Primary Button"
                color={customization.colors.buttonPrimary}
                onChange={(color) => handleColorChange('buttonPrimary', color)}
              />
              <ColorPicker
                label="Secondary Button"
                color={customization.colors.buttonSecondary}
                onChange={(color) => handleColorChange('buttonSecondary', color)}
              />
            </div>
          </div>
          
          <Divider />
          
          <Button
            primary
            onClick={handleSave}
            loading={saving}
            disabled={saving}
          >
            Save Widget Customization
          </Button>
        </FormLayout>
      </Card>
    </Page>
  );
};

export default WidgetCustomizationSettings;
