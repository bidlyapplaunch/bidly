/**
 * Customer Authentication Service
 * Handles customer authentication for the auction marketplace.
 * When running inside a Shopify Storefront (via app proxy) we rely on Shopify customer sessions.
 * Otherwise we fall back to local sessionStorage for non-Shopify environments.
 */

const getMarketplaceConfig = () => {
  if (typeof window === 'undefined') {
    return {};
  }
  return window.BidlyMarketplaceConfig || {};
};

const buildCustomerFromConfig = (configCustomer = {}) => ({
  id: configCustomer.id,
  email: configCustomer.email,
  name: configCustomer.name || configCustomer.email || 'Shopify Customer',
  fullName: configCustomer.name || configCustomer.email || 'Shopify Customer',
  firstName: configCustomer.firstName || '',
  lastName: configCustomer.lastName || '',
  isTemp: false,
  source: 'shopify'
});

class CustomerAuthService {
  constructor() {
    this.customer = null;
    this.loadFromStorage();
  }

  /**
   * Load customer data from Shopify session, shared login system, or sessionStorage
   */
  loadFromStorage() {
    try {
      // Attempt Shopify marketplace config first
      const marketplaceConfig = getMarketplaceConfig();
      if (marketplaceConfig.customer?.logged_in) {
        this.customer = buildCustomerFromConfig(marketplaceConfig.customer);
        console.log('👤 Customer loaded from Shopify marketplace session:', this.customer.name);
        return;
      }

      // Try shared login system used by the widget
      if (window.BidlyHybridLogin) {
        const sharedCustomer = window.BidlyHybridLogin.getCurrentCustomer();
        const isLoggedIn = window.BidlyHybridLogin.isUserLoggedIn();

        if (isLoggedIn && sharedCustomer) {
          this.customer = sharedCustomer;
          console.log(
            '👤 Customer loaded from shared login system:',
            this.customer.fullName || this.customer.name
          );
          return;
        }
      }

      // Fall back to sessionStorage (standalone mode)
      const stored = sessionStorage.getItem('customerAuth');
      if (stored) {
        this.customer = JSON.parse(stored);
        console.log('👤 Customer loaded from session:', this.customer.name);
      }
    } catch (error) {
      console.error('Error loading customer from storage:', error);
      this.customer = null;
    }
  }

  /**
   * Check if customer is authenticated
   */
  isAuthenticated() {
    return this.customer !== null;
  }

  /**
   * Get current customer data
   */
  getCustomer() {
    return this.customer;
  }

  /**
   * Get customer name for display
   */
  getCustomerName() {
    if (this.customer) {
      return this.customer.fullName || this.customer.name || 'Guest';
    }
    return 'Guest';
  }

  /**
   * Get customer email (for admin purposes)
   */
  getCustomerEmail() {
    return this.customer ? this.customer.email : null;
  }

  /**
   * Login/Register customer
   */
  async login(customerData) {
    try {
      const marketplaceConfig = getMarketplaceConfig();

      if (marketplaceConfig.customer?.logged_in) {
        this.customer = buildCustomerFromConfig(marketplaceConfig.customer);
        return true;
      }

      if (marketplaceConfig.enforceShopifyLogin) {
        if (marketplaceConfig.loginUrl) {
          window.location.href = marketplaceConfig.loginUrl;
        }
        return false;
      }

      // Try shared login system first
      if (window.BidlyHybridLogin) {
        const success = await window.BidlyHybridLogin.guestLogin(
          customerData.name,
          customerData.email
        );
        if (success) {
          const sharedCustomer = window.BidlyHybridLogin.getCurrentCustomer();
          if (sharedCustomer) {
            this.customer = sharedCustomer;
            console.log(
              '✅ Customer authenticated via shared login system:',
              sharedCustomer.fullName || sharedCustomer.name
            );
            return true;
          }
        }
      }

      // Fallback to sessionStorage for non-Shopify environments
      sessionStorage.setItem('customerAuth', JSON.stringify(customerData));
      this.customer = customerData;

      console.log('✅ Customer authenticated (fallback):', customerData.name);
      return true;
    } catch (error) {
      console.error('Error storing customer data:', error);
      return false;
    }
  }

  /**
   * Logout customer
   */
  logout() {
    try {
      // Use shared login system if available
      if (window.BidlyHybridLogin) {
        window.BidlyHybridLogin.logout();
      }

      // Clear local storage/session
      sessionStorage.removeItem('customerAuth');
      this.customer = null;

      const marketplaceConfig = getMarketplaceConfig();
      if (marketplaceConfig.enforceShopifyLogin && marketplaceConfig.logoutUrl) {
        window.location.href = marketplaceConfig.logoutUrl;
        return true;
      }

      console.log('👋 Customer logged out');
      return true;
    } catch (error) {
      console.error('Error clearing customer data:', error);
      return false;
    }
  }

  /**
   * Get customer data for API requests
   */
  getCustomerForAPI() {
    if (!this.customer) {
      return null;
    }

    return {
      customerId: this.customer.id,
      customerName: this.customer.fullName || this.customer.name,
      customerEmail: this.customer.email
    };
  }

  /**
   * Validate customer data
   */
  validateCustomerData(customerData) {
    if (!customerData) {
      return { valid: false, error: 'Customer data is required' };
    }

    if (!customerData.name || !customerData.name.trim()) {
      return { valid: false, error: 'Name is required' };
    }

    if (!customerData.email || !customerData.email.trim()) {
      return { valid: false, error: 'Email is required' };
    }

    if (!/\S+@\S+\.\S+/.test(customerData.email)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    return { valid: true };
  }

  /**
   * Get session info
   */
  getSessionInfo() {
    if (!this.customer) {
      return null;
    }

    return {
      name: this.customer.name,
      email: this.customer.email,
      loginTime: this.customer.loginTime,
      sessionDuration: Date.now() - new Date(this.customer.loginTime).getTime()
    };
  }
}

// Create a singleton instance
const customerAuthService = new CustomerAuthService();

export default customerAuthService;
