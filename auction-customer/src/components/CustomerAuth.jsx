import React, { useState } from 'react';
import './CustomerAuth.css';

const CustomerAuth = ({ onLogin, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      // For MVP, we'll just store the credentials locally
      // In a real app, this would make an API call to register/login
      const customerData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        id: Date.now().toString(), // Simple ID for MVP
        loginTime: new Date().toISOString()
      };

      // Store in sessionStorage (clears when browser closes)
      sessionStorage.setItem('customerAuth', JSON.stringify(customerData));
      
      // Call the parent component's onLogin function
      onLogin(customerData);
      
      // Close the modal
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
