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

            {/* Live preview */}
            <div style={{
              marginTop: 8,
              border: '1px solid #DFE3E8',
              borderRadius: 8,
              overflow: 'hidden'
            }}>
              <div style={{
                background: customization.colors.surface,
                padding: 16,
                borderBottom: `1px solid ${customization.colors.border}`
              }}>
                <Text variant="headingMd" as="h3" style={{ color: customization.colors.textTitle }}>
                  Widget Preview
                </Text>
                <div style={{ fontFamily: 'monospace', color: customization.colors.textTimer, marginTop: 6 }}>
                  00d 12h 45m 20s
                </div>
              </div>
              <div style={{ padding: 16, background: customization.colors.background }}>
                <div style={{ color: customization.colors.textLabel, marginBottom: 6 }}>Minimum Bid</div>
                <div style={{ color: customization.colors.textAmount, fontWeight: 700, fontSize: 18, marginBottom: 12 }}>$123.00</div>
                <button style={{
                  background: customization.colors.buttonPrimary,
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 6,
                  marginRight: 8
                }}>Place Bid</button>
                <button style={{
                  background: customization.colors.success,
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 6
                }}>Buy Now</button>
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
