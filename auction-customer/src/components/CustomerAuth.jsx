import React, { useState, useMemo } from 'react';
import './CustomerAuth.css';
import { t } from '../i18n';

const marketplaceConfig = typeof window !== 'undefined' ? (window.BidlyMarketplaceConfig || {}) : {};

const CustomerAuth = ({ onLogin, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: ''
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
      const customerData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        id: Date.now().toString(),
        loginTime: new Date().toISOString()
      };

      sessionStorage.setItem('customerAuth', JSON.stringify(customerData));
      onLogin(customerData);
      onClose();
    } catch (err) {
      setError(t('marketplace.auth.errorGeneric'));
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({ name: '', email: '' });
  };

  if (enforceShopifyLogin) {
    return (
      <div className="customer-auth-overlay">
        <div className="customer-auth-modal">
          <div className="customer-auth-header">
            <h2>{t('marketplace.auth.signInTitle')}</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="customer-auth-body">
            <p className="auth-description">
              {shopName
                ? t('marketplace.auth.shopifyLoginDescription', { shop: shopName })
                : t('marketplace.auth.shopifyLoginDescriptionGeneric')}
            </p>

            <div className="shopify-login-card">
              <p>{t('marketplace.auth.shopifyLoginCard')}</p>
              <button
                type="button"
                className="auth-submit-btn"
                onClick={() => {
                  if (shopifyLoginUrl) {
                    window.location.href = shopifyLoginUrl;
                  }
                }}
              >
                {t('marketplace.auth.continueShopifyLogin')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
