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
      buttonSecondary: '#6c757d',
      gradient1: '#007bff',
      gradient2: '#0056b3'
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
              <ColorInput label="Primary" colorKey="primary" />
              <ColorInput label="Background" colorKey="background" />
              <ColorInput label="Surface" colorKey="surface" />
            </div>
            
            <Text variant="headingSm">Text Colors</Text>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Text Primary" colorKey="textPrimary" />
              <ColorInput label="Text Secondary" colorKey="textSecondary" />
              <ColorInput label="Title" colorKey="textTitle" />
            </div>
            
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Timer" colorKey="textTimer" />
              <ColorInput label="Status" colorKey="textStatus" />
              <ColorInput label="Count" colorKey="textCount" />
            </div>
            
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Label" colorKey="textLabel" />
              <ColorInput label="Amount" colorKey="textAmount" />
            </div>
            
            <Text variant="headingSm">UI Elements</Text>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Border" colorKey="border" />
              <ColorInput label="Accent" colorKey="accent" />
              <ColorInput label="Success" colorKey="success" />
            </div>
            
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Error" colorKey="error" />
              <ColorInput label="Hover" colorKey="hover" />
            </div>
            
            <Text variant="headingSm">Buttons</Text>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="Button Primary" colorKey="buttonPrimary" />
              <ColorInput label="Button Secondary" colorKey="buttonSecondary" />
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
              border: '1px solid #DFE3E8',
              borderRadius: 8,
              overflow: 'hidden',
              fontFamily: customization.font || 'Inter, sans-serif'
            }}>
              <div style={{
                background: customization.colors.surface,
                padding: 16,
                borderBottom: `1px solid ${customization.colors.border}`
              }}>
                <div style={{ 
                  fontSize: 18, 
                  fontWeight: 600, 
                  color: customization.colors.textTitle,
                  marginBottom: 8
                }}>
                  Live Auction
                </div>
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontSize: 16,
                  color: customization.colors.textTimer, 
                  marginTop: 6,
                  marginBottom: 4
                }}>
                  00d 12h 45m 20s
                </div>
                <div style={{ 
                  fontSize: 12,
                  color: customization.colors.textStatus 
                }}>
                  ● ACTIVE
                </div>
              </div>
              <div style={{ 
                padding: 16, 
                background: customization.colors.background 
              }}>
                <div style={{ 
                  fontSize: 12,
                  color: customization.colors.textLabel, 
                  marginBottom: 4 
                }}>
                  Current Bid:
                </div>
                <div style={{ 
                  color: customization.colors.textAmount, 
                  fontWeight: 700, 
                  fontSize: 24, 
                  marginBottom: 8 
                }}>
                  $123.00
                </div>
                <div style={{ 
                  fontSize: 12,
                  color: customization.colors.textCount, 
                  marginBottom: 12 
                }}>
                  5 bids
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{
                    background: customization.colors.buttonPrimary,
                    color: '#fff',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500
                  }}>Place Bid</button>
                  <button style={{
                    background: customization.colors.success,
                    color: '#fff',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500
                  }}>Buy Now</button>
                </div>
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
            Save Widget Customization
          </Button>
        </FormLayout>
      </Card>
    </Page>
  );
};

export default WidgetCustomizationSettings;
