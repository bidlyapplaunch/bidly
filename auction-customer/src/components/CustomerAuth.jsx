import React, { useState, useMemo } from 'react';
import './CustomerAuth.css';

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
      setError('Name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email address');
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
      setError('Something went wrong. Please try again.');
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
            <h2>Sign in to Bid</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="customer-auth-body">
            <p className="auth-description">
              {shopName
                ? `Please sign in with your ${shopName} store account to place bids.`
                : 'Please sign in with your store account to place bids.'}
            </p>

            <div className="shopify-login-card">
              <p>You'll be redirected to your Shopify login page. Once you return, you can continue bidding.</p>
              <button
                type="button"
                className="auth-submit-btn"
                onClick={() => {
                  if (shopifyLoginUrl) {
                    window.location.href = shopifyLoginUrl;
                  }
                }}
              >
                Continue to Shopify Login
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
          <h2>{isLogin ? 'Login to Bid' : 'Register to Bid'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="customer-auth-body">
          <p className="auth-description">
            {isLogin 
              ? 'Enter your details to start bidding on auctions'
              : 'Create an account to participate in auctions'
            }
          </p>
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email address"
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
              {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
            </button>
          </form>
          
          <div className="auth-switch">
            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button" 
                className="switch-btn"
                onClick={switchMode}
                disabled={loading}
              >
                {isLogin ? 'Register' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerAuth;
