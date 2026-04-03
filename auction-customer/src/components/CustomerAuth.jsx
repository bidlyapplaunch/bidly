import React, { useState, useMemo } from 'react';
import './CustomerAuth.css';
import { t } from '../i18n';

const marketplaceConfig = typeof window !== 'undefined' ? (window.BidlyMarketplaceConfig || {}) : {};

const CustomerAuth = ({ onLogin, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const enforceShopifyLogin = !!marketplaceConfig.enforceShopifyLogin;
  const shopifyLoginUrl = marketplaceConfig.loginUrl;
  const shopName = useMemo(() => {
    if (!marketplaceConfig.shopDomain) return null;
    return marketplaceConfig.shopDomain.replace('.myshopify.com', '');
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error when user types
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError(t('marketplace.auth.nameRequired'));
      return false;
    }
    if (!formData.email.trim()) {
      setError(t('marketplace.auth.emailRequired'));
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError(t('marketplace.auth.emailInvalid'));
      return false;
    }
    if (!formData.phone.trim()) {
      setError(t('marketplace.auth.phoneRequired') || 'Phone number is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get shop domain from config or URL
      const shopDomain = window.BidlyMarketplaceConfig?.shop
        || window.BidlyMarketplaceConfig?.shopDomain
        || new URLSearchParams(window.location.search).get('shop')
        || '';

      // Register with backend to get server-generated ID and token
      const backendUrl = window.BidlyBackendConfig?.backendUrl || '';
      const response = await fetch(`${backendUrl}/api/customers/saveCustomer?shop=${encodeURIComponent(shopDomain)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          firstName: formData.name.trim().split(' ')[0],
          lastName: formData.name.trim().split(' ').slice(1).join(' ') || '',
          displayName: formData.name.trim(),
          phone: formData.phone.trim(),
          isTemp: true
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Registration failed');
      }

      const customerData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        id: data.id || data.customer?.id,
        firstName: formData.name.trim().split(' ')[0],
        lastName: formData.name.trim().split(' ').slice(1).join(' ') || '',
        token: data.token,
        loginTime: new Date().toISOString(),
        isBidlyBidder: true
      };

      // Save to both localStorage (persistent) and sessionStorage (legacy compat)
      localStorage.setItem('bidly_bidder', JSON.stringify({
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        customerId: customerData.id,
        timestamp: Date.now()
      }));
      sessionStorage.setItem('customerAuth', JSON.stringify(customerData));

      if (onLogin) {
        onLogin(customerData);
      }
      onClose();
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || t('marketplace.auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({ name: '', email: '', phone: '' });
  };

  return (
    <div className="customer-auth-overlay">
      <div className="customer-auth-modal">
        <div className="customer-auth-header">
          <h2>{isLogin ? t('marketplace.auth.loginTitle') : t('marketplace.auth.registerTitle')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="customer-auth-body">
          <p className="auth-description">
            {isLogin 
              ? t('marketplace.auth.loginDescription')
              : t('marketplace.auth.registerDescription')
            }
          </p>
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">{t('marketplace.auth.fullName')}</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder={t('marketplace.auth.fullNamePlaceholder')}
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">{t('marketplace.auth.email')}</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder={t('marketplace.auth.emailPlaceholder')}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">{t('marketplace.auth.phone') || 'Phone Number'}</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder={t('marketplace.auth.phonePlaceholder') || '+1 234 567 890'}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? t('marketplace.auth.processing') : (isLogin ? t('marketplace.auth.login') : t('marketplace.auth.register'))}
            </button>
          </form>
          
          <div className="auth-switch">
            <p>
              {isLogin ? t('marketplace.auth.noAccount') + ' ' : t('marketplace.auth.hasAccount') + ' '}
              <button 
                type="button" 
                className="switch-btn"
                onClick={switchMode}
                disabled={loading}
              >
                {isLogin ? t('marketplace.auth.switchToRegister') : t('marketplace.auth.switchToLogin')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerAuth;
