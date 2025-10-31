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
      primary: '#6366f1',
      background: '#ffffff',
      surface: '#667eea',
      textPrimary: '#1e293b',
      textSecondary: '#64748b',
      textTitle: '#ffffff',
      textTimer: '#fbbf24',
      textStatus: '#10b981',
      textCount: '#64748b',
      textLabel: '#475569',
      textAmount: '#6366f1',
      border: '#e2e8f0',
      accent: '#8b5cf6',
      success: '#10b981',
      error: '#ef4444',
      hover: '#4f46e5',
      buttonPrimary: '#6366f1',
      buttonSecondary: '#64748b',
      gradient1: '#667eea',
      gradient2: '#764ba2'
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

            {/* Live preview - matches actual widget structure */}
            <div style={{
              marginTop: 16,
              border: `1px solid ${customization.colors.border}`,
              borderRadius: 8,
              overflow: 'hidden',
              fontFamily: customization.font || 'Inter, sans-serif',
              background: customization.colors.background,
              boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)'
            }}>
              {/* Header bar - matches actual widget with gradient */}
              <div style={{
                background: `linear-gradient(135deg, ${customization.colors.gradient1 || '#667eea'}, ${customization.colors.gradient2 || '#764ba2'})`,
                padding: '20px 24px',
                borderBottom: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ 
                  fontSize: 20, 
                  fontWeight: 700, 
                  color: customization.colors.textTitle,
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                  Live Auction
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span style={{
                    fontSize: 12,
                    color: customization.colors.textStatus,
                    fontWeight: 500
                  }}>● LIVE</span>
                  <span style={{
                    fontSize: 14,
                    color: customization.colors.textSecondary
                  }}>👤 Guest</span>
                  <button style={{
                    background: 'none',
                    border: 'none',
                    color: customization.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}>×</button>
                </div>
              </div>

              {/* Timer section */}
              <div style={{
                padding: '15px 20px',
                background: customization.colors.background
              }}>
                <div style={{
                  fontSize: 14,
                  color: customization.colors.textLabel,
                  marginBottom: 8
                }}>
                  Ends In:
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 16,
                  color: customization.colors.textTimer,
                  fontWeight: 600
                }}>
                  0d 5h 46m 7s
                </div>
              </div>

              {/* Pricing section */}
              <div style={{
                padding: '15px 20px',
                background: customization.colors.background,
                borderTop: `1px solid ${customization.colors.border}`
              }}>
                <div style={{
                  fontSize: 14,
                  color: customization.colors.textLabel,
                  marginBottom: 4
                }}>
                  Starting Bid:
                </div>
                <div style={{
                  fontSize: 18,
                  color: customization.colors.textAmount,
                  fontWeight: 600,
                  marginBottom: 8
                }}>
                  $400.00
                </div>
                <div style={{
                  fontSize: 14,
                  color: customization.colors.textLabel,
                  marginBottom: 4
                }}>
                  Bids:
                </div>
                <div style={{
                  fontSize: 14,
                  color: customization.colors.textCount
                }}>
                  0
                </div>
              </div>

              {/* Minimum Bid section */}
              <div style={{
                padding: '12px 20px',
                background: customization.colors.surface,
                borderTop: `1px solid ${customization.colors.border}`
              }}>
                <div style={{
                  fontSize: 14,
                  color: customization.colors.textLabel,
                  marginBottom: 8
                }}>
                  Minimum Bid:
                </div>
                <div style={{
                  fontSize: 16,
                  color: customization.colors.textAmount,
                  fontWeight: 600
                }}>
                  $400.00
                </div>
              </div>

              {/* Bid input and button */}
              <div style={{
                padding: '15px 20px',
                background: customization.colors.background,
                borderTop: `1px solid ${customization.colors.border}`
              }}>
                <div style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center'
                }}>
                  <input
                    type="text"
                    placeholder="Min: $400.00"
                    style={{
                      flex: 1,
                      padding: '12px 15px',
                      border: `1px solid ${customization.colors.border}`,
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: customization.font || 'Inter, sans-serif',
                      background: '#fff',
                      color: customization.colors.textPrimary
                    }}
                    readOnly
                  />
                  <button style={{
                    background: customization.colors.buttonPrimary,
                    color: '#fff',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: customization.font || 'Inter, sans-serif'
                  }}>
                    Place Bid
                  </button>
                </div>
              </div>

              {/* View Bid History link */}
              <div style={{
                padding: '12px 20px',
                background: customization.colors.background,
                borderTop: `1px solid ${customization.colors.border}`,
                textAlign: 'center'
              }}>
                <a href="#" style={{
                  fontSize: 14,
                  color: customization.colors.textSecondary,
                  textDecoration: 'none'
                }}>
                  View Bid History
                </a>
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
